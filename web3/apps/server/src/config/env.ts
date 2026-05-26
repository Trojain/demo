import path from 'node:path'
import { config } from 'dotenv'
import { z } from 'zod'

config()
config({ path: path.resolve(process.cwd(), '../../.env'), override: false })

const booleanString = z.union([z.boolean(), z.string()]).transform(value => {
  if (typeof value === 'boolean') {
    return value
  }

  return value.toLowerCase() === 'true'
})

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
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
} as const
