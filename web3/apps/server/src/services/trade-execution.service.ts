import { Decimal } from 'decimal.js'
import { nanoid } from 'nanoid'
import type { ExchangeFactory } from '../exchange/exchange-factory.js'
import type { OrderRepository } from '../repositories/order.repository.js'
import type { TradeAccountRepository } from '../repositories/trade-account.repository.js'
import type { TradeOrderPreviewInput } from '../routes/dto.js'
import { appConfig } from '../config/env.js'
import type {
  MonitorRule,
  ExchangeCode,
  OrderRecord,
  TradeAccount,
  TradeEquityHistoryPoint,
  TradeEquitySnapshot,
  TradeAccountSummary,
  TradeAccountType,
  TradeOrderCheckItem,
  TradeOrderPreview,
  TradePosition,
  TradePositionView,
} from '../types/domain.js'
import type { AccountBalance, InstrumentRule, TickerPrice } from '../types/exchange.js'
import type { RiskConfigService } from './risk-config.service.js'
import type { TradingRuleService } from './trading-rule.service.js'

type ValuationContext = {
  /** 单次估值请求内的行情缓存，避免账户汇总、持仓列表重复查询同一交易对最新价 */
  tickerPriceCache: Map<string, Promise<TickerPrice>>
}

export class TradeExecutionError extends Error {
  constructor(
    message: string,
    /** 下单确认前重新生成的预览，便于前端展示拒绝原因 */
    readonly preview: TradeOrderPreview,
  ) {
    super(message)
    this.name = 'TradeExecutionError'
  }
}

export class TradeExecutionService {
  constructor(
    private readonly exchangeFactory: ExchangeFactory,
    private readonly orderRepository: OrderRepository,
    private readonly tradeAccountRepository: TradeAccountRepository,
    private readonly tradingRuleService: TradingRuleService,
    private readonly riskConfigService: RiskConfigService,
  ) {}

  async preview(input: TradeOrderPreviewInput): Promise<TradeOrderPreview> {
    const exchange = input.exchange
    const symbol = input.symbol.trim().toUpperCase()
    const adapter = this.exchangeFactory.getAdapter(exchange)
    const latestTicker = await adapter.getLatestPrice(symbol)
    const rules = await this.tradingRuleService.listInstrumentRules(exchange)
    const instrumentRule = rules.find(rule => rule.symbol === symbol)
    const executionPrice = new Decimal(input.orderType === 'limit' && input.limitPrice ? input.limitPrice : latestTicker.price)
    const baseQuantity = this.resolveBaseQuantity(input, executionPrice, instrumentRule)
    const quoteAmount = baseQuantity.mul(executionPrice)
    const feeAmount = new Decimal(0)
    const account = this.findAccount(input.mode, exchange, instrumentRule?.quoteCurrency ?? 'USDT')
    const position = account ? this.tradeAccountRepository.findPosition(account.id, symbol) : undefined
    const realBalances = input.mode === 'real' ? await this.safeGetRealBalances(exchange, [instrumentRule?.quoteCurrency ?? 'USDT', instrumentRule?.baseCurrency ?? symbol.split('-')[0]]) : []
    const checkItems = this.buildCheckItems({
      input,
      instrumentRule,
      executionPrice,
      baseQuantity,
      quoteAmount,
      feeAmount,
      account,
      position,
      realBalances,
    })
    const nextQuoteBalance = this.calculateNextQuoteBalance(input.mode, input.side, account, realBalances, instrumentRule?.quoteCurrency ?? 'USDT', quoteAmount, feeAmount)
    const nextBaseQuantity = this.calculateNextBaseQuantity(input.side, position, baseQuantity)

    return {
      mode: input.mode,
      exchange,
      symbol,
      side: input.side,
      orderType: input.orderType,
      executionPrice: executionPrice.toFixed(),
      baseQuantity: baseQuantity.toFixed(),
      quoteAmount: quoteAmount.toFixed(),
      feeAmount: feeAmount.toFixed(),
      feeCurrency: instrumentRule?.quoteCurrency ?? 'USDT',
      estimatedRealizedPnl: this.estimateRealizedPnl(input.side, position, baseQuantity, quoteAmount, feeAmount).toFixed(),
      nextAvailableQuoteBalance: nextQuoteBalance.toFixed(),
      nextAvailableBaseQuantity: nextBaseQuantity.toFixed(),
      passed: checkItems.every(item => item.passed),
      checkItems,
      previewedAt: new Date().toISOString(),
    }
  }

