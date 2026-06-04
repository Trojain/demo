import type { TickerPrice } from '../types/exchange.js'

export function tickerEventTimestamp(eventTime?: string) {
  const timestamp = eventTime ? new Date(eventTime).getTime() : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : undefined
}

/**
 * 判断服务端是否应该接收新的 ticker。
 * 统一使用事件时间决定新旧，避免 REST 快照或旧轮询结果回退已经写入的 WebSocket 最新价。
 */
export function shouldAcceptTicker(current: TickerPrice | undefined, incoming: TickerPrice) {
  if (!current) {
    return true
  }

  const currentTime = tickerEventTimestamp(current.eventTime)
  const incomingTime = tickerEventTimestamp(incoming.eventTime)

  if (currentTime !== undefined && incomingTime !== undefined) {
    if (incomingTime < currentTime) {
      return false
    }
    if (incomingTime > currentTime) {
      return true
    }
  } else if (currentTime !== undefined && incomingTime === undefined) {
    return false
  } else if (currentTime === undefined && incomingTime !== undefined) {
    return true
  }

  return current.price !== incoming.price || current.eventTime !== incoming.eventTime
}
