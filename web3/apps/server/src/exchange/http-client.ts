import { fetch, ProxyAgent } from 'undici'
import { appConfig } from '../config/env.js'

const proxyAgent = appConfig.exchangeHttpProxy ? new ProxyAgent(appConfig.exchangeHttpProxy) : undefined

export async function fetchExchangeJson<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, {
      dispatcher: proxyAgent,
    })

    if (!response.ok) {
      throw new Error(`HTTP 状态码 ${response.status}`)
    }

    return (await response.json()) as T
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
