import { Decimal } from 'decimal.js'
import { nanoid } from 'nanoid'
import type { ExchangeFactory } from '../exchange/exchange-factory.js'
import type { OrderRepository } from '../repositories/order.repository.js'
import type { TradeAccountRepository } from '../repositories/trade-account.repository.js'
import { appConfig } from '../config/env.js'
import { resolveTradingEnvironmentLabel } from '../utils/trading-environment.js'
import type {
  ExchangeCode,
  OrderRecord,
  TradeAccount,
  TradePosition,
} from '../types/domain.js'
import type {
  AccountBalance,
  GetOrderDetailResult,
  PrivateBalanceUpdate,
  PrivateOrderUpdate,
} from '../types/exchange.js'
import type { AuditLogService } from './audit-log.service.js'
import type { OrderRecoveryService } from './order-recovery.service.js'

interface RealOrderSyncServiceOptions {
  /** 定时同步间隔，单位毫秒。 */
  intervalMs: number
  /** 只同步最近一段时间内仍未终态的真实订单，避免历史订单重复占用配额。 */
  lookbackMinutes: number
  /** 单次同步批量上限。 */
  batchSize: number
}

type QuoteBalanceSnapshot = {
  available: string
  locked: string
}

type OrderSyncSource = 'rest' | 'private_stream'

const ORDER_SYNC_EPSILON = new Decimal('0.000000000001')

export class RealOrderSyncService {
  private timer?: NodeJS.Timeout
  private syncing = false
  private readonly privateQuoteBalanceSnapshots = new Map<string, QuoteBalanceSnapshot>()
  private readonly orderSyncQueue = new Map<string, Promise<void>>()
  private orderRecoveryService?: OrderRecoveryService

  constructor(
    private readonly exchangeFactory: ExchangeFactory,
    private readonly orderRepository: OrderRepository,
    private readonly tradeAccountRepository: TradeAccountRepository,
    private readonly auditLogService: AuditLogService,
    private readonly options: RealOrderSyncServiceOptions,
  ) {}

