import type { ExchangeCode } from '../types/domain.js'

export type ExchangeOrderErrorCategory =
  | 'config'
  | 'auth'
  | 'balance'
  | 'validation'
  | 'rate_limit'
  | 'network'
  | 'exchange'
  | 'unknown'

export class ExchangeOrderError extends Error {
  constructor(input: {
    /** 交易所编码，便于审计日志和前端区分来源。 */
    exchange: ExchangeCode
    /** 标准化错误分类，前端和后续重试策略都可直接复用。 */
    category: ExchangeOrderErrorCategory
    /** 面向用户的可读错误文案。 */
    message: string
    /** 交易所错误码，无法提取时为空。 */
    code?: string
    /** 交易所原始错误摘要，便于日志排查。 */
    rawMessage: string
    /** 是否属于可重试错误，例如限频和网络抖动。 */
    retriable?: boolean
  }) {
    super(input.message)
    this.name = 'ExchangeOrderError'
    this.exchange = input.exchange
    this.category = input.category
    this.code = input.code
    this.rawMessage = input.rawMessage
    this.retriable = input.retriable ?? false
  }

  readonly exchange: ExchangeCode
  readonly category: ExchangeOrderErrorCategory
  readonly code?: string
  readonly rawMessage: string
  readonly retriable: boolean
}

export function normalizeExchangeOrderError(exchange: ExchangeCode, error: unknown): ExchangeOrderError {
  const rawMessage = error instanceof Error ? error.message : '未知错误'
  const errorCode = extractExchangeErrorCode(rawMessage)

  if (exchange === 'okx') {
    return normalizeOkxOrderError(rawMessage, errorCode)
  }

  return normalizeBinanceOrderError(rawMessage, errorCode)
}

function normalizeOkxOrderError(rawMessage: string, errorCode?: string) {
  if (rawMessage.includes('API Key') || rawMessage.includes('Passphrase') || rawMessage.includes('Secret')) {
    return new ExchangeOrderError({
      exchange: 'okx',
      category: 'config',
      code: errorCode,
      rawMessage,
      message: 'OKX API 凭证未配置完整，请检查 API Key、Secret 和 Passphrase',
    })
  }

  if (rawMessage.includes('无法解析或连接') || rawMessage.includes('连接被重置')) {
    return new ExchangeOrderError({
      exchange: 'okx',
      category: 'network',
      code: errorCode,
      rawMessage,
      retriable: true,
      message: 'OKX 网络连接失败，请检查代理、网络和交易所连通性',
    })
  }

  if (errorCode === '50011') {
    return new ExchangeOrderError({
      exchange: 'okx',
      category: 'rate_limit',
      code: errorCode,
      rawMessage,
      retriable: true,
      message: 'OKX 下单触发限频，请稍后重试',
    })
  }

  if (errorCode === '50013') {
    return new ExchangeOrderError({
      exchange: 'okx',
      category: 'exchange',
      code: errorCode,
      rawMessage,
      message: 'OKX 系统维护中，请稍后重试',
    })
  }

  if (errorCode === '50014') {
    return new ExchangeOrderError({
      exchange: 'okx',
      category: 'exchange',
      code: errorCode,
      rawMessage,
      retriable: true,
      message: 'OKX 系统繁忙，请稍后重试',
    })
  }

  if (errorCode === '51008') {
    return new ExchangeOrderError({
      exchange: 'okx',
      category: 'balance',
      code: errorCode,
      rawMessage,
      message: 'OKX 账户余额不足，无法完成本次下单',
    })
  }

  if (errorCode === '51000') {
    return new ExchangeOrderError({
      exchange: 'okx',
      category: 'validation',
      code: errorCode,
      rawMessage,
      message: 'OKX 下单参数不合法，请检查价格、数量和交易对规则',
    })
  }

  if (rawMessage.includes('HTTP 状态码 401') || rawMessage.includes('HTTP 状态码 403') || rawMessage.includes('Signature')) {
    return new ExchangeOrderError({
      exchange: 'okx',
      category: 'auth',
      code: errorCode,
      rawMessage,
      message: 'OKX 鉴权失败，请检查 API 权限、密钥和签名配置',
    })
  }

  return new ExchangeOrderError({
    exchange: 'okx',
    category: errorCode ? 'exchange' : 'unknown',
    code: errorCode,
    rawMessage,
    message: `OKX 下单失败${errorCode ? `，错误码 ${errorCode}` : ''}，请查看审计日志中的原始返回`,
  })
}

