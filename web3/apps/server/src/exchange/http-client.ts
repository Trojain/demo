import { fetch, ProxyAgent } from 'undici'
import { appConfig } from '../config/env.js'

const proxyAgent = appConfig.exchangeHttpProxy ? new ProxyAgent(appConfig.exchangeHttpProxy) : undefined

export async function fetchExchangeJson<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, {
      dispatcher: proxyAgent,
    })

    const payload = (await response.json()) as T & { code?: string; msg?: string }

    if (!response.ok) {
      throw new Error(`HTTP 状态码 ${response.status}${payload?.msg ? `，${payload.msg}` : ''}`)
    }

    // OKX 业务限频通常会通过 code 返回，例如 50011，请在这里保留交易所原始错误码。
    if (payload?.code && payload.code !== '0') {
      throw new Error(`交易所错误码 ${payload.code}${payload.msg ? `，${payload.msg}` : ''}`)
    }

    return payload
  } catch (error) {
    throw new Error(`交易所请求失败：${formatExchangeError(error)}`)
  }
}

function formatExchangeError(error: unknown) {
  if (!(error instanceof Error)) {
    return '未知错误'
  }

  const cause = error.cause as { code?: string; hostname?: string; message?: string } | undefined
  if (cause?.code === 'ENOENT' || cause?.code === 'ENOTFOUND' || cause?.code === 'ECONNREFUSED') {
    return `无法解析或连接 ${cause.hostname ?? '交易所域名'}，请检查 DNS 或 EXCHANGE_HTTP_PROXY`
  }

  if (cause?.code === 'ECONNRESET') {
    return '连接被重置，请检查代理服务是否可用，或配置 EXCHANGE_HTTP_PROXY'
  }

  return cause?.message ?? error.message
}