  start() {
    if (this.timer) {
      return
    }

    this.timer = setInterval(() => {
      void this.syncPendingOrders()
    }, this.options.intervalMs)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  setOrderRecoveryService(orderRecoveryService: OrderRecoveryService) {
    this.orderRecoveryService = orderRecoveryService
  }

  async syncPendingOrders() {
    if (this.syncing) {
      return
    }

    this.syncing = true
    try {
      const orders = this.orderRepository.listPendingRealOrders({
        createdAfter: new Date(Date.now() - this.options.lookbackMinutes * 60_000).toISOString(),
        limit: this.options.batchSize,
      })
      if (orders.length === 0) {
        return
      }

      const quoteBalanceCache = new Map<string, Promise<QuoteBalanceSnapshot | undefined>>()
      for (const order of orders) {
        await this.syncSingleOrder(order, quoteBalanceCache)
      }
    } finally {
      this.syncing = false
    }
  }

  async syncOrderById(orderId: string) {
    const order = this.orderRepository.findById(orderId)
    if (!order || order.simulationMode) {
      return
    }

    const quoteBalanceCache = new Map<string, Promise<QuoteBalanceSnapshot | undefined>>()
    await this.syncSingleOrder(order, quoteBalanceCache)
  }

  async syncPendingOrdersByExchange(exchange: ExchangeCode, limit = this.options.batchSize) {
    const orders = this.orderRepository.listPendingRealOrdersByExchange({
      createdAfter: new Date(Date.now() - this.options.lookbackMinutes * 60_000).toISOString(),
      exchange,
      limit,
    })
    const quoteBalanceCache = new Map<string, Promise<QuoteBalanceSnapshot | undefined>>()
    for (const order of orders) {
      await this.syncSingleOrder(order, quoteBalanceCache)
    }
  }

  async handlePrivateOrderUpdate(update: PrivateOrderUpdate) {
    const order = this.orderRepository.findByExchangeOrderId(update.exchange, update.exchangeOrderId)
    if (!order || order.simulationMode) {
      return
    }

    try {
      await this.runOrderSyncTask(order.id, async () => {
        const currentOrder = this.orderRepository.findById(order.id) ?? order
        await this.applyOrderDetail(
          currentOrder,
          {
            status: update.status,
            price: update.price,
            baseQuantity: update.baseQuantity,
            quoteAmount: update.quoteAmount,
            feeAmount: update.feeAmount,
            feeCurrency: update.feeCurrency,
            updatedAt: update.updatedAt,
            rawMessage: update.rawMessage,
          },
          'private_stream',
          new Map(),
        )
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '私有推送处理失败'
      this.orderRecoveryService?.createOrRefresh({
        identityKey: `private_stream:order:${order.id}`,
        orderId: order.id,
        exchangeOrderId: order.exchangeOrderId,
        exchange: order.exchange,
        source: order.ruleId ? 'rule' : 'manual',
        mode: 'real',
        symbol: order.symbol,
        failureStage: 'private_stream',
        lastErrorMessage: message,
        payload: {
          source: 'private_stream',
          exchangeOrderId: order.exchangeOrderId,
        },
      })
      this.auditLogService.record({
        level: 'warning',
        action: 'order.sync_failed',
        entityType: 'order',
        entityId: order.id,
        ruleId: order.ruleId,
        triggerId: order.triggerId,
        orderId: order.id,
        message: `${order.symbol} 私有推送处理失败：${message}`,
        dedupeKey: `order.sync_failed:private_stream:${order.id}:${message}`,
        dedupeMs: 60_000,
        payload: {
          exchange: order.exchange,
          tradingEnvironment: this.resolveTradingEnvironmentLabel(order.exchange),
          exchangeOrderId: order.exchangeOrderId,
        },
      })
    }
  }

  async handlePrivateBalanceUpdate(update: PrivateBalanceUpdate) {
    const now = update.updatedAt ?? new Date().toISOString()
    this.orderRecoveryService?.markRecoveredByIdentityKey(
      `balance_refresh:${update.exchange}:${(update.balances[0]?.currency ?? appConfig.simulation.quoteCurrency).toUpperCase()}`,
      `${update.exchange.toUpperCase()} 私有余额推送已恢复`,
    )
    update.balances.forEach(balance => {
      const currency = balance.currency.toUpperCase()
      this.orderRecoveryService?.markRecoveredByIdentityKey(
        `balance_refresh:${update.exchange}:${currency}`,
        `${update.exchange.toUpperCase()} ${currency} 余额刷新已恢复`,
      )
      this.privateQuoteBalanceSnapshots.set(this.buildQuoteBalanceCacheKey(update.exchange, currency), {
        available: balance.available,
        locked: balance.locked,
      })

      const currentAccount = this.tradeAccountRepository.findAccount('real', update.exchange, currency)
      if (!currentAccount) {
        return
      }

      this.tradeAccountRepository.updateAccountBalance({
        ...currentAccount,
        availableQuoteBalance: balance.available,
        lockedQuoteBalance: balance.locked,
        updatedAt: now,
      })
    })
  }

  private async syncSingleOrder(
    order: OrderRecord,
    quoteBalanceCache: Map<string, Promise<QuoteBalanceSnapshot | undefined>>,
  ) {
    await this.runOrderSyncTask(order.id, async () => {
      const currentOrder = this.orderRepository.findById(order.id) ?? order
      const adapter = this.exchangeFactory.getAdapter(currentOrder.exchange)
      if (!adapter.getOrderDetail) {
        return
      }

      try {
        const detail = await adapter.getOrderDetail({
          symbol: currentOrder.symbol,
          exchangeOrderId: currentOrder.exchangeOrderId,
        })
        await this.applyOrderDetail(currentOrder, detail, 'rest', quoteBalanceCache)
      } catch (error) {
        const message = error instanceof Error ? error.message : '真实订单状态同步失败'
        this.orderRecoveryService?.createOrRefresh({
          identityKey: `order_sync:${currentOrder.id}`,
          orderId: currentOrder.id,
          exchangeOrderId: currentOrder.exchangeOrderId,
          exchange: currentOrder.exchange,
          source: currentOrder.ruleId ? 'rule' : 'manual',
          mode: 'real',
          symbol: currentOrder.symbol,
          failureStage: 'order_sync',
          lastErrorMessage: message,
          payload: {
            currentStatus: currentOrder.status,
            source: 'rest',
          },
        })
        this.auditLogService.record({
          level: 'warning',
          action: 'order.sync_failed',
          entityType: 'order',
          entityId: currentOrder.id,
          ruleId: currentOrder.ruleId,
          triggerId: currentOrder.triggerId,
          orderId: currentOrder.id,
          message: `${currentOrder.symbol} 真实订单状态同步失败：${message}`,
          dedupeKey: `order.sync_failed:${currentOrder.id}:${message}`,
          dedupeMs: 5 * 60_000,
          payload: {
            exchange: currentOrder.exchange,
            tradingEnvironment: this.resolveTradingEnvironmentLabel(currentOrder.exchange),
            exchangeOrderId: currentOrder.exchangeOrderId,
            currentStatus: currentOrder.status,
            source: 'rest',
          },
        })
      }
    })
  }

  private async applyOrderDetail(
    order: OrderRecord,
    detail: GetOrderDetailResult,
    source: OrderSyncSource,
    quoteBalanceCache: Map<string, Promise<QuoteBalanceSnapshot | undefined>>,
  ) {
    const latestOrder = this.orderRepository.findById(order.id) ?? order
    if (source === 'private_stream') {
      this.orderRecoveryService?.markRecoveredByIdentityKey(
        `private_stream:order:${latestOrder.id}`,
        `${latestOrder.symbol} 私有推送消费已恢复`,
      )
    }
    this.orderRecoveryService?.markRecoveredByIdentityKey(
      `order_sync:${latestOrder.id}`,
      `${latestOrder.symbol} 订单状态同步已恢复`,
    )
    const changed = this.hasOrderChanged(latestOrder, detail)
    const syncedOrder = changed
      ? this.orderRepository.updateSyncSnapshot({
          id: latestOrder.id,
          status: detail.status,
          baseQuantity: detail.baseQuantity,
          quoteAmount: detail.quoteAmount,
          price: detail.price,
          rawMessage: detail.rawMessage,
        }) ?? latestOrder
      : latestOrder

    if (changed) {
      this.auditLogService.record({
        action: 'order.synced',
        entityType: 'order',
        entityId: latestOrder.id,
        ruleId: latestOrder.ruleId,
        triggerId: latestOrder.triggerId,
        orderId: latestOrder.id,
        message: `${latestOrder.symbol} 真实订单状态已通过${this.getSourceLabel(source)}同步为 ${detail.status}`,
        payload: {
          exchange: latestOrder.exchange,
          tradingEnvironment: this.resolveTradingEnvironmentLabel(latestOrder.exchange),
          exchangeOrderId: latestOrder.exchangeOrderId,
          previousStatus: latestOrder.status,
          currentStatus: detail.status,
          baseQuantity: detail.baseQuantity,
          quoteAmount: detail.quoteAmount,
          price: detail.price,
          updatedAt: detail.updatedAt,
          source,
        },
      })
    }

    await this.applyOrderFillDelta(syncedOrder, detail, quoteBalanceCache, source)
  }

  private hasOrderChanged(order: OrderRecord, detail: GetOrderDetailResult) {
    return order.status !== detail.status
      || order.baseQuantity !== detail.baseQuantity
      || order.quoteAmount !== detail.quoteAmount
      || order.price !== detail.price
  }

  private async applyOrderFillDelta(
    order: OrderRecord,
    detail: GetOrderDetailResult,
    quoteBalanceCache: Map<string, Promise<QuoteBalanceSnapshot | undefined>>,
    source: OrderSyncSource,
  ) {
    const [baseCurrency, quoteCurrency = appConfig.simulation.quoteCurrency] = order.symbol.split('-')
    const cumulativeBaseQuantity = this.toPositiveDecimal(detail.baseQuantity)
    const cumulativeQuoteAmount = this.toPositiveDecimal(detail.quoteAmount)
    const cumulativeFeeAmount = this.toPositiveDecimal(detail.feeAmount)
    if (!cumulativeBaseQuantity.greaterThan(0) || !cumulativeQuoteAmount.greaterThan(0)) {
      return
    }

    const handledTotals = this.tradeAccountRepository.getFillTotalsByOrderId(order.id)
    const deltaBaseQuantity = this.resolveDelta(cumulativeBaseQuantity, handledTotals.baseQuantity)
    const deltaQuoteAmount = this.resolveDelta(cumulativeQuoteAmount, handledTotals.quoteAmount)
    const deltaFeeAmount = this.resolveDelta(cumulativeFeeAmount, handledTotals.feeAmount)
    if (
      !deltaBaseQuantity.greaterThan(0)
      && !deltaQuoteAmount.greaterThan(0)
      && !deltaFeeAmount.greaterThan(0)
    ) {
      return
    }

    if (deltaBaseQuantity.lessThan(0) || deltaQuoteAmount.lessThan(0) || deltaFeeAmount.lessThan(0)) {
      this.orderRecoveryService?.createOrRefresh({
        identityKey: `trade_fill_sync:${order.id}`,
        orderId: order.id,
        exchangeOrderId: order.exchangeOrderId,
        exchange: order.exchange,
        source: order.ruleId ? 'rule' : 'manual',
        mode: 'real',
        symbol: order.symbol,
        failureStage: 'trade_fill_sync',
        lastErrorMessage: '真实订单累计成交回退，已跳过本次账本同步',
        payload: {
          source,
          cumulativeBaseQuantity: cumulativeBaseQuantity.toFixed(),
          cumulativeQuoteAmount: cumulativeQuoteAmount.toFixed(),
          cumulativeFeeAmount: cumulativeFeeAmount.toFixed(),
          handledTotals,
        },
      })
      this.auditLogService.record({
        level: 'warning',
        action: 'order.sync_failed',
        entityType: 'order',
        entityId: order.id,
        ruleId: order.ruleId,
        triggerId: order.triggerId,
        orderId: order.id,
        message: `${order.symbol} 真实订单累计成交回退，已跳过本次账本同步`,
        dedupeKey: `order.sync_failed:delta_regressed:${order.id}:${detail.updatedAt ?? 'unknown'}`,
        dedupeMs: 60_000,
        payload: {
          source,
          tradingEnvironment: this.resolveTradingEnvironmentLabel(order.exchange),
          cumulativeBaseQuantity: cumulativeBaseQuantity.toFixed(),
          cumulativeQuoteAmount: cumulativeQuoteAmount.toFixed(),
          cumulativeFeeAmount: cumulativeFeeAmount.toFixed(),
          handledTotals,
        },
      })
      return
    }

    if (!deltaBaseQuantity.greaterThan(0) || !deltaQuoteAmount.greaterThan(0)) {
      this.orderRecoveryService?.createOrRefresh({
        identityKey: `trade_fill_sync:${order.id}`,
        orderId: order.id,
        exchangeOrderId: order.exchangeOrderId,
        exchange: order.exchange,
        source: order.ruleId ? 'rule' : 'manual',
        mode: 'real',
        symbol: order.symbol,
        failureStage: 'trade_fill_sync',
        lastErrorMessage: '真实订单成交增量不完整，暂未回写本地账本',
        payload: {
          source,
          deltaBaseQuantity: deltaBaseQuantity.toFixed(),
          deltaQuoteAmount: deltaQuoteAmount.toFixed(),
          deltaFeeAmount: deltaFeeAmount.toFixed(),
          rawMessage: detail.rawMessage,
        },
      })
      this.auditLogService.record({
        level: 'warning',
        action: 'order.sync_failed',
        entityType: 'order',
        entityId: order.id,
        ruleId: order.ruleId,
        triggerId: order.triggerId,
        orderId: order.id,
        message: `${order.symbol} 真实订单成交增量不完整，暂未回写本地账本`,
        dedupeKey: `order.sync_failed:delta_incomplete:${order.id}:${detail.updatedAt ?? 'unknown'}`,
        dedupeMs: 60_000,
        payload: {
          source,
          tradingEnvironment: this.resolveTradingEnvironmentLabel(order.exchange),
          deltaBaseQuantity: deltaBaseQuantity.toFixed(),
          deltaQuoteAmount: deltaQuoteAmount.toFixed(),
          deltaFeeAmount: deltaFeeAmount.toFixed(),
          rawMessage: detail.rawMessage,
        },
      })
      return
    }

    const feeCurrency = detail.feeCurrency?.toUpperCase() ?? quoteCurrency
    const executionPrice = deltaQuoteAmount.div(deltaBaseQuantity)
    const quoteBalance = await this.getQuoteBalanceSnapshot(order.exchange, quoteCurrency, quoteBalanceCache)
    const now = detail.updatedAt ?? new Date().toISOString()
    const account = this.findOrCreateRealAccount({
      order,
      quoteCurrency,
      quoteBalance,
      quoteAmount: deltaQuoteAmount,
      feeAmount: deltaFeeAmount,
      feeCurrency,
      now,
    })
    if (!account) {
      return
    }

    const nextAccount = this.buildNextRealAccount(account, quoteBalance, now)
    const currentPosition = this.tradeAccountRepository.findPosition(account.id, order.symbol)
    if (order.side === 'sell' && !currentPosition) {
      this.tradeAccountRepository.updateAccountBalance(nextAccount)
      this.orderRecoveryService?.createOrRefresh({
        identityKey: `trade_fill_sync:${order.id}`,
        orderId: order.id,
        exchangeOrderId: order.exchangeOrderId,
        exchange: order.exchange,
        source: order.ruleId ? 'rule' : 'manual',
        mode: 'real',
        symbol: order.symbol,
        failureStage: 'trade_fill_sync',
        lastErrorMessage: '卖出订单缺少本地持仓成本基线，暂未回写真实持仓收益',
        payload: {
          source,
          reason: 'missing_local_position_baseline',
        },
      })
      this.auditLogService.record({
        level: 'warning',
        action: 'order.sync_failed',
        entityType: 'order',
        entityId: order.id,
        ruleId: order.ruleId,
        triggerId: order.triggerId,
        orderId: order.id,
        message: `${order.symbol} 卖出订单缺少本地持仓成本基线，暂未回写真实持仓收益`,
        payload: {
          exchange: order.exchange,
          tradingEnvironment: this.resolveTradingEnvironmentLabel(order.exchange),
          exchangeOrderId: order.exchangeOrderId,
          source,
        },
      })
      return
    }

    const nextPosition = this.buildNextRealPosition({
      account,
      order,
      currentPosition,
      baseCurrency,
      quoteCurrency,
      baseQuantity: deltaBaseQuantity,
      quoteAmount: deltaQuoteAmount,
      feeAmount: deltaFeeAmount,
      feeCurrency,
      now,
    })
    const realizedPnl = this.calculateRealizedPnl({
      order,
      currentPosition,
      baseQuantity: deltaBaseQuantity,
      quoteAmount: deltaQuoteAmount,
      feeAmount: deltaFeeAmount,
      feeCurrency,
    })

    this.tradeAccountRepository.runInTransaction(() => {
      this.tradeAccountRepository.updateAccountBalance(nextAccount)
      this.tradeAccountRepository.upsertPosition(nextPosition)
      this.tradeAccountRepository.createFill({
        id: nanoid(),
        accountId: nextAccount.id,
        orderId: order.id,
        accountType: 'real',
        exchange: order.exchange,
        symbol: order.symbol,
        side: order.side,
        price: executionPrice.toFixed(),
        baseQuantity: deltaBaseQuantity.toFixed(),
        quoteAmount: deltaQuoteAmount.toFixed(),
        feeAmount: deltaFeeAmount.toFixed(),
        feeCurrency,
        realizedPnl: realizedPnl.toFixed(),
        rawMessage: detail.rawMessage,
        createdAt: now,
      })
      this.tradeAccountRepository.createOperationLog({
        id: nanoid(),
        accountId: nextAccount.id,
        accountType: 'real',
        exchange: order.exchange,
        level: 'info',
        action: order.side === 'buy' ? 'trade.buy.synced' : 'trade.sell.synced',
        message: `${order.symbol} 真实${order.side === 'buy' ? '买入' : '卖出'}成交增量已通过${this.getSourceLabel(source)}同步到本地账本`,
        payloadJson: JSON.stringify({
          orderId: order.id,
          exchangeOrderId: order.exchangeOrderId,
          source,
          tradingEnvironment: this.resolveTradingEnvironmentLabel(order.exchange),
          price: executionPrice.toFixed(),
          baseQuantity: deltaBaseQuantity.toFixed(),
          quoteAmount: deltaQuoteAmount.toFixed(),
          feeAmount: deltaFeeAmount.toFixed(),
          feeCurrency,
          realizedPnl: realizedPnl.toFixed(),
          feeOutsideTrackedAssets: deltaFeeAmount.greaterThan(0) && feeCurrency !== baseCurrency && feeCurrency !== quoteCurrency,
        }),
        createdAt: now,
      })
    })
    this.orderRecoveryService?.markRecoveredByIdentityKey(
      `trade_fill_sync:${order.id}`,
      `${order.symbol} 成交补全已恢复`,
    )
  }

  private findOrCreateRealAccount(input: {
    order: OrderRecord
    quoteCurrency: string
    quoteBalance?: QuoteBalanceSnapshot
    quoteAmount: Decimal
    feeAmount: Decimal
    feeCurrency: string
    now: string
  }) {
    const current = this.tradeAccountRepository.findAccount('real', input.order.exchange, input.quoteCurrency)
    if (current) {
      return current
    }

    if (!input.quoteBalance || input.order.side !== 'buy') {
      this.auditLogService.record({
        level: 'warning',
        action: 'order.sync_failed',
        entityType: 'order',
        entityId: input.order.id,
        ruleId: input.order.ruleId,
        triggerId: input.order.triggerId,
        orderId: input.order.id,
        message: `${input.order.symbol} 真实账户基线不足，暂未初始化本地真实账本`,
        payload: {
          exchange: input.order.exchange,
          tradingEnvironment: this.resolveTradingEnvironmentLabel(input.order.exchange),
          side: input.order.side,
          quoteCurrency: input.quoteCurrency,
        },
      })
      return undefined
    }

    const quoteTotal = new Decimal(input.quoteBalance.available).plus(input.quoteBalance.locked)
    const initialEquity = quoteTotal
      .plus(this.resolveTrackedQuoteFee(input.feeAmount, input.feeCurrency, input.quoteCurrency))
      .plus(input.quoteAmount)
    const account = this.tradeAccountRepository.createAccount({
      id: `real-${input.order.exchange}-${input.quoteCurrency.toLowerCase()}`,
      accountType: 'real',
      exchange: input.order.exchange,
      quoteCurrency: input.quoteCurrency,
      // 当前版本只追踪由本系统发出的真实订单，因此首次建账以“当前余额 + 本次成交成本”回推系统内收益基线。
      initialEquity: initialEquity.toFixed(),
      availableQuoteBalance: input.quoteBalance.available,
      lockedQuoteBalance: input.quoteBalance.locked,
      createdAt: input.now,
      updatedAt: input.now,
    })
    this.tradeAccountRepository.createOperationLog({
      id: nanoid(),
      accountId: account.id,
      accountType: 'real',
      exchange: account.exchange,
      level: 'info',
      action: 'account.synced',
      message: `${account.exchange.toUpperCase()} 真实账户已初始化本地账本基线`,
      payloadJson: JSON.stringify({
        quoteCurrency: account.quoteCurrency,
        initialEquity: account.initialEquity,
      }),
      createdAt: input.now,
    })
    return account
  }

  private buildNextRealAccount(account: TradeAccount, quoteBalance: QuoteBalanceSnapshot | undefined, now: string): TradeAccount {
    if (!quoteBalance) {
      return {
        ...account,
        updatedAt: now,
      }
    }

    return {
      ...account,
      availableQuoteBalance: quoteBalance.available,
      lockedQuoteBalance: quoteBalance.locked,
      updatedAt: now,
    }
  }

  private buildNextRealPosition(input: {
    account: TradeAccount
    order: OrderRecord
    currentPosition?: TradePosition
    baseCurrency: string
    quoteCurrency: string
    baseQuantity: Decimal
    quoteAmount: Decimal
    feeAmount: Decimal
    feeCurrency: string
    now: string
  }): TradePosition {
    const currentQuantity = new Decimal(input.currentPosition?.quantity ?? 0)
    const currentCost = new Decimal(input.currentPosition?.costAmount ?? 0)
    const currentRealizedPnl = new Decimal(input.currentPosition?.realizedPnl ?? 0)
    const currentFee = new Decimal(input.currentPosition?.feeAmount ?? 0)
    const trackedQuoteFee = this.resolveTrackedQuoteFee(input.feeAmount, input.feeCurrency, input.quoteCurrency)
    const trackedBaseFee = this.resolveTrackedBaseFee(input.feeAmount, input.feeCurrency, input.baseCurrency)

    if (input.order.side === 'buy') {
      const netBaseQuantity = Decimal.max(input.baseQuantity.minus(trackedBaseFee), 0)
      const nextQuantity = currentQuantity.plus(netBaseQuantity)
      const nextCost = currentCost.plus(input.quoteAmount).plus(trackedQuoteFee)
      return {
        id: input.currentPosition?.id ?? nanoid(),
        accountId: input.account.id,
        accountType: 'real',
        exchange: input.order.exchange,
        symbol: input.order.symbol,
        baseCurrency: input.baseCurrency,
        quoteCurrency: input.quoteCurrency,
        quantity: nextQuantity.toFixed(),
        availableQuantity: nextQuantity.toFixed(),
        lockedQuantity: input.currentPosition?.lockedQuantity ?? '0',
        avgCostPrice: nextQuantity.isZero() ? '0' : nextCost.div(nextQuantity).toFixed(),
        costAmount: nextCost.toFixed(),
        realizedPnl: currentRealizedPnl.toFixed(),
        feeAmount: currentFee.plus(trackedQuoteFee).toFixed(),
        createdAt: input.currentPosition?.createdAt ?? input.now,
        updatedAt: input.now,
      }
    }

    const currentAvgCost = new Decimal(input.currentPosition?.avgCostPrice ?? 0)
    const baseReduction = input.baseQuantity.plus(trackedBaseFee)
    const nextQuantity = Decimal.max(currentQuantity.minus(baseReduction), 0)
    const soldCost = currentAvgCost.mul(baseReduction)
    const nextCost = Decimal.max(currentCost.minus(soldCost), 0)
    return {
      id: input.currentPosition?.id ?? nanoid(),
      accountId: input.account.id,
      accountType: 'real',
      exchange: input.order.exchange,
      symbol: input.order.symbol,
      baseCurrency: input.baseCurrency,
      quoteCurrency: input.quoteCurrency,
      quantity: nextQuantity.toFixed(),
      availableQuantity: nextQuantity.toFixed(),
      lockedQuantity: input.currentPosition?.lockedQuantity ?? '0',
      avgCostPrice: nextQuantity.isZero() ? '0' : nextCost.div(nextQuantity).toFixed(),
      costAmount: nextCost.toFixed(),
      realizedPnl: currentRealizedPnl.plus(this.calculateRealizedPnl({
        order: input.order,
        currentPosition: input.currentPosition,
        baseQuantity: input.baseQuantity,
        quoteAmount: input.quoteAmount,
        feeAmount: input.feeAmount,
        feeCurrency: input.feeCurrency,
      })).toFixed(),
      feeAmount: currentFee.plus(trackedQuoteFee).toFixed(),
      createdAt: input.currentPosition?.createdAt ?? input.now,
      updatedAt: input.now,
    }
  }

  private calculateRealizedPnl(input: {
    order: OrderRecord
    currentPosition?: TradePosition
    baseQuantity: Decimal
    quoteAmount: Decimal
    feeAmount: Decimal
    feeCurrency: string
  }) {
    if (input.order.side !== 'sell' || !input.currentPosition) {
      return new Decimal(0)
    }

    const trackedQuoteFee = this.resolveTrackedQuoteFee(input.feeAmount, input.feeCurrency, input.currentPosition.quoteCurrency)
    const trackedBaseFee = this.resolveTrackedBaseFee(input.feeAmount, input.feeCurrency, input.currentPosition.baseCurrency)
    const baseReduction = input.baseQuantity.plus(trackedBaseFee)
    const cost = new Decimal(input.currentPosition.avgCostPrice).mul(baseReduction)
    return input.quoteAmount.minus(trackedQuoteFee).minus(cost)
  }

  private async getQuoteBalanceSnapshot(
    exchange: ExchangeCode,
    quoteCurrency: string,
    quoteBalanceCache: Map<string, Promise<QuoteBalanceSnapshot | undefined>>,
  ) {
    const privateSnapshot = this.privateQuoteBalanceSnapshots.get(this.buildQuoteBalanceCacheKey(exchange, quoteCurrency))
    if (privateSnapshot) {
      return privateSnapshot
    }

    const cacheKey = this.buildQuoteBalanceCacheKey(exchange, quoteCurrency)
    const cachedPromise = quoteBalanceCache.get(cacheKey)
    if (cachedPromise) {
      return cachedPromise
    }

    const balancePromise = this.fetchQuoteBalanceSnapshot(exchange, quoteCurrency)
    quoteBalanceCache.set(cacheKey, balancePromise)
    return balancePromise
  }

  private async fetchQuoteBalanceSnapshot(exchange: ExchangeCode, quoteCurrency: string) {
    const adapter = this.exchangeFactory.getAdapter(exchange)
    if (!adapter.getAccountBalances) {
      return undefined
    }

    try {
      const balances = await adapter.getAccountBalances([quoteCurrency])
      const balance = balances.find(item => item.currency === quoteCurrency.toUpperCase())
      if (!balance) {
        return undefined
      }

      const snapshot = {
        available: balance.available,
        locked: balance.locked,
      }
      this.privateQuoteBalanceSnapshots.set(this.buildQuoteBalanceCacheKey(exchange, quoteCurrency), snapshot)
      this.orderRecoveryService?.markRecoveredByIdentityKey(
        `balance_refresh:${exchange}:${quoteCurrency.toUpperCase()}`,
        `${exchange.toUpperCase()} ${quoteCurrency.toUpperCase()} 余额刷新已恢复`,
      )
      return snapshot
    } catch (error) {
      this.orderRecoveryService?.createOrRefresh({
        identityKey: `balance_refresh:${exchange}:${quoteCurrency.toUpperCase()}`,
        exchange,
        source: 'system',
        mode: 'real',
        failureStage: 'balance_refresh',
        lastErrorMessage: error instanceof Error ? error.message : '真实账户余额同步失败',
        payload: {
          quoteCurrency,
        },
      })
      this.auditLogService.record({
        level: 'warning',
        action: 'order.sync_failed',
        entityType: 'account',
        entityId: `real-${exchange}-${quoteCurrency.toLowerCase()}`,
        message: `${exchange.toUpperCase()} 真实账户余额同步失败：${error instanceof Error ? error.message : '未知错误'}`,
        dedupeKey: `order.sync_failed:balance:${exchange}:${quoteCurrency}`,
        dedupeMs: 5 * 60_000,
        payload: {
          exchange,
          tradingEnvironment: this.resolveTradingEnvironmentLabel(exchange),
          quoteCurrency,
        },
      })
      return undefined
    }
  }

  private buildQuoteBalanceCacheKey(exchange: ExchangeCode, quoteCurrency: string) {
    return `${exchange}:${quoteCurrency.toUpperCase()}`
  }

  private resolveTrackedQuoteFee(feeAmount: Decimal, feeCurrency: string, quoteCurrency: string) {
    return feeCurrency === quoteCurrency ? feeAmount : new Decimal(0)
  }

  private resolveTrackedBaseFee(feeAmount: Decimal, feeCurrency: string, baseCurrency: string) {
    return feeCurrency === baseCurrency ? feeAmount : new Decimal(0)
  }

  private toPositiveDecimal(value?: string) {
    try {
      const decimalValue = new Decimal(value ?? 0)
      return decimalValue.greaterThan(0) ? decimalValue : new Decimal(0)
    } catch {
      return new Decimal(0)
    }
  }

  private resolveDelta(currentValue: Decimal, handledValue?: string) {
    const delta = currentValue.minus(handledValue ?? 0)
    return delta.abs().lessThanOrEqualTo(ORDER_SYNC_EPSILON) ? new Decimal(0) : delta
  }

  private getSourceLabel(source: OrderSyncSource) {
    return source === 'private_stream' ? '私有推送' : 'REST'
  }

  private async runOrderSyncTask(orderId: string, task: () => Promise<void>) {
    const previousTask = this.orderSyncQueue.get(orderId) ?? Promise.resolve()
    let currentTask: Promise<void> | undefined
    currentTask = previousTask
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        if (this.orderSyncQueue.get(orderId) === currentTask) {
          this.orderSyncQueue.delete(orderId)
        }
      })
    this.orderSyncQueue.set(orderId, currentTask)
    await currentTask
  }

  /** 统一包装交易环境标签解析，保留当前服务内部调用方式，降低本轮重构改动面。 */
  private resolveTradingEnvironmentLabel(exchange: ExchangeCode) {
    return resolveTradingEnvironmentLabel(exchange)
  }
}
