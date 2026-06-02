import { appConfig } from '../config/env.js'
import type { ExchangeCode } from '../types/domain.js'

/**
 * 解析指定交易所当前对应的交易环境标签。
 * 统一收口后，审计日志、健康检查和执行链路都复用同一套文案，避免多处漂移。
 */
export function resolveTradingEnvironmentLabel(exchange: ExchangeCode): string {
  if (exchange === 'binance') {
    return resolveBinanceTradingEnvironmentLabel()
  }

  return resolveOkxTradingEnvironmentLabel()
}

/** 返回 OKX 当前交易环境标签。 */
export function resolveOkxTradingEnvironmentLabel(): string {
  return appConfig.okx.simulated ? 'OKX 模拟盘' : 'OKX 实盘'
}

/** 返回 Binance 当前交易环境标签。 */
export function resolveBinanceTradingEnvironmentLabel(): string {
  return `Binance ${appConfig.binance.environmentLabel}`
}