  async confirm(input: TradeOrderPreviewInput): Promise<OrderRecord> {
    const preview = await this.preview(input)
    this.assertPreviewConfirmable(preview)
    const account = this.findSimulationAccountOrThrow(preview)
    return this.persistSimulationOrder(account, preview, {
      // 快捷交易不经过规则和触发事件链路，这里不再伪造外键记录。
      rawMessage: '模拟交易即时成交，后续真实交易会由交易所订单状态同步',
    })
  }

  async confirmRuleTrigger(input: {
    /** 触发事件 ID */
    triggerId: string
    /** 触发事件关联规则 */
    rule: MonitorRule
  }): Promise<OrderRecord> {
    const previewInput = this.toPreviewInput(input.rule)
    const preview = await this.preview(previewInput)
    this.assertPreviewConfirmable(preview)
    const account = this.findSimulationAccountOrThrow(preview)
    return this.persistSimulationOrder(account, preview, {
      triggerId: input.triggerId,
      ruleId: input.rule.id,
      rawMessage: '规则触发后的模拟交易已即时成交，后续真实交易会由交易所订单状态同步',
    })
  }

  async listPositionViews(mode?: TradeAccountType, exchange?: ExchangeCode): Promise<TradePositionView[]> {
    const positions = this.tradeAccountRepository.listPositions(mode, exchange)
    const context = this.createValuationContext()
    return Promise.all(positions.map(position => this.toPositionView(position, context)))
  }

  async listAccountSummaries(mode?: TradeAccountType): Promise<TradeAccountSummary[]> {
    const accounts = this.tradeAccountRepository.listAccounts(mode)
    const context = this.createValuationContext()
    return Promise.all(accounts.map(account => this.toAccountSummary(account, context)))
  }

  async listEquityHistory(input: {
    /** 下单模式，不传时返回全部模式 */
    mode?: TradeAccountType
    /** 交易所编码，不传时返回全部交易所 */
    exchange?: ExchangeCode
    /** 返回最近多少天，默认由 DTO 控制为 30 天 */
    days: number
  }): Promise<TradeEquityHistoryPoint[]> {
    const accounts = this.tradeAccountRepository
      .listAccounts(input.mode)
      .filter(account => !input.exchange || account.exchange === input.exchange)
    const today = this.formatLocalDate(new Date())
    const fromDate = this.shiftDate(today, -(input.days - 1))
    const now = new Date().toISOString()
    const context = this.createValuationContext()
    const summaries = await Promise.all(accounts.map(account => this.toAccountSummary(account, context)))

    // 每次查询历史曲线时先固化当天快照，确保页面看到的曲线和账户汇总口径一致。
    summaries.forEach(summary => {
      this.tradeAccountRepository.upsertEquitySnapshot(this.toEquitySnapshot(summary, today, now))
    })

    return accounts.flatMap(account => {
      const snapshots = this.tradeAccountRepository.listEquitySnapshots(account.id, fromDate, today)
      const latestBefore = this.tradeAccountRepository.findLatestEquitySnapshotBefore(account.id, fromDate)
      return this.buildEquityHistoryPoints(account, snapshots, latestBefore, fromDate, input.days)
    })
  }

  private findAccount(mode: TradeAccountType, exchange: ExchangeCode, quoteCurrency: string) {
    return this.tradeAccountRepository.findAccount(mode, exchange, quoteCurrency.toUpperCase())
  }

