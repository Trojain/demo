export type ExchangeCode = 'okx' | 'binance';
export type TriggerOperator = 'gte' | 'lte';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type TriggerStatus = 'pending' | 'confirmed' | 'ignored';
export type RuleRuntimeStatus = 'idle' | 'running' | 'paused' | 'limit_reached' | 'error';
export type AuditLogLevel = 'info' | 'warning' | 'error';
export type AuditLogAction = 'trigger.created' | 'trigger.confirmed' | 'trigger.ignored' | 'order.submitted' | 'order.failed' | 'strategy.error';

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
