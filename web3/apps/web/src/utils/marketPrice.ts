import type { TickerPrice } from '../types'

export type MarketPriceSource = 'realtime' | 'rest' | 'valuation'

export interface MarketPriceSnapshot extends TickerPrice {
  /** 行情来源，用于在同一时间戳下决定覆盖优先级 */
  source: MarketPriceSource
}

const MARKET_PRICE_SOURCE_PRIORITY: Record<MarketPriceSource, number> = {
  valuation: 1,
  rest: 2,
  realtime: 3,
}

export function tickerKey(ticker: Pick<TickerPrice, 'exchange' | 'symbol'>) {
  return `${ticker.exchange}:${ticker.symbol}`.toUpperCase()
}

export function eventTimestamp(eventTime?: string) {
  const timestamp = eventTime ? new Date(eventTime).getTime() : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function sourcePriority(source: MarketPriceSource) {
  return MARKET_PRICE_SOURCE_PRIORITY[source]
}

export function createMarketPriceSnapshot(ticker: TickerPrice, source: MarketPriceSource): MarketPriceSnapshot {
  return {
    ...ticker,
    source,
  }
}

/**
 * 在 REST 快照和实时 ticker 之间选出更可信的一份行情。
 * 页面展示统一复用这个函数，避免各处自己决定覆盖规则。
 */
export function resolvePreferredTicker(snapshotTicker?: TickerPrice, realtimeTicker?: TickerPrice) {
  if (!snapshotTicker) {
    return realtimeTicker
  }

  if (!realtimeTicker) {
    return snapshotTicker
  }

  return shouldAcceptMarketPrice(createMarketPriceSnapshot(snapshotTicker, 'rest'), createMarketPriceSnapshot(realtimeTicker, 'realtime'))
    ? realtimeTicker
    : snapshotTicker
}

export function shouldAcceptMarketPrice(current: MarketPriceSnapshot | undefined, incoming: MarketPriceSnapshot) {
  if (!current) {
    return true
  }

  const currentTime = eventTimestamp(current.eventTime)
  const incomingTime = eventTimestamp(incoming.eventTime)
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

  if (sourcePriority(incoming.source) < sourcePriority(current.source)) {
    return false
  }
  if (sourcePriority(incoming.source) > sourcePriority(current.source)) {
    return true
  }

  return current.price !== incoming.price || current.eventTime !== incoming.eventTime
}

export function mergeMarketPriceMap(
  currentMap: Record<string, MarketPriceSnapshot>,
  incomingSnapshots: MarketPriceSnapshot[],
) {
  let changed = false
  let latestAcceptedEventTime: string | undefined
  let nextMap = currentMap

  incomingSnapshots.forEach(snapshot => {
    const key = tickerKey(snapshot)
    const currentSnapshot = nextMap[key]
    if (!shouldAcceptMarketPrice(currentSnapshot, snapshot)) {
      return
    }

    if (!changed) {
      nextMap = { ...currentMap }
      changed = true
    }

    nextMap[key] = snapshot
    if (!latestAcceptedEventTime) {
      latestAcceptedEventTime = snapshot.eventTime
      return
    }

    const latestAcceptedTime = eventTimestamp(latestAcceptedEventTime)
    const incomingTime = eventTimestamp(snapshot.eventTime)
    if (incomingTime !== undefined && (latestAcceptedTime === undefined || incomingTime > latestAcceptedTime)) {
      latestAcceptedEventTime = snapshot.eventTime
    }
  })

  return {
    changed,
    latestAcceptedEventTime,
    nextMap,
  }
}