  private assertPreviewConfirmable(preview: TradeOrderPreview) {
    if (!preview.passed) {
      const reason = preview.checkItems.filter(item => !item.passed).map(item => item.message).join('；')
      throw new TradeExecutionError(`交易确认失败：${reason}`, preview)
    }

    if (preview.mode === 'real') {
      throw new TradeExecutionError('真实下单接口尚未开放，当前仅完成真实交易前余额校验', preview)
    }
  }

  private findSimulationAccountOrThrow(preview: TradeOrderPreview) {
    const account = this.findAccount('simulation', preview.exchange, preview.feeCurrency)
    if (!account) {
      throw new TradeExecutionError('模拟账户不存在，请重启后端或检查初始化日志', preview)
    }

    return account
  }

  private persistSimulationOrder(
    account: TradeAccount,
    preview: TradeOrderPreview,
    metadata: {
      /** 规则触发成交时记录对应触发事件，手动快捷交易保持空值。 */
      triggerId?: string
      /** 规则触发成交时记录来源规则，手动快捷交易保持空值。 */
      ruleId?: string
      /** 保留当前成交语义，方便成交记录和操作日志区分来源。 */
      rawMessage: string
    },
  ) {
    return this.tradeAccountRepository.runInTransaction(() => {
      const now = new Date().toISOString()
      const order = this.orderRepository.create({
        id: nanoid(),
        triggerId: metadata.triggerId,
        ruleId: metadata.ruleId,
        exchange: preview.exchange,
        symbol: preview.symbol,
        side: preview.side,
        orderType: preview.orderType,
        baseQuantity: preview.baseQuantity,
        quoteAmount: preview.quoteAmount,
        // 模拟成交在确认阶段已经确定执行参考价，统一落库有利于成交记录和持仓回溯。
        price: preview.executionPrice,
        exchangeOrderId: `sim-trade-${nanoid(12)}`,
        status: 'filled',
        simulationMode: true,
        rawMessage: metadata.rawMessage,
        createdAt: now,
      })

      this.applySimulationFill(account, preview, order, now)
      return order
    })
  }

  private toPreviewInput(rule: MonitorRule): TradeOrderPreviewInput {
    const mode: TradeAccountType = rule.simulationMode || !appConfig.enableRealTrading ? 'simulation' : 'real'

    return {
      mode,
      exchange: rule.exchange,
      symbol: rule.symbol,
      side: rule.side,
      orderType: rule.orderType,
      // 规则中填写计价币金额时，不能在这里提前换算基础币数量。
      // 交易执行预览会按最新行情和交易所 lotSize 统一换算并向下取整。
      baseQuantity: rule.baseQuantity,
      quoteAmount: rule.quoteAmount,
      limitPrice: rule.limitPrice,
    }
  }

  private resolveBaseQuantity(input: TradeOrderPreviewInput, executionPrice: Decimal, instrumentRule?: InstrumentRule) {
    if (input.baseQuantity) {
      return new Decimal(input.baseQuantity)
    }

    const rawQuantity = new Decimal(input.quoteAmount ?? '0').div(executionPrice)
    // 计价币金额换算出来的基础币数量通常会有很多小数位，需要按交易所 lotSize 向下取整后再进入预览和成交。
    return this.floorToStep(rawQuantity, instrumentRule?.lotSize)
  }

  private floorToStep(value: Decimal, step?: string) {
    const decimalStep = new Decimal(step || '0')
    if (decimalStep.lessThanOrEqualTo(0)) {
      return value
    }

    return value.div(decimalStep).floor().mul(decimalStep)
  }

