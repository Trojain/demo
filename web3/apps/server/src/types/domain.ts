export type ExchangeCode = 'okx' | 'binance';

export type TriggerOperator = 'gte' | 'lte';

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit';

export type TriggerStatus = 'pending' | 'confirmed' | 'ignored';

export type SignalStatus = 'pending' | 'converted' | 'rejected' | 'expired';

export type RiskCheckStatus = 'passed' | 'rejected';

export type RiskTradingMode = 'simulation_only' | 'allow_real';

export type RuleRuntimeStatus = 'idle' | 'running' | 'paused' | 'limit_reached' | 'error';

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
  | 'order.failed'
  | 'strategy.error';

export type UnifiedOrderStatus =
  | 'submitted'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'failed';

export interface MonitorRule {
  /** 规则主键，使用 nanoid 方便前后端展示 */
  id: string;
  /** 交易所编码，当前支持 okx，binance 为预留 */
  exchange: ExchangeCode;
  /** 统一交易对，前端建议使用 BTC-USDT 这类可读格式 */
  symbol: string;
  /** 触发方向，gte 表示大于等于目标价，lte 表示小于等于目标价 */
  operator: TriggerOperator;
  /** 目标价格，使用字符串避免浮点精度问题 */
  targetPrice: string;
  /** 检测频率，单位毫秒 */
  checkIntervalMs: number;
  /** 买入或卖出方向 */
  side: OrderSide;
  /** 下单类型，第一版支持市价和限价 */
  orderType: OrderType;
  /** 基础币数量，例如 BTC 数量 */
  baseQuantity?: string;
  /** 计价币金额，例如 USDT 金额 */
  quoteAmount?: string;
  /** 限价单价格，市价单可为空 */
  limitPrice?: string;
  /** 最大滑点百分比，例如 0.5 表示 0.5% */
  maxSlippagePercent: string;
  /** 触发冷却时间，单位毫秒 */
  cooldownMs: number;
  /** 单条规则最大触发次数 */
  maxTriggerCount: number;
  /** 已触发次数 */
  triggeredCount: number;
  /** 是否启用模拟下单，第一版默认开启 */
  simulationMode: boolean;
  /** 是否启用规则 */
  enabled: boolean;
  /** 运行状态，便于前端判断策略是否正常扫描 */
  runtimeStatus: RuleRuntimeStatus;
  /** 最近一次运行错误，策略或行情异常时写入 */
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

export interface TriggerEvent {
  /** 触发事件主键 */
  id: string;
  /** 关联监控规则 ID */
  ruleId: string;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 触发时市场价格 */
  marketPrice: string;
  /** 规则目标价格 */
  targetPrice: string;
  /** 触发状态，pending 表示等待人工确认 */
  status: TriggerStatus;
  /** 触发时间 */
  createdAt: string;
  /** 确认时间 */
  confirmedAt?: string;
}

export interface TradingSignal {
  /** 信号主键 */
  id: string;
  /** 关联监控规则 ID */
  ruleId: string;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 信号生成时市场价格 */
  marketPrice: string;
  /** 行情事件时间，用于风控判断行情是否过期 */
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

export interface RiskCheck {
  /** 风控检查主键 */
  id: string;
  /** 关联交易信号 ID */
  signalId: string;
  /** 关联监控规则 ID */
  ruleId: string;
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 风控结果 */
  status: RiskCheckStatus;
  /** 风控结论摘要 */
  reason: string;
  /** 信号对应计价币风险敞口 */
  quoteExposure: string;
  /** 信号市场价 */
  marketPrice: string;
  /** 结构化风控明细 JSON 字符串 */
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

export interface OrderPreviewCheckItem {
  /** 检查项编码，方便前端稳定展示 */
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
  /** 触发时市场价格 */
  triggerPrice: string;
  /** 执行参考价，限价单优先使用限价价格，市价单使用触发价格 */
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
  /** 交易规则检查是否通过 */
  tradingRulePassed: boolean;
  /** 交易规则检查明细 */
  tradingRuleItems: OrderPreviewCheckItem[];
  /** 风控预览是否通过 */
  riskPassed: boolean;
  /** 风控预览明细 */
  riskItems: OrderPreviewCheckItem[];
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
  /** 买入或卖出方向 */
  side: OrderSide;
  /** 下单类型 */
  orderType: OrderType;
  /** 基础币数量 */
  baseQuantity?: string;
  /** 计价币金额 */
  quoteAmount?: string;
  /** 委托价格 */
  price?: string;
  /** 交易所订单号，模拟下单时为本地生成 */
  exchangeOrderId: string;
  /** 统一订单状态 */
  status: UnifiedOrderStatus;
  /** 是否模拟订单 */
  simulationMode: boolean;
  /** 交易所响应摘要或错误说明 */
  rawMessage: string;
  /** 创建时间 */
  createdAt: string;
}

export interface AuditLog {
  /** 审计日志主键 */
  id: string;
  /** 日志级别，区分普通记录、警告和错误 */
  level: AuditLogLevel;
  /** 操作动作，使用固定枚举方便前端筛选 */
  action: AuditLogAction;
  /** 关联实体类型，例如 trigger、order、strategy */
  entityType: string;
  /** 关联实体 ID，可为空 */
  entityId?: string;
  /** 关联规则 ID，可为空 */
  ruleId?: string;
  /** 关联触发事件 ID，可为空 */
  triggerId?: string;
  /** 关联订单 ID，可为空 */
  orderId?: string;
  /** 面向用户和排查人员的摘要信息 */
  message: string;
  /** 结构化详情 JSON 字符串，保留关键上下文 */
  payloadJson?: string;
  /** 创建时间 */
  createdAt: string;
}
