import { Decimal } from 'decimal.js'
import { nanoid } from 'nanoid'
import { ExchangeOrderError } from '../exchange/exchange-order-error.js'
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
  TradeOrderQuantityType,
  TradePosition,
  TradePositionView,
} from '../types/domain.js'
import type { AccountBalance, InstrumentRule, TickerPrice } from '../types/exchange.js'
import type { AuditLogService } from './audit-log.service.js'
import type { RiskConfigService } from './risk-config.service.js'
import type { TradingRuleService } from './trading-rule.service.js'

type ValuationContext = {
  /** 单次估值请求内的行情缓存，避免账户汇总、持仓列表重复查询同一交易对最新价 */
  tickerPriceCache: Map<string, Promise<TickerPrice>>
}

type ConfirmTokenState = {
  /** 预检输入摘要，确认时必须与当前请求保持一致。 */
  payloadHash: string
  /** 过期时间戳，避免确认令牌长期驻留内存。 */
  expiresAt: number
  /** 当前确认请求是否正在处理，防止重复提交。 */
  processing: boolean
  /** 已经成功落库的订单 ID，重复确认时直接返回该订单。 */
  orderId?: string
}

const REAL_ORDER_CONFIRM_TOKEN_TTL_MS = 2 * 60_000

export class TradeExecutionError extends Error {
  constructor(
    message: string,
    /** 下单确认前重新生成的预览，便于前端展示拒绝原因 */
    readonly preview: TradeOrderPreview,
    /** 交易所错误码，失败审计和前端提示会使用该字段。 */
    readonly errorCode?: string,
    /** 标准化错误分类，便于日志聚合和后续重试策略。 */
    readonly errorCategory?: string,
    /** 交易所原始错误摘要，主要用于审计日志排查。 */
    readonly rawMessage?: string,
  ) {
    super(message)
    this.name = 'TradeExecutionError'
  }
}

export class TradeExecutionService {
  private readonly confirmTokenStore = new Map<string, ConfirmTokenState>()