  private buildCheckItems(context: {
    input: TradeOrderPreviewInput
    instrumentRule?: InstrumentRule
    executionPrice: Decimal
    baseQuantity: Decimal
    quoteAmount: Decimal
    feeAmount: Decimal
    account?: TradeAccount
    position?: TradePosition
    realBalances: AccountBalance[]
  }): TradeOrderCheckItem[] {
    const items: TradeOrderCheckItem[] = []
    const { input, instrumentRule, executionPrice, baseQuantity, quoteAmount, feeAmount, account, position, realBalances } = context
    const riskConfig = this.riskConfigService.getConfig()

    items.push({
      code: 'instrument.exists',
      passed: Boolean(instrumentRule),
      message: instrumentRule ? '交易对存在' : '交易对不存在或暂不支持',
    })

    if (instrumentRule) {
      items.push({
        code: 'instrument.state',
        passed: instrumentRule.state === 'live',
        message: instrumentRule.state === 'live' ? '交易对处于可交易状态' : `交易对当前状态为 ${instrumentRule.state}`,
      })
      items.push(this.checkStep('price.step', executionPrice, instrumentRule.tickSize, `价格需符合最小变动单位 ${instrumentRule.tickSize}`))
      items.push(this.checkStep('quantity.step', baseQuantity, instrumentRule.lotSize, `数量需符合最小变动单位 ${instrumentRule.lotSize}`))
      items.push({
        code: 'quantity.min',
        passed: baseQuantity.greaterThanOrEqualTo(instrumentRule.minSize),
        message: `基础币数量 ${baseQuantity.toFixed()}，最小下单数量 ${instrumentRule.minSize}`,
      })
      if (instrumentRule.minNotional) {
        items.push({
          code: 'notional.min',
          passed: quoteAmount.greaterThanOrEqualTo(instrumentRule.minNotional),
          message: `成交额 ${quoteAmount.toFixed()}，最小成交额 ${instrumentRule.minNotional}`,
        })
      }
    }

    items.push({
      code: 'amount.positive',
      passed: executionPrice.greaterThan(0) && baseQuantity.greaterThan(0) && quoteAmount.greaterThan(0),
      message: `预估成交价 ${executionPrice.toFixed()}，数量 ${baseQuantity.toFixed()}，成交额 ${quoteAmount.toFixed()}`,
    })

    if (input.mode === 'real') {
      items.push({
        code: 'real.switch',
        passed: appConfig.enableRealTrading && riskConfig.tradingMode === 'allow_real',
        message: appConfig.enableRealTrading && riskConfig.tradingMode === 'allow_real' ? '真实交易开关允许' : '真实交易未开启或风控模式不允许',
      })
      const balanceError = realBalances.find(balance => balance.error)?.error
      items.push({
        code: 'real.balance_query',
        passed: !balanceError,
        message: balanceError ? `真实余额查询失败：${balanceError}` : '真实余额查询完成',
      })
    }

    if (input.side === 'buy') {
      const availableQuote = input.mode === 'real' ? this.findBalance(realBalances, instrumentRule?.quoteCurrency ?? 'USDT') : new Decimal(account?.availableQuoteBalance ?? 0)
      items.push({
        code: 'balance.quote',
        passed: availableQuote.greaterThanOrEqualTo(quoteAmount.plus(feeAmount)),
        message: `可用 ${instrumentRule?.quoteCurrency ?? 'USDT'} ${availableQuote.toFixed()}，需要 ${quoteAmount.plus(feeAmount).toFixed()}`,
      })
    } else {
      const availableBase = input.mode === 'real' ? this.findBalance(realBalances, instrumentRule?.baseCurrency ?? input.symbol.split('-')[0]) : new Decimal(position?.availableQuantity ?? 0)
      items.push({
        code: 'balance.base',
        passed: availableBase.greaterThanOrEqualTo(baseQuantity),
        message: `可卖 ${instrumentRule?.baseCurrency ?? '基础币'} ${availableBase.toFixed()}，需要 ${baseQuantity.toFixed()}`,
      })
    }

    return items
  }

  private checkStep(code: string, value: Decimal, step: string, message: string): TradeOrderCheckItem {
    const decimalStep = new Decimal(step || '0')
    return {
      code,
      passed: decimalStep.isZero() || value.mod(decimalStep).isZero(),
      message,
    }
  }

