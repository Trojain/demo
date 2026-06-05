import { z } from 'zod'
import { Decimal } from 'decimal.js'

const positiveDecimalString = z.string().refine(value => {
  try {
    const decimal = new Decimal(value)
    return decimal.isFinite() && decimal.greaterThan(0)
  } catch {
    return false
  }
}, '必须是大于 0 的数字字符串')

export const createRuleSchema = z
  .object({
    /** 交易所编码，当前 okx 可用，binance 预留 */
    exchange: z.enum(['okx', 'binance']),
    /** 统一交易对，例如 BTC-USDT */
    symbol: z.string().min(3),
    /** gte 表示价格上穿，lte 表示价格下穿 */
    operator: z.enum(['gte', 'lte']),
    /** 目标价格，字符串可以避免浮点精度问题 */
    targetPrice: z.string().min(1),
    /** 检测频率，单位毫秒 */
    checkIntervalMs: z.number().int().min(1000),
    /** 买入或卖出 */
    side: z.enum(['buy', 'sell']),
    /** 市价或限价 */
    orderType: z.enum(['market', 'limit']),
    /** 基础币数量，例如 BTC 数量 */
    baseQuantity: z.string().optional(),
    /** 计价币金额，例如 USDT 金额 */
    quoteAmount: z.string().optional(),
    /** 限价单价格 */
    limitPrice: z.string().optional(),
    /** 最大滑点百分比 */
    maxSlippagePercent: z.string().default('0.5'),
    /** 冷却时间，单位毫秒 */
    cooldownMs: z.number().int().min(1000).default(60000),
    /** 最大触发次数 */
    maxTriggerCount: z.number().int().min(1).default(1),
    /** 是否模拟下单 */
    simulationMode: z.boolean().default(true),
    /** 是否启用 */
    enabled: z.boolean().default(true),
  })
  .refine(data => data.baseQuantity || data.quoteAmount, {
    message: 'baseQuantity 和 quoteAmount 至少填写一个',
  })
  .refine(data => !(data.baseQuantity && data.quoteAmount), {
    message: 'baseQuantity 和 quoteAmount 只能填写一个',
  })
  .refine(data => data.orderType === 'market' || data.limitPrice, {
    message: '限价单必须填写 limitPrice',
  })

export const toggleRuleSchema = z.object({
  /** 是否启用监控规则 */
  enabled: z.boolean(),
})

export const updateRuleSchema = createRuleSchema

export type CreateRuleInput = z.infer<typeof createRuleSchema>

export const idParamSchema = z.object({
  /** 数据库记录 ID */
  id: z.string().min(1),
})

export const confirmOrderSchema = z.object({
  /** 待确认的触发事件 ID */
  triggerId: z.string().min(1),
})

export const previewOrderSchema = z.object({
  /** 待预览的触发事件 ID */
  triggerId: z.string().min(1),
})

export const marketCandlesQuerySchema = z.object({
  /** 交易所编码 */
  exchange: z.enum(['okx', 'binance']).default('okx'),
  /** K 线交易对，当前总览页支持固定 USDT 交易对 */
  symbol: z.string().default('BTC-USDT'),
  /** K 线周期，10s 由后端基于官方 1s K 线聚合生成 */
  bar: z.enum(['1s', '10s', '1m', '5m', '15m']).default('10s'),
})

export const marketCandleSubscriptionMessageSchema = z.object({
  /** 本地 WebSocket 消息类型 */
  type: z.literal('market.candle.subscribe'),
  /** 当前图表需要订阅的 K 线参数 */
  payload: marketCandlesQuerySchema,
})