  constructor(
    private readonly exchangeFactory: ExchangeFactory,
    private readonly orderRepository: OrderRepository,
    private readonly tradeAccountRepository: TradeAccountRepository,
    private readonly tradingRuleService: TradingRuleService,
    private readonly riskConfigService: RiskConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async preview(input: TradeOrderPreviewInput): Promise<TradeOrderPreview> {
    const exchange = input.exchange
    const symbol = input.symbol.trim().toUpperCase()
    const adapter = this.exchangeFactory.getAdapter(exchange)
    const latestTicker = await adapter.getLatestPrice(symbol)
    const rules = await this.tradingRuleService.listInstrumentRules(exchange)
    const instrumentRule = rules.find(rule => rule.symbol === symbol)
    const executionPrice = new Decimal(input.orderType === 'limit' && input.limitPrice ? input.limitPrice : latestTicker.price)
    const quantityType = this.resolveQuantityType(input)
    const baseQuantity = this.resolveBaseQuantity(input, executionPrice, instrumentRule)
    const quoteAmount = this.resolveQuoteAmount(input, baseQuantity, executionPrice)
    const feeAmount = new Decimal(0)
    const account = this.findAccount(input.mode, exchange, instrumentRule?.quoteCurrency ?? 'USDT')
    const position = account ? this.tradeAccountRepository.findPosition(account.id, symbol) : undefined
    const realBalances = input.mode === 'real' ? await this.safeGetRealBalances(exchange, [instrumentRule?.quoteCurrency ?? 'USDT', instrumentRule?.baseCurrency ?? symbol.split('-')[0]]) : []
    const checkItems = this.buildCheckItems({
      input,
      quantityType,
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

    const preview: TradeOrderPreview = {
      mode: input.mode,
      exchange,
      symbol,
      side: input.side,
      orderType: input.orderType,
      quantityType,
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
    if (input.mode === 'real') {
      preview.confirmToken = this.issueConfirmToken(input)
    }

    return preview
  }

  async confirm(input: TradeOrderPreviewInput, confirmToken?: string): Promise<OrderRecord> {
    const preview = await this.preview(input)
    this.assertPreviewPassed(preview)
    if (preview.mode === 'real') {
      this.assertRealTradingAllowed(preview)
      const confirmedOrder = this.consumeConfirmTokenOrGetExistingOrder(input, confirmToken)
      if (confirmedOrder) {
        return confirmedOrder
      }

      return this.executeRealOrder(preview, {
        source: 'manual',
        confirmToken,
        rawMessage: '真实快捷交易订单已提交到交易所，后续状态同步将在订单轮询和推送链路接入后补齐',
      })
    }

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
    this.assertPreviewPassed(preview)
    if (preview.mode === 'real') {
      this.assertRealTradingAllowed(preview)
      const existingOrder = this.orderRepository.findByTriggerId(input.triggerId)
      if (existingOrder) {
        return existingOrder
      }

      return this.executeRealOrder(preview, {
        source: 'rule',
        triggerId: input.triggerId,
        ruleId: input.rule.id,
        rawMessage: '规则触发后的真实订单已提交到交易所，后续状态同步将在订单轮询和推送链路接入后补齐',
      })
    }

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

  private assertPreviewPassed(preview: TradeOrderPreview) {
    if (!preview.passed) {
      const reason = preview.checkItems.filter(item => !item.passed).map(item => item.message).join('；')
      throw new TradeExecutionError(`交易确认失败：${reason}`, preview)
    }
  }

  private assertRealTradingAllowed(preview: TradeOrderPreview) {
    const riskConfig = this.riskConfigService.getConfig()
    if (!appConfig.enableRealTrading || riskConfig.tradingMode !== 'allow_real') {
      throw new TradeExecutionError('真实交易当前未开放，请检查 ENABLE_REAL_TRADING 和风控交易模式配置', preview)
    }
  }

  private findSimulationAccountOrThrow(preview: TradeOrderPreview) {
    const account = this.findAccount('simulation', preview.exchange, preview.feeCurrency)
    if (!account) {
      throw new TradeExecutionError('模拟账户不存在，请重启后端或检查初始化日志', preview)
    }

    return account
  }

  private async executeRealOrder(
    preview: TradeOrderPreview,
    metadata: {
      /** 手动交易或规则交易来源，后续审计和状态同步会复用该字段。 */
      source: 'manual' | 'rule'
      /** 手动真实下单失败前还没有本地订单 ID，这里保留客户端订单号用于稳定标识本次确认会话。 */
      clientOrderId?: string
      /** 快捷交易真实确认必须携带确认令牌，用于防重复提交。 */
      confirmToken?: string
      /** 规则触发真实成交时保留触发事件 ID。 */
      triggerId?: string
      /** 规则触发真实成交时保留规则 ID。 */
      ruleId?: string
      /** 当前阶段先记录提交语义，后面再由订单同步链路刷新为交易所真实状态。 */
      rawMessage: string
    },
  ) {
    const adapter = this.exchangeFactory.getAdapter(preview.exchange)
    const clientOrderId = this.buildClientOrderId(metadata.source)
    try {
      const exchangeResult = await adapter.placeOrder({
        symbol: preview.symbol,
        side: preview.side,
        type: preview.orderType,
        // 真实下单时严格沿用预检阶段确认过的数量语义，避免适配层再次猜测。
        quoteAmount: preview.orderType === 'market' && preview.quantityType === 'quote' ? preview.quoteAmount : undefined,
        baseQuantity: preview.orderType === 'limit' || preview.quantityType === 'base' ? preview.baseQuantity : undefined,
        price: preview.orderType === 'limit' ? preview.executionPrice : undefined,
        clientOrderId,
        simulationMode: false,
      })

      const order = this.persistRealOrder(preview, exchangeResult, {
        triggerId: metadata.triggerId,
        ruleId: metadata.ruleId,
        fallbackMessage: metadata.rawMessage,
      })
      if (metadata.source === 'manual') {
        this.recordManualRealOrderSubmittedAudit(preview, order, exchangeResult.rawMessage)
      }
      if (metadata.confirmToken) {
        this.markConfirmTokenCompleted(metadata.confirmToken, order.id)
      }

      return order
    } catch (error) {
      if (metadata.confirmToken) {
        this.releaseConfirmToken(metadata.confirmToken)
      }

      const normalizedError = error instanceof ExchangeOrderError
        ? error
        : new ExchangeOrderError({
            exchange: preview.exchange,
            category: 'unknown',
            rawMessage: error instanceof Error ? error.message : '未知错误',
            message: error instanceof Error ? error.message : '真实下单失败',
          })
      if (metadata.source === 'manual') {
        this.recordManualRealOrderFailureAudit(preview, { ...metadata, clientOrderId }, normalizedError)
      }

      throw new TradeExecutionError(
        normalizedError.message,
        preview,
        normalizedError.code,
        normalizedError.category,
        normalizedError.rawMessage,
      )
    }
  }

  private buildClientOrderId(source: 'manual' | 'rule') {
    // OKX 和 Binance 都对客户端订单号长度有限制，这里统一使用短前缀和定长随机串。
    return `${source}_${nanoid(18)}`
  }

  private persistRealOrder(
    preview: TradeOrderPreview,
    exchangeResult: Awaited<ReturnType<ReturnType<ExchangeFactory['getAdapter']>['placeOrder']>>,
    metadata: {
      triggerId?: string
      ruleId?: string
      fallbackMessage: string
    },
  ) {
    return this.tradeAccountRepository.runInTransaction(() => {
      const createdAt = exchangeResult.acceptedAt ?? new Date().toISOString()
      return this.orderRepository.create({
        id: nanoid(),
        triggerId: metadata.triggerId,
        ruleId: metadata.ruleId,
        exchange: preview.exchange,
        symbol: preview.symbol,
        side: preview.side,
        orderType: preview.orderType,
        // 真实订单记录优先保留“已明确知道”的参数，避免把预估成交价和预估成交额当成交易所真实返回。
        baseQuantity: exchangeResult.baseQuantity ?? (preview.orderType === 'limit' || preview.quantityType === 'base' ? preview.baseQuantity : undefined),
        quoteAmount: exchangeResult.quoteAmount ?? (preview.quantityType === 'quote' ? preview.quoteAmount : undefined),
        price: exchangeResult.price ?? (preview.orderType === 'limit' ? preview.executionPrice : undefined),
        exchangeOrderId: exchangeResult.exchangeOrderId,
        status: exchangeResult.status,
        simulationMode: false,
        rawMessage: exchangeResult.rawMessage || metadata.fallbackMessage,
        createdAt,
      })
    })
  }

  private issueConfirmToken(input: TradeOrderPreviewInput) {
    this.cleanupExpiredConfirmTokens()
    const token = nanoid()
    this.confirmTokenStore.set(token, {
      payloadHash: this.buildPreviewPayloadHash(input),
      expiresAt: Date.now() + REAL_ORDER_CONFIRM_TOKEN_TTL_MS,
      processing: false,
    })
    return token
  }

  private consumeConfirmTokenOrGetExistingOrder(input: TradeOrderPreviewInput, confirmToken?: string) {
    if (!confirmToken) {
      throw new Error('真实交易确认缺少 confirmToken，请重新预览后再确认')
    }

    this.cleanupExpiredConfirmTokens()
    const tokenState = this.confirmTokenStore.get(confirmToken)
    if (!tokenState || tokenState.expiresAt < Date.now()) {
      this.confirmTokenStore.delete(confirmToken)
      throw new Error('真实交易确认令牌已过期，请重新预览后再确认')
    }

    if (tokenState.payloadHash !== this.buildPreviewPayloadHash(input)) {
      throw new Error('真实交易确认参数已变化，请重新预览后再确认')
    }

    if (tokenState.orderId) {
      const existingOrder = this.orderRepository.findById(tokenState.orderId)
      if (existingOrder) {
        return existingOrder
      }
    }

    if (tokenState.processing) {
      throw new Error('真实交易确认正在处理中，请稍后刷新成交记录查看结果')
    }

    tokenState.processing = true
    this.confirmTokenStore.set(confirmToken, tokenState)
    return undefined
  }

  private markConfirmTokenCompleted(confirmToken: string, orderId: string) {
    const tokenState = this.confirmTokenStore.get(confirmToken)
    if (!tokenState) {
      return
    }

    tokenState.processing = false
    tokenState.orderId = orderId
    tokenState.expiresAt = Date.now() + REAL_ORDER_CONFIRM_TOKEN_TTL_MS
    this.confirmTokenStore.set(confirmToken, tokenState)
  }

  private releaseConfirmToken(confirmToken: string) {
    const tokenState = this.confirmTokenStore.get(confirmToken)
    if (!tokenState) {
      return
    }

    tokenState.processing = false
    this.confirmTokenStore.set(confirmToken, tokenState)
  }

  private recordManualRealOrderSubmittedAudit(
    preview: TradeOrderPreview,
    order: OrderRecord,
    exchangeRawMessage: string,
  ) {
    this.auditLogService.record({
      action: 'order.submitted',
      entityType: 'order',
      entityId: order.id,
      orderId: order.id,
      message: `${preview.symbol} 真实${preview.side === 'buy' ? '买入' : '卖出'}订单已提交`,
      payload: {
        source: 'manual',
        mode: preview.mode,
        exchange: preview.exchange,
        tradingEnvironment: this.resolveTradingEnvironmentLabel(preview.exchange),
        symbol: preview.symbol,
        side: preview.side,
        orderType: preview.orderType,
        exchangeOrderId: order.exchangeOrderId,
        executionPrice: preview.executionPrice,
        baseQuantity: preview.baseQuantity,
        quoteAmount: preview.quoteAmount,
        rawMessage: exchangeRawMessage,
      },
    })
  }

  private recordManualRealOrderFailureAudit(
    preview: TradeOrderPreview,
    metadata: {
      source: 'manual' | 'rule'
      clientOrderId?: string
      confirmToken?: string
      triggerId?: string
      ruleId?: string
      rawMessage: string
    },
    error: ExchangeOrderError,
  ) {
    this.auditLogService.record({
      level: 'warning',
      action: 'order.failed',
      entityType: 'order',
      entityId: metadata.clientOrderId ?? metadata.confirmToken,
      ruleId: metadata.ruleId,
      triggerId: metadata.triggerId,
      message: `${preview.symbol} 真实${preview.side === 'buy' ? '买入' : '卖出'}下单失败：${error.message}`,
      payload: {
        source: metadata.source,
        clientOrderId: metadata.clientOrderId,
        confirmToken: metadata.confirmToken,
        mode: preview.mode,
        exchange: preview.exchange,
        tradingEnvironment: this.resolveTradingEnvironmentLabel(preview.exchange),
        symbol: preview.symbol,
        side: preview.side,
        orderType: preview.orderType,
        errorCode: error.code,
        errorCategory: error.category,
        errorMessage: error.message,
        rawMessage: error.rawMessage,
        retriable: error.retriable,
        executionPrice: preview.executionPrice,
        baseQuantity: preview.baseQuantity,
        quoteAmount: preview.quoteAmount,
      },
    })
  }

  private cleanupExpiredConfirmTokens() {
    const now = Date.now()
    for (const [token, state] of this.confirmTokenStore.entries()) {
      if (state.expiresAt <= now) {
        this.confirmTokenStore.delete(token)
      }
    }
  }

  private buildPreviewPayloadHash(input: TradeOrderPreviewInput) {
    return JSON.stringify({
      mode: input.mode,
      exchange: input.exchange,
      symbol: input.symbol.trim().toUpperCase(),
      side: input.side,
      orderType: input.orderType,
      baseQuantity: input.baseQuantity ?? '',
      quoteAmount: input.quoteAmount ?? '',
      limitPrice: input.limitPrice ?? '',
    })
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

  private resolveQuantityType(input: TradeOrderPreviewInput): TradeOrderQuantityType {
    return input.baseQuantity ? 'base' : 'quote'
  }

  private resolveBaseQuantity(input: TradeOrderPreviewInput, executionPrice: Decimal, instrumentRule?: InstrumentRule) {
    if (input.baseQuantity) {
      return new Decimal(input.baseQuantity)
    }

    const rawQuantity = new Decimal(input.quoteAmount ?? '0').div(executionPrice)
    // 按计价币金额预估基础币数量时，继续按当前交易对步长向下取整，仅用于预览展示和模拟成交估值。
    return this.floorToStep(rawQuantity, this.resolveQuantityStep(input, instrumentRule))
  }

  private resolveQuoteAmount(input: TradeOrderPreviewInput, baseQuantity: Decimal, executionPrice: Decimal) {
    if (input.quoteAmount) {
      return new Decimal(input.quoteAmount)
    }

    return baseQuantity.mul(executionPrice)
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
    quantityType: TradeOrderQuantityType
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
    const { input, quantityType, instrumentRule, executionPrice, baseQuantity, quoteAmount, feeAmount, account, position, realBalances } = context
    const riskConfig = this.riskConfigService.getConfig()

    items.push({
      code: 'instrument.exists',
      passed: Boolean(instrumentRule),
      message: instrumentRule ? '交易对存在' : '交易对不存在或暂不支持',
    })

    if (instrumentRule) {
      const quantityStep = this.resolveQuantityStep(input, instrumentRule)
      const minQuantity = this.resolveMinQuantity(input, instrumentRule)
      const usesQuoteOrderSizing = this.usesQuoteOrderSizing(input, quantityType)
      items.push({
        code: 'instrument.state',
        passed: instrumentRule.state === 'live',
        message: instrumentRule.state === 'live' ? '交易对处于可交易状态' : `交易对当前状态为 ${instrumentRule.state}`,
      })
      items.push(
        input.orderType === 'limit'
          ? this.checkStep('price.step', executionPrice, instrumentRule.tickSize, `价格需符合最小变动单位 ${instrumentRule.tickSize}`)
          : {
              code: 'price.reference',
              passed: executionPrice.greaterThan(0),
              message: `市价单按实时行情预估，当前参考价 ${executionPrice.toFixed()}`,
            },
      )
      if (usesQuoteOrderSizing) {
        items.push({
          code: 'quantity.estimated',
          passed: baseQuantity.greaterThan(0),
          message: `本次按计价币金额下单，预估基础币数量 ${baseQuantity.toFixed()}`,
        })
      } else {
        items.push(this.checkStep('quantity.step', baseQuantity, quantityStep, `数量需符合最小变动单位 ${quantityStep}`))
        items.push({
          code: 'quantity.min',
          passed: baseQuantity.greaterThanOrEqualTo(minQuantity),
          message: `基础币数量 ${baseQuantity.toFixed()}，最小下单数量 ${minQuantity}`,
        })
      }
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
      items.push({
        code: 'real.environment',
        passed: true,
        message: input.exchange === 'binance'
          ? `Binance 当前使用${appConfig.binance.environmentLabel}`
          : `OKX 当前使用${appConfig.okx.simulated ? '模拟盘' : '实盘'}`,
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

  private usesQuoteOrderSizing(input: TradeOrderPreviewInput, quantityType: TradeOrderQuantityType) {
    return quantityType === 'quote' && input.orderType === 'market'
  }

  private resolveTradingEnvironmentLabel(exchange: ExchangeCode) {
    if (exchange === 'binance') {
      return `Binance ${appConfig.binance.environmentLabel}`
    }

    return `OKX ${appConfig.okx.simulated ? '模拟盘' : '实盘'}`
  }

  private resolveQuantityStep(input: TradeOrderPreviewInput, instrumentRule?: InstrumentRule) {
    if (!instrumentRule) {
      return '0'
    }

    if (input.exchange === 'binance' && input.orderType === 'market') {
      return instrumentRule.marketLotSize ?? instrumentRule.lotSize
    }

    return instrumentRule.lotSize
  }

  private resolveMinQuantity(input: TradeOrderPreviewInput, instrumentRule?: InstrumentRule) {
    if (!instrumentRule) {
      return '0'
    }

    if (input.exchange === 'binance' && input.orderType === 'market') {
      return instrumentRule.marketMinSize ?? instrumentRule.minSize
    }

    return instrumentRule.minSize
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