  private async safeGetRealBalances(exchange: ExchangeCode, currencies: string[]) {
    const adapter = this.exchangeFactory.getAdapter(exchange)
    if (!adapter.getAccountBalances) {
      return []
    }

    try {
      return await adapter.getAccountBalances(currencies)
    } catch (error) {
      return currencies.map(currency => ({
        currency,
        available: '0',
        locked: '0',
        total: '0',
        error: error instanceof Error ? error.message : '余额查询失败',
      })) as AccountBalance[]
    }
  }

  private findBalance(balances: AccountBalance[], currency: string) {
    return new Decimal(balances.find(balance => balance.currency === currency.toUpperCase())?.available ?? 0)
  }

  private calculateNextQuoteBalance(mode: TradeAccountType, side: string, account: TradeAccount | undefined, balances: AccountBalance[], quoteCurrency: string, quoteAmount: Decimal, feeAmount: Decimal) {
    const current = mode === 'real' ? this.findBalance(balances, quoteCurrency) : new Decimal(account?.availableQuoteBalance ?? 0)
    return side === 'buy' ? current.minus(quoteAmount).minus(feeAmount) : current.plus(quoteAmount).minus(feeAmount)
  }

  private calculateNextBaseQuantity(side: string, position: TradePosition | undefined, baseQuantity: Decimal) {
    const current = new Decimal(position?.availableQuantity ?? 0)
    return side === 'buy' ? current.plus(baseQuantity) : current.minus(baseQuantity)
  }

  private estimateRealizedPnl(side: string, position: TradePosition | undefined, baseQuantity: Decimal, quoteAmount: Decimal, feeAmount: Decimal) {
    if (side !== 'sell' || !position) {
      return new Decimal(0)
    }

    return quoteAmount.minus(feeAmount).minus(new Decimal(position.avgCostPrice).mul(baseQuantity))
  }

  private applySimulationFill(account: TradeAccount, preview: TradeOrderPreview, order: OrderRecord, now: string) {
    const baseCurrency = preview.symbol.split('-')[0]
    const baseQuantity = new Decimal(preview.baseQuantity)
    const quoteAmount = new Decimal(preview.quoteAmount)
    const feeAmount = new Decimal(preview.feeAmount)
    const currentPosition = this.tradeAccountRepository.findPosition(account.id, preview.symbol)
    const nextAccount = {
      ...account,
      availableQuoteBalance: preview.nextAvailableQuoteBalance,
      updatedAt: now,
    }
    this.tradeAccountRepository.updateAccountBalance(nextAccount)
    this.tradeAccountRepository.upsertPosition(this.buildNextPosition(account, preview, currentPosition, now))
    this.tradeAccountRepository.createFill({
      id: nanoid(),
      accountId: account.id,
      orderId: order.id,
      accountType: 'simulation',
      exchange: preview.exchange,
      symbol: preview.symbol,
      side: preview.side,
      price: preview.executionPrice,
      baseQuantity: baseQuantity.toFixed(),
      quoteAmount: quoteAmount.toFixed(),
      feeAmount: feeAmount.toFixed(),
      feeCurrency: preview.feeCurrency,
      realizedPnl: preview.estimatedRealizedPnl,
      rawMessage: '模拟撮合即时成交',
      createdAt: now,
    })
    this.tradeAccountRepository.createOperationLog({
      id: nanoid(),
      accountId: account.id,
      accountType: 'simulation',
      exchange: preview.exchange,
      level: 'info',
      action: preview.side === 'buy' ? 'trade.buy.filled' : 'trade.sell.filled',
      message: `${preview.symbol} 模拟${preview.side === 'buy' ? '买入' : '卖出'}成交，数量 ${preview.baseQuantity} ${baseCurrency}`,
      payloadJson: JSON.stringify({
        orderId: order.id,
        price: preview.executionPrice,
        quoteAmount: preview.quoteAmount,
        feeAmount: preview.feeAmount,
        realizedPnl: preview.estimatedRealizedPnl,
      }),
      createdAt: now,
    })
  }