function normalizeBinanceOrderError(rawMessage: string, errorCode?: string) {
  if (rawMessage.includes('API Key') || rawMessage.includes('Secret 未配置')) {
    return new ExchangeOrderError({
      exchange: 'binance',
      category: 'config',
      code: errorCode,
      rawMessage,
      message: 'Binance API 凭证未配置完整，请检查 API Key 和 Secret',
    })
  }

  if (rawMessage.includes('无法解析或连接') || rawMessage.includes('连接被重置')) {
    return new ExchangeOrderError({
      exchange: 'binance',
      category: 'network',
      code: errorCode,
      rawMessage,
      retriable: true,
      message: 'Binance 网络连接失败，请检查代理、网络和交易所连通性',
    })
  }

  if (errorCode === '-1003' || errorCode === '-1015') {
    return new ExchangeOrderError({
      exchange: 'binance',
      category: 'rate_limit',
      code: errorCode,
      rawMessage,
      retriable: true,
      message: 'Binance 请求过于频繁，请稍后重试',
    })
  }

  if (errorCode === '-1021') {
    return new ExchangeOrderError({
      exchange: 'binance',
      category: 'validation',
      code: errorCode,
      rawMessage,
      message: 'Binance 请求时间戳无效，请检查服务器时间同步',
    })
  }

  if (errorCode === '-1022' || errorCode === '-2015') {
    return new ExchangeOrderError({
      exchange: 'binance',
      category: 'auth',
      code: errorCode,
      rawMessage,
      message: 'Binance 鉴权失败，请检查 API 权限、IP 白名单和签名配置',
    })
  }

  if (errorCode === '-1100' || errorCode === '-1111' || errorCode === '-1102' || errorCode === '-1121' || errorCode === '-1130') {
    return new ExchangeOrderError({
      exchange: 'binance',
      category: 'validation',
      code: errorCode,
      rawMessage,
      message: 'Binance 下单参数不合法，请检查数量精度、交易对和必填参数',
    })
  }

  if (errorCode === '-2010') {
    if (rawMessage.includes('insufficient balance')) {
      return new ExchangeOrderError({
        exchange: 'binance',
        category: 'balance',
        code: errorCode,
        rawMessage,
        message: 'Binance 账户余额不足，无法完成本次下单',
      })
    }

    return new ExchangeOrderError({
      exchange: 'binance',
      category: 'exchange',
      code: errorCode,
      rawMessage,
      message: 'Binance 撮合引擎拒绝本次订单，请检查交易对状态、余额和订单参数',
    })
  }

  if (errorCode === '-2011') {
    return new ExchangeOrderError({
      exchange: 'binance',
      category: 'validation',
      code: errorCode,
      rawMessage,
      message: 'Binance 撤单失败，目标订单不存在或已完成',
    })
  }

  if (rawMessage.includes('HTTP 状态码 401') || rawMessage.includes('HTTP 状态码 403')) {
    return new ExchangeOrderError({
      exchange: 'binance',
      category: 'auth',
      code: errorCode,
      rawMessage,
      message: 'Binance 鉴权失败，请检查 API 权限和 IP 白名单',
    })
  }

  return new ExchangeOrderError({
    exchange: 'binance',
    category: errorCode ? 'exchange' : 'unknown',
    code: errorCode,
    rawMessage,
    message: `Binance 下单失败${errorCode ? `，错误码 ${errorCode}` : ''}，请查看审计日志中的原始返回`,
  })
}

function extractExchangeErrorCode(message: string) {
  const matchedCode = message.match(/交易所错误码\s*(-?\d+)/)?.[1]
    ?? message.match(/错误码\s*(-?\d+)/)?.[1]
    ?? message.match(/HTTP 状态码\s*(\d+)/)?.[1]

  return matchedCode
}