export const listSignalsQuerySchema = z.object({
  /** 返回交易信号数量，限制最大值避免一次性读取过多 SQLite 记录 */
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export const createExternalSignalSchema = z.object({
  /** 关联规则 ID，外部信号沿用规则上的交易参数与风控配置。 */
  ruleId: z.string().min(1),
  /** 外部信号对应的市场价格。 */
  marketPrice: positiveDecimalString,
  /** 行情事件时间，不传时由服务端回退当前时间。 */
  marketEventTime: z.string().datetime().optional(),
  /** 外部信号原因说明。 */
  reason: z.string().min(1),
  /** 外部信号来源键，建议由上游系统提供稳定值。 */
  sourceKey: z.string().min(1).optional(),
  /** 外部信号来源标签，例如 webhook、research、manual。 */
  sourceLabel: z.string().min(1).optional(),
  /** 外部信号附加上下文。 */
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const listAuditLogsQuerySchema = z.object({
  /** 返回审计日志数量，限制最大值避免一次性读取过多 SQLite 记录 */
  limit: z.coerce.number().int().min(1).max(500).default(100),
  /** 按动作筛选，多个动作使用逗号分隔 */
  actions: z.string().optional(),
  /** 按日志级别筛选，多个级别使用逗号分隔 */
  levels: z.string().optional(),
})

export const listAuditLogsPageQuerySchema = z.object({
  /** 当前页码，从 1 开始 */
  page: z.coerce.number().int().min(1).default(1),
  /** 分页大小，限制最大值避免一次性读取过多 SQLite 记录 */
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /** 按动作筛选，多个动作使用逗号分隔 */
  actions: z.string().optional(),
  /** 按日志级别筛选，多个级别使用逗号分隔 */
  levels: z.string().optional(),
})

export const listOrderRecoveriesPageQuerySchema = z.object({
  /** 当前页码，从 1 开始 */
  page: z.coerce.number().int().min(1).default(1),
  /** 分页大小 */
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /** 按恢复状态筛选，多个状态使用逗号分隔 */
  statuses: z.string().optional(),
  /** 按失败阶段筛选，多个阶段使用逗号分隔 */
  stages: z.string().optional(),
})

export const listRiskChecksQuerySchema = z.object({
  /** 返回风控检查数量，限制最大值避免一次性读取过多 SQLite 记录 */
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export const listDailyRiskStatsQuerySchema = z.object({
  /** 返回最近多少天的日维度统计。 */
  days: z.coerce.number().int().min(1).max(90).default(7),
})

export const tradeAccountQuerySchema = z.object({
  /** 下单模式，不传时返回全部模式数据 */
  mode: z.enum(['simulation', 'real']).optional(),
})

export const tradePositionQuerySchema = z.object({
  /** 下单模式，不传时返回全部模式数据 */
  mode: z.enum(['simulation', 'real']).optional(),
  /** 交易所编码，不传时返回全部交易所数据 */
  exchange: z.enum(['okx', 'binance']).optional(),
})

export const tradeEquityHistoryQuerySchema = z.object({
  /** 下单模式，不传时返回全部模式数据 */
  mode: z.enum(['simulation', 'real']).optional(),
  /** 交易所编码，不传时返回全部交易所数据 */
  exchange: z.enum(['okx', 'binance']).optional(),
  /** 返回最近多少天的总资产曲线，默认 30 天 */
  days: z.coerce.number().int().min(1).max(365).default(30),
})

export const listTradeRecordsQuerySchema = z.object({
  /** 下单模式，不传时返回全部模式数据 */
  mode: z.enum(['simulation', 'real']).optional(),
  /** 交易所编码，不传时返回全部交易所数据 */
  exchange: z.enum(['okx', 'binance']).optional(),
  /** 返回记录数量，限制最大值避免一次性读取过多 SQLite 记录 */
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export const tradeOrderPreviewSchema = z
  .object({
    /** 下单模式，当前真实交易仍受总开关保护 */
    mode: z.enum(['simulation', 'real']).default('simulation'),
    /** 交易所编码 */
    exchange: z.enum(['okx', 'binance']),
    /** 统一交易对，例如 BTC-USDT */
    symbol: z.string().min(3),
    /** 买入或卖出 */
    side: z.enum(['buy', 'sell']),
    /** 市价或限价 */
    orderType: z.enum(['market', 'limit']).default('market'),
    /** 基础币数量 */
    baseQuantity: z.string().optional(),
    /** 计价币金额 */
    quoteAmount: z.string().optional(),
    /** 限价价格 */
    limitPrice: z.string().optional(),
  })
  .refine(data => data.baseQuantity || data.quoteAmount, {
    message: 'baseQuantity 和 quoteAmount 至少填写一个',
  })
  .refine(data => !(data.baseQuantity && data.quoteAmount), {
    message: 'baseQuantity 和 quoteAmount 只能填写一个',
  })
  .refine(data => data.orderType === 'market' || data.limitPrice, {
    message: '限价单必须填写 limitPrice',
  })

export const tradeOrderConfirmSchema = z.object({
  /** 待确认的交易预览参数，后端会重新计算最终结果 */
  preview: tradeOrderPreviewSchema,
  /** 预检阶段返回的确认令牌，用于真实下单二次确认和幂等保护 */
  confirmToken: z.string().min(1).optional(),
})

export type TradeOrderPreviewInput = z.infer<typeof tradeOrderPreviewSchema>

export const simulationExchangeQuerySchema = z.object({
  /** 模拟账户所属交易所，不传时返回全部模拟账户数据 */
  exchange: z.enum(['okx', 'binance']).optional(),
})

export const listSimulationRecordsQuerySchema = z.object({
  /** 模拟账户所属交易所，不传时返回全部交易所数据 */
  exchange: z.enum(['okx', 'binance']).optional(),
  /** 返回记录数量，限制最大值避免一次性读取过多 SQLite 记录 */
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export const updateRiskConfigSchema = z.object({
  /** 单笔最大计价金额 */
  maxQuoteAmount: positiveDecimalString,
  /** 行情最大允许延迟，单位毫秒 */
  maxMarketAgeMs: z.number().int().min(1000),
  /** 每日最大通过风控次数 */
  dailyMaxTriggerCount: z.number().int().min(1),
  /** 每日最大通过风控计价金额 */
  dailyMaxQuoteAmount: positiveDecimalString,
  /** 交易模式 */
  tradingMode: z.enum(['simulation_only', 'allow_real']),
})

export const listDailyReportQuerySchema = z.object({
  /** 返回最近多少天的日报表，默认 30 天 */
  days: z.coerce.number().int().min(1).max(90).default(30),
  /** 交易所编码，不传时返回全部交易所数据 */
  exchange: z.enum(['okx', 'binance']).optional(),
  /** 下单模式，不传时返回模拟和真实数据合并结果 */
  mode: z.enum(['simulation', 'real']).optional(),
})