  private buildNextPosition(account: TradeAccount, preview: TradeOrderPreview, current: TradePosition | undefined, now: string): TradePosition {
    const baseCurrency = preview.symbol.split('-')[0]
    const baseQuantity = new Decimal(preview.baseQuantity)
    const quoteAmount = new Decimal(preview.quoteAmount)
    const feeAmount = new Decimal(preview.feeAmount)
    const currentQuantity = new Decimal(current?.quantity ?? 0)
    const currentCost = new Decimal(current?.costAmount ?? 0)
    const currentRealizedPnl = new Decimal(current?.realizedPnl ?? 0)
    const currentFee = new Decimal(current?.feeAmount ?? 0)

    if (preview.side === 'buy') {
      const nextQuantity = currentQuantity.plus(baseQuantity)
      const nextCost = currentCost.plus(quoteAmount).plus(feeAmount)
      return {
        id: current?.id ?? nanoid(),
        accountId: account.id,
        accountType: 'simulation',
        exchange: preview.exchange,
        symbol: preview.symbol,
        baseCurrency,
        quoteCurrency: preview.feeCurrency,
        quantity: nextQuantity.toFixed(),
        availableQuantity: nextQuantity.toFixed(),
        lockedQuantity: current?.lockedQuantity ?? '0',
        avgCostPrice: nextQuantity.isZero() ? '0' : nextCost.div(nextQuantity).toFixed(),
        costAmount: nextCost.toFixed(),
        realizedPnl: currentRealizedPnl.toFixed(),
        feeAmount: currentFee.plus(feeAmount).toFixed(),
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      }
    }

    const nextQuantity = currentQuantity.minus(baseQuantity)
    const sellCost = new Decimal(current?.avgCostPrice ?? 0).mul(baseQuantity)
    const nextCost = Decimal.max(currentCost.minus(sellCost), 0)
    return {
      id: current?.id ?? nanoid(),
      accountId: account.id,
      accountType: 'simulation',
      exchange: preview.exchange,
      symbol: preview.symbol,
      baseCurrency,
      quoteCurrency: preview.feeCurrency,
      quantity: nextQuantity.toFixed(),
      availableQuantity: nextQuantity.toFixed(),
      lockedQuantity: current?.lockedQuantity ?? '0',
      avgCostPrice: nextQuantity.isZero() ? '0' : nextCost.div(nextQuantity).toFixed(),
      costAmount: nextCost.toFixed(),
      realizedPnl: currentRealizedPnl.plus(preview.estimatedRealizedPnl).toFixed(),
      feeAmount: currentFee.plus(feeAmount).toFixed(),
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    }
  }

  private createValuationContext(): ValuationContext {
    return {
      tickerPriceCache: new Map(),
    }
  }

  private async getCachedTickerPrice(context: ValuationContext, exchange: ExchangeCode, symbol: string): Promise<TickerPrice> {
    const cacheKey = `${exchange}:${symbol}`
    const cached = context.tickerPriceCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const tickerPromise = this.exchangeFactory.getAdapter(exchange).getLatestPrice(symbol)
    context.tickerPriceCache.set(cacheKey, tickerPromise)
    return tickerPromise
  }

  private async toPositionView(position: TradePosition, context: ValuationContext): Promise<TradePositionView> {
    const latestTicker = await this.getCachedTickerPrice(context, position.exchange, position.symbol)
    const marketValue = new Decimal(position.quantity).mul(latestTicker.price)
    const unrealizedPnl = marketValue.minus(position.costAmount)
    const costAmount = new Decimal(position.costAmount)
    return {
      ...position,
      marketPrice: latestTicker.price,
      marketEventTime: latestTicker.eventTime,
      marketValue: marketValue.toFixed(),
      unrealizedPnl: unrealizedPnl.toFixed(),
      unrealizedPnlPercent: costAmount.isZero() ? '0' : unrealizedPnl.div(costAmount).mul(100).toFixed(2),
    }
  }

