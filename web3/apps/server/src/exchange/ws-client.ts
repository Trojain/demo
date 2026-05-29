import WebSocket from 'ws'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { appConfig } from '../config/env.js'

const exchangeWsAgent = appConfig.exchangeHttpProxy ? new HttpsProxyAgent(appConfig.exchangeHttpProxy) : undefined

export function createExchangeWebSocket(url: string) {
  return new WebSocket(url, exchangeWsAgent ? { agent: exchangeWsAgent } : undefined)
}
