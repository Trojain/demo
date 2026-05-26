export type ExchangeCode = 'okx' | 'binance';

export type TriggerOperator = 'gte' | 'lte';

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit';

export type TriggerStatus = 'pending' | 'confirmed' | 'ignored';

export type RuleRuntimeStatus = 'idle' | 'running' | 'paused' | 'limit_reached' | 'error';

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