  private async toAccountSummary(account: TradeAccount, context: ValuationContext): Promise<TradeAccountSummary> {
    const positions = this.tradeAccountRepository.listPositions(account.accountType, account.exchange).filter(position => position.accountId === account.id)
    const views = await Promise.all(positions.map(position => this.toPositionView(position, context)))
    const positionMarketValue = views.reduce((sum, position) => sum.plus(position.marketValue), new Decimal(0))
    const unrealizedPnl = views.reduce((sum, position) => sum.plus(position.unrealizedPnl), new Decimal(0))
    const realizedPnl = views.reduce((sum, position) => sum.plus(position.realizedPnl), new Decimal(0))
    const totalEquity = new Decimal(account.availableQuoteBalance).plus(account.lockedQuoteBalance).plus(positionMarketValue)
    const totalPnl = totalEquity.minus(account.initialEquity)
    const initialEquity = new Decimal(account.initialEquity)

    return {
      accountId: account.id,
      mode: account.accountType,
      exchange: account.exchange,
      quoteCurrency: account.quoteCurrency,
      initialEquity: account.initialEquity,
      availableQuoteBalance: account.availableQuoteBalance,
      lockedQuoteBalance: account.lockedQuoteBalance,
      positionMarketValue: positionMarketValue.toFixed(),
      totalEquity: totalEquity.toFixed(),
      realizedPnl: realizedPnl.toFixed(),
      unrealizedPnl: unrealizedPnl.toFixed(),
      totalPnl: totalPnl.toFixed(),
      totalPnlPercent: initialEquity.isZero() ? '0' : totalPnl.div(initialEquity).mul(100).toFixed(2),
      calculatedAt: new Date().toISOString(),
    }
  }

  private toEquitySnapshot(summary: TradeAccountSummary, snapshotDate: string, now: string): TradeEquitySnapshot {
    return {
      id: `equity-${summary.accountId}-${snapshotDate}`,
      accountId: summary.accountId,
      mode: summary.mode,
      exchange: summary.exchange,
      quoteCurrency: summary.quoteCurrency,
      snapshotDate,
      totalEquity: summary.totalEquity,
      availableQuoteBalance: summary.availableQuoteBalance,
      lockedQuoteBalance: summary.lockedQuoteBalance,
      positionMarketValue: summary.positionMarketValue,
      realizedPnl: summary.realizedPnl,
      unrealizedPnl: summary.unrealizedPnl,
      totalPnl: summary.totalPnl,
      totalPnlPercent: summary.totalPnlPercent,
      createdAt: now,
      updatedAt: now,
    }
  }

  private buildEquityHistoryPoints(
    account: TradeAccount,
    snapshots: TradeEquitySnapshot[],
    latestBefore: TradeEquitySnapshot | undefined,
    fromDate: string,
    days: number,
  ): TradeEquityHistoryPoint[] {
    const snapshotByDate = new Map(snapshots.map(snapshot => [snapshot.snapshotDate, snapshot]))
    let carriedSnapshot = latestBefore

    return Array.from({ length: days }, (_, index) => {
      const date = this.shiftDate(fromDate, index)
      const snapshot = snapshotByDate.get(date)
      if (snapshot) {
        carriedSnapshot = snapshot
      }

      return {
        accountId: account.id,
        mode: account.accountType,
        exchange: account.exchange,
        quoteCurrency: account.quoteCurrency,
        date,
        totalEquity: snapshot?.totalEquity ?? carriedSnapshot?.totalEquity ?? account.initialEquity,
        source: snapshot ? 'snapshot' : carriedSnapshot ? 'carried' : 'initial',
      }
    })
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private shiftDate(dateText: string, offsetDays: number): string {
    const [year, month, day] = dateText.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() + offsetDays)
    return this.formatLocalDate(date)
  }
}
