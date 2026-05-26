import { z } from 'zod';

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
    enabled: z.boolean().default(true)
  })
  .refine((data) => data.baseQuantity || data.quoteAmount, {
    message: 'baseQuantity 和 quoteAmount 至少填写一个'
  })
  .refine((data) => data.orderType === 'market' || data.limitPrice, {
    message: '限价单必须填写 limitPrice'
  });

export const toggleRuleSchema = z.object({
  /** 是否启用监控规则 */
  enabled: z.boolean()
});

export const updateRuleSchema = createRuleSchema;

export const confirmOrderSchema = z.object({
  /** 待确认的触发事件 ID */
  triggerId: z.string().min(1)
});

export const marketCandlesQuerySchema = z.object({
  /** K 线交易对，当前总览页支持固定 USDT 交易对 */
  symbol: z.string().default('BTC-USDT'),
  /** K 线周期，1m 会返回最近 24 小时 1440 个点 */
  bar: z.enum(['1m', '5m', '15m']).default('1m')
});
