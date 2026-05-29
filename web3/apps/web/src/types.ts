export type ExchangeCode = 'okx' | 'binance';
export type TriggerOperator = 'gte' | 'lte';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type TriggerStatus = 'pending' | 'confirmed' | 'ignored';
export type SignalStatus = 'pending' | 'converted' | 'rejected' | 'expired';
export type RiskCheckStatus = 'passed' | 'rejected';
export type RiskTradingMode = 'simulation_only' | 'allow_real';
export type RuleRuntimeStatus = 'idle' | 'running' | 'paused' | 'limit_reached' | 'error';
export type TradeAccountType = 'simulation' | 'real';
export type TradeOperationLogLevel = 'info' | 'warning' | 'error';
export type AuditLogLevel = 'info' | 'warning' | 'error';
export type AuditLogAction =
  | 'signal.created'
  | 'signal.converted'
  | 'signal.duplicated'
  | 'risk.passed'
  | 'risk.rejected'
  | 'trigger.created'
  | 'trigger.confirmed'
  | 'trigger.ignored'
  | 'order.submitted'
  | 'order.final_validation_failed'
  | 'order.failed'
  | 'strategy.error';

export interface MonitorRule {
  /** 规则主键 */
  id: string;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 触发方向 */
  operator: TriggerOperator;
  /** 目标价格 */
  targetPrice: string;
  /** 检测频率，单位毫秒 */
  checkIntervalMs: number;
  /** 下单方向 */
  side: OrderSide;
  /** 下单类型 */
  orderType: OrderType;
  /** 基础币数量 */
  baseQuantity?: string;
  /** 计价币金额 */
  quoteAmount?: string;
  /** 限价单价格 */
  limitPrice?: string;
  /** 最大滑点百分比 */
  maxSlippagePercent: string;
  /** 触发冷却时间，单位毫秒 */
  cooldownMs: number;
  /** 最大触发次数 */
  maxTriggerCount: number;
  /** 已触发次数 */
  triggeredCount: number;
  /** 是否模拟下单 */
  simulationMode: boolean;
  /** 是否启用 */
  enabled: boolean;
  /** 运行状态 */
  runtimeStatus: RuleRuntimeStatus;
  /** 最近一次运行错误 */
  lastErrorMessage?: string;
  /** 最近一次检测时间 */
  lastCheckedAt?: string;
  /** 最近一次触发时间 */
  lastTriggeredAt?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

export interface TickerPrice {
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 最新价格 */
  price: string;
  /** 行情时间 */
  eventTime: string;
}

export interface MarketTickerSnapshot extends TickerPrice {
  /** 24 小时开盘价 */
  open24h: string;
  /** 24 小时涨跌幅百分比 */
  changePercent24h: string;
  /** 24 小时基础币成交量 */
  volume24h: string;
  /** 24 小时计价币成交额 */
  volumeCurrency24h: string;
  /** 市值字段预留 */
  marketCap?: string;
}

export interface MarketCandle {
  /** 统一交易对 */
  symbol: string;
  /** K 线时间 */
  time: string;
  /** 开盘价 */
  open: string;
  /** 最高价 */
  high: string;
  /** 最低价 */
  low: string;
  /** 收盘价 */
  close: string;
  /** 基础币成交量 */
  volume: string;
  /** 计价币成交额 */
  volumeCurrency: string;
}

export interface TriggerEvent {
  /** 触发事件主键 */
  id: string;
  /** 关联规则 ID */
  ruleId: string;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 触发时市场价格 */
  marketPrice: string;
  /** 目标价格 */
  targetPrice: string;
  /** 触发状态 */
  status: TriggerStatus;
  /** 触发时间 */
  createdAt: string;
  /** 确认时间 */
  confirmedAt?: string;
}

export interface TradingSignal {
  /** 交易信号主键 */
  id: string;
  /** 关联规则 ID */
  ruleId: string;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 信号生成时市场价格 */
  marketPrice: string;
  /** 行情事件时间 */
  marketEventTime: string;
  /** 规则目标价格 */
  targetPrice: string;
  /** 触发方向 */
  operator: TriggerOperator;
  /** 下单方向 */
  side: OrderSide;
  /** 下单类型 */
  orderType: OrderType;
  /** 基础币数量 */
  baseQuantity?: string;
  /** 计价币金额 */
  quoteAmount?: string;
  /** 限价单价格 */
  limitPrice?: string;
  /** 是否模拟下单 */
  simulationMode: boolean;
  /** 信号状态 */
  status: SignalStatus;
  /** 信号生成原因 */
  reason: string;
  /** 创建时间 */
  createdAt: string;
  /** 转换为触发事件的时间 */
  convertedAt?: string;
}

export interface OrderPreviewCheckItem {
  /** 检查项编码 */
  code: string;
  /** 是否通过 */
  passed: boolean;
  /** 检查项说明 */
  message: string;
}

export interface OrderPreview {
  /** 触发事件 ID */
  triggerId: string;
  /** 关联规则 ID */
  ruleId: string;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 下单方向 */
  side: OrderSide;
  /** 下单类型 */
  orderType: OrderType;
  /** 规则目标价格 */
  targetPrice: string;
  /** 触发价格 */
  triggerPrice: string;
  /** 执行参考价 */
  executionPrice: string;
  /** 基础币数量 */
  baseQuantity?: string;
  /** 计价币金额 */
  quoteAmount?: string;
  /** 预估成交金额 */
  estimatedQuoteAmount: string;
  /** 最大滑点百分比 */
  maxSlippagePercent: string;
  /** 是否模拟交易 */
  simulationMode: boolean;
  /** 交易规则是否通过 */
  tradingRulePassed: boolean;
  /** 交易规则检查明细 */
  tradingRuleItems: OrderPreviewCheckItem[];
  /** 风控是否通过 */
  riskPassed: boolean;
  /** 风控检查明细 */
  riskItems: OrderPreviewCheckItem[];
  /** 交易账户检查是否通过 */
  accountPassed?: boolean;
  /** 交易账户检查明细 */
  accountItems?: OrderPreviewCheckItem[];
  /** 成交后计价币可用余额 */
  nextAvailableQuoteBalance?: string;
  /** 成交后基础币可用数量 */
  nextAvailableBaseQuantity?: string;
  /** 卖出时预计已实现盈亏 */
  estimatedRealizedPnl?: string;
  /** 预览生成时间 */
  previewedAt: string;
}

export interface MarketHealthTicker {
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 最新价格 */
  price: string;
  /** 行情事件时间 */
  eventTime: string;
  /** 本地缓存年龄，单位毫秒 */
  ageMs: number;
}

export interface MarketHealth {
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** REST 是否处于退避中 */
  restBackoffActive: boolean;
  /** REST 退避结束时间 */
  restBackoffUntil?: string;
  /** 最近一次 REST 错误 */
  lastRestError?: string;
  /** 最近一次总览刷新时间 */
  overviewRefreshedAt?: string;
  /** 当前 WebSocket 订阅交易对 */
  subscribedSymbols: string[];
  /** 当前缓存行情 */
  tickers: MarketHealthTicker[];
}

export interface RiskCheck {
  /** 风控检查主键 */
  id: string;
  /** 关联交易信号 ID */
  signalId: string;
  /** 关联规则 ID */
  ruleId: string;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 风控状态 */
  status: RiskCheckStatus;
  /** 风控摘要 */
  reason: string;
  /** 信号对应计价币风险敞口 */
  quoteExposure: string;
  /** 信号市场价 */
  marketPrice: string;
  /** 结构化检查明细 JSON 字符串 */
  itemsJson: string;
  /** 创建时间 */
  createdAt: string;
}

export interface RiskConfig {
  /** 单笔最大计价金额 */
  maxQuoteAmount: string;
  /** 行情最大允许延迟，单位毫秒 */
  maxMarketAgeMs: number;
  /** 每日最大通过风控次数 */
  dailyMaxTriggerCount: number;
  /** 每日最大通过风控计价金额 */
  dailyMaxQuoteAmount: string;
  /** 交易模式 */
  tradingMode: RiskTradingMode;
  /** 更新时间 */
  updatedAt: string;
}

export type UpdateRiskConfigPayload = Omit<RiskConfig, 'updatedAt'>;

export interface DashboardSummary {
  /** 已启用监控规则数量 */
  enabledRuleCount: number;
  /** 监控规则总数 */
  ruleCount: number;
  /** 待人工确认的触发事件数量 */
  pendingTriggerCount: number;
  /** 订单记录总数 */
  orderCount: number;
  /** 当前行情缓存数量 */
  tickerCount: number;
}

export interface TradeAccount {
  /** 账户主键 */
  id: string;
  /** 账户类型 */
  accountType: TradeAccountType;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 默认计价币种 */
  quoteCurrency: string;
  /** 初始权益 */
  initialEquity: string;
  /** 可用计价币余额 */
  availableQuoteBalance: string;
  /** 冻结计价币余额 */
  lockedQuoteBalance: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

export interface TradePosition {
  /** 持仓主键 */
  id: string;
  /** 关联账户 ID */
  accountId: string;
  /** 账户类型 */
  accountType: TradeAccountType;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 基础币种 */
  baseCurrency: string;
  /** 计价币种 */
  quoteCurrency: string;
  /** 当前总持仓数量 */
  quantity: string;
  /** 当前可卖出数量 */
  availableQuantity: string;
  /** 冻结数量 */
  lockedQuantity: string;
  /** 平均持仓成本价 */
  avgCostPrice: string;
  /** 当前剩余持仓成本 */
  costAmount: string;
  /** 已实现盈亏 */
  realizedPnl: string;
  /** 累计手续费金额 */
  feeAmount: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

export interface TradeFill {
  /** 成交记录主键 */
  id: string;
  /** 关联账户 ID */
  accountId: string;
  /** 关联订单 ID */
  orderId?: string;
  /** 账户类型 */
  accountType: TradeAccountType;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 买入或卖出方向 */
  side: OrderSide;
  /** 成交价格 */
  price: string;
  /** 成交基础币数量 */
  baseQuantity: string;
  /** 成交计价币金额 */
  quoteAmount: string;
  /** 手续费金额 */
  feeAmount: string;
  /** 手续费币种 */
  feeCurrency: string;
  /** 本次成交已实现盈亏 */
  realizedPnl: string;
  /** 原始响应或本地撮合说明 */
  rawMessage: string;
  /** 成交时间 */
  createdAt: string;
}

export interface TradeOperationLog {
  /** 操作日志主键 */
  id: string;
  /** 关联账户 ID */
  accountId: string;
  /** 账户类型 */
  accountType: TradeAccountType;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 日志级别 */
  level: TradeOperationLogLevel;
  /** 操作动作 */
  action: string;
  /** 操作摘要 */
  message: string;
  /** 结构化详情 JSON 字符串 */
  payloadJson?: string;
  /** 创建时间 */
  createdAt: string;
}

export interface TradeOrderCheckItem {
  /** 检查项编码 */
  code: string;
  /** 是否通过 */
  passed: boolean;
  /** 检查说明 */
  message: string;
}

export interface TradeOrderPreview {
  /** 下单模式 */
  mode: TradeAccountType;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 下单方向 */
  side: OrderSide;
  /** 下单类型 */
  orderType: OrderType;
  /** 执行参考价 */
  executionPrice: string;
  /** 基础币数量 */
  baseQuantity: string;
  /** 计价币金额 */
  quoteAmount: string;
  /** 手续费金额 */
  feeAmount: string;
  /** 手续费币种 */
  feeCurrency: string;
  /** 卖出时预计已实现盈亏 */
  estimatedRealizedPnl: string;
  /** 成交后计价币可用余额 */
  nextAvailableQuoteBalance: string;
  /** 成交后基础币可用数量 */
  nextAvailableBaseQuantity: string;
  /** 检查项是否全部通过 */
  passed: boolean;
  /** 检查项明细 */
  checkItems: TradeOrderCheckItem[];
  /** 预览生成时间 */
  previewedAt: string;
}

export interface TradeOrderPayload {
  mode: TradeAccountType;
  exchange: ExchangeCode;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  baseQuantity?: string;
  quoteAmount?: string;
  limitPrice?: string;
}

export interface TradePositionView extends TradePosition {
  /** 最新市场价 */
  marketPrice: string;
  /** 最新市场价对应的行情时间 */
  marketEventTime?: string;
  /** 当前持仓市值 */
  marketValue: string;
  /** 浮动盈亏 */
  unrealizedPnl: string;
  /** 浮动收益率百分比 */
  unrealizedPnlPercent: string;
}

export interface TradeAccountSummary {
  /** 账户主键 */
  accountId: string;
  /** 下单模式 */
  mode: TradeAccountType;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 计价币种 */
  quoteCurrency: string;
  /** 初始权益 */
  initialEquity: string;
  /** 可用计价币余额 */
  availableQuoteBalance: string;
  /** 冻结计价币余额 */
  lockedQuoteBalance: string;
  /** 持仓市值 */
  positionMarketValue: string;
  /** 总权益 */
  totalEquity: string;
  /** 已实现盈亏 */
  realizedPnl: string;
  /** 浮动盈亏 */
  unrealizedPnl: string;
  /** 总收益 */
  totalPnl: string;
  /** 总收益率百分比 */
  totalPnlPercent: string;
  /** 统计时间 */
  calculatedAt: string;
}

export type TradeEquityHistorySource = 'snapshot' | 'carried' | 'initial';

export interface TradeEquityHistoryPoint {
  /** 账户主键 */
  accountId: string;
  /** 下单模式 */
  mode: TradeAccountType;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 计价币种 */
  quoteCurrency: string;
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 总资产 */
  totalEquity: string;
  /** 数据来源 */
  source: TradeEquityHistorySource;
}

export interface OrderRecord {
  /** 订单记录主键 */
  id: string;
  /** 关联触发事件 ID */
  triggerId: string;
  /** 关联规则 ID */
  ruleId: string;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 下单方向 */
  side: OrderSide;
  /** 下单类型 */
  orderType: OrderType;
  /** 基础币数量 */
  baseQuantity?: string;
  /** 计价币金额 */
  quoteAmount?: string;
  /** 委托价格 */
  price?: string;
  /** 交易所订单号 */
  exchangeOrderId: string;
  /** 订单状态 */
  status: string;
  /** 是否模拟下单 */
  simulationMode: boolean;
  /** 响应摘要 */
  rawMessage: string;
  /** 创建时间 */
  createdAt: string;
}

export interface AuditLog {
  /** 审计日志主键 */
  id: string;
  /** 日志级别 */
  level: AuditLogLevel;
  /** 审计动作 */
  action: AuditLogAction;
  /** 关联实体类型 */
  entityType: string;
  /** 关联实体 ID */
  entityId?: string;
  /** 关联规则 ID */
  ruleId?: string;
  /** 关联触发事件 ID */
  triggerId?: string;
  /** 关联订单 ID */
  orderId?: string;
  /** 摘要信息 */
  message: string;
  /** 结构化详情 JSON 字符串 */
  payloadJson?: string;
  /** 创建时间 */
  createdAt: string;
}

export interface InstrumentRule {
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 基础币 */
  baseCurrency: string;
  /** 计价币 */
  quoteCurrency: string;
  /** 价格最小变动单位 */
  tickSize: string;
  /** 数量最小变动单位 */
  lotSize: string;
  /** 最小下单数量 */
  minSize: string;
  /** 最小成交额 */
  minNotional?: string;
  /** 交易对状态 */
  state: string;
}

export interface CreateRulePayload {
  exchange: ExchangeCode;
  symbol: string;
  operator: TriggerOperator;
  targetPrice: string;
  checkIntervalMs: number;
  side: OrderSide;
  orderType: OrderType;
  baseQuantity?: string;
  quoteAmount?: string;
  limitPrice?: string;
  maxSlippagePercent: string;
  cooldownMs: number;
  maxTriggerCount: number;
  simulationMode: boolean;
  enabled: boolean;
}

export type UpdateRulePayload = CreateRulePayload;
