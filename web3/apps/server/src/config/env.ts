import path from 'node:path'
import { config } from 'dotenv'
import { Decimal } from 'decimal.js'
import { z } from 'zod'

config()
config({ path: path.resolve(process.cwd(), '../../.env'), override: false })

const booleanString = z.union([z.boolean(), z.string()]).transform(value => {
  if (typeof value === 'boolean') {
    return value
  }

  return value.toLowerCase() === 'true'
})

const decimalString = z.string().refine(value => {
  try {
    return new Decimal(value).isFinite() && new Decimal(value).greaterThan(0)
  } catch {
    return false
  }
}, '必须是大于 0 的数字字符串')

const envSchema = z.object({
  PORT: z.coerce.number().default(3101),
  DATABASE_PATH: z.string().default('./data/web3-trading-tool.db'),
  DEFAULT_EXCHANGE: z.enum(['okx', 'binance']).default('okx'),
  ENABLE_REAL_TRADING: booleanString.default(false),
  EXCHANGE_HTTP_PROXY: z.string().default(''),
  OKX_API_KEY: z.string().default(''),
  OKX_API_SECRET: z.string().default(''),
  OKX_API_PASSPHRASE: z.string().default(''),
  OKX_SIMULATED: booleanString.default(true),
  BINANCE_API_KEY: z.string().default(''),
  BINANCE_API_SECRET: z.string().default(''),
  RISK_MAX_QUOTE_AMOUNT: decimalString.default('1000'),
  RISK_MAX_MARKET_AGE_MS: z.coerce.number().int().min(1000).default(10_000),
  RISK_DAILY_MAX_TRIGGER_COUNT: z.coerce.number().int().min(1).default(20),
  RISK_DAILY_MAX_QUOTE_AMOUNT: decimalString.default('5000'),
  RISK_TRADING_MODE: z.enum(['simulation_only', 'allow_real']).default('simulation_only'),
  SIMULATION_INITIAL_QUOTE_BALANCE: decimalString.default('10000'),
  SIMULATION_QUOTE_CURRENCY: z.string().min(1).default('USDT'),
})

const parsedEnv = envSchema.parse(process.env)

export const appConfig = {
  /** 服务端口，前端 Vite 代理默认访问该端口 */
  port: parsedEnv.PORT,
  /** SQLite 文件位置，使用绝对路径方便日志定位 */
  databasePath: path.resolve(process.cwd(), parsedEnv.DATABASE_PATH),
  /** 默认交易所，新建规则未指定时使用 */
  defaultExchange: parsedEnv.DEFAULT_EXCHANGE,
  /** 真实下单总开关，第一版建议保持关闭 */
  enableRealTrading: parsedEnv.ENABLE_REAL_TRADING,
  /** 交易所 HTTP 代理，例如 http://127.0.0.1:7897，本地网络无法直连交易所时使用 */
  exchangeHttpProxy: parsedEnv.EXCHANGE_HTTP_PROXY,
  okx: {
    /** OKX API Key，真实下单时必填 */
    apiKey: parsedEnv.OKX_API_KEY,
    /** OKX API Secret，真实下单时必填 */
    apiSecret: parsedEnv.OKX_API_SECRET,
    /** OKX Passphrase，真实下单时必填 */
    passphrase: parsedEnv.OKX_API_PASSPHRASE,
    /** OKX 模拟盘标记，后续真实下单时用于请求头 */
    simulated: parsedEnv.OKX_SIMULATED,
  },
  binance: {
    /** Binance API Key，后续接入真实下单时使用 */
    apiKey: parsedEnv.BINANCE_API_KEY,
    /** Binance API Secret，后续接入真实下单时使用 */
    apiSecret: parsedEnv.BINANCE_API_SECRET,
  },
  risk: {
    /** 单笔最大计价金额，例如 USDT 金额，超过后交易信号会被风控拒绝 */
    maxQuoteAmount: parsedEnv.RISK_MAX_QUOTE_AMOUNT,
    /** 行情最大允许延迟，单位毫秒，超过后交易信号会被风控拒绝 */
    maxMarketAgeMs: parsedEnv.RISK_MAX_MARKET_AGE_MS,
    /** 每日最大通过风控次数 */
    dailyMaxTriggerCount: parsedEnv.RISK_DAILY_MAX_TRIGGER_COUNT,
    /** 每日最大通过风控计价金额 */
    dailyMaxQuoteAmount: parsedEnv.RISK_DAILY_MAX_QUOTE_AMOUNT,
    /** 交易模式，simulation_only 表示仅允许模拟交易 */
    tradingMode: parsedEnv.RISK_TRADING_MODE,
  },
  simulation: {
    /** 模拟账户初始本金，按默认计价币种记录，用于纸面交易和收益率计算 */
    initialQuoteBalance: parsedEnv.SIMULATION_INITIAL_QUOTE_BALANCE,
    /** 模拟账户默认计价币种，当前建议使用 USDT */
    quoteCurrency: parsedEnv.SIMULATION_QUOTE_CURRENCY.toUpperCase(),
  },
} as const
