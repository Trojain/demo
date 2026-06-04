import type { MarketCandle } from '../types'

export type MarketCandleBar = '1s' | '10s' | '1m' | '5m' | '15m'

export const CANDLE_POINT_LIMIT_BY_BAR: Record<MarketCandleBar, number> = {
  '1s': 300,
  '10s': 120,
  '1m': 1440,
  '5m': 288,
  '15m': 96,
}

/**
 * 合并单条实时 K 线。
 * 同一个时间桶仅在内容变化时覆盖，避免高频推送导致无意义重绘。
 */
export function mergeRealtimeCandle(candles: MarketCandle[], candle: MarketCandle, bar: MarketCandleBar) {
  const bucketTime = new Date(candle.time).getTime()
  if (!Number.isFinite(bucketTime)) {
    return candles
  }

  const bucketIsoTime = new Date(bucketTime).toISOString()
  const pointLimit = CANDLE_POINT_LIMIT_BY_BAR[bar]
  const candleIndex = candles.findIndex(item => item.time === bucketIsoTime)

  if (candleIndex >= 0) {
    const nextCandle = { ...candle, time: bucketIsoTime }
    const currentCandle = candles[candleIndex]
    if (
      currentCandle.open === nextCandle.open &&
      currentCandle.high === nextCandle.high &&
      currentCandle.low === nextCandle.low &&
      currentCandle.close === nextCandle.close &&
      currentCandle.volume === nextCandle.volume &&
      currentCandle.volumeCurrency === nextCandle.volumeCurrency
    ) {
      return candles
    }

    return [...candles.slice(0, candleIndex), nextCandle, ...candles.slice(candleIndex + 1)]
  }

  return [
    ...candles,
    {
      ...candle,
      time: bucketIsoTime,
    },
  ]
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
    .slice(-pointLimit)
}

/**
 * 合并低频 REST 校准结果。
 * 校准只负责补全旧桶，最新桶继续以 WebSocket 为准，避免图表出现回退。
 */
export function mergeCalibrationCandles(currentCandles: MarketCandle[], nextCandles: MarketCandle[], bar: MarketCandleBar) {
  if (currentCandles.length === 0 || nextCandles.length === 0) {
    return nextCandles
  }

  const latestNextTime = nextCandles.reduce((latest, candle) => {
    const time = new Date(candle.time).getTime()
    return Number.isFinite(time) ? Math.max(latest, time) : latest
  }, 0)

  const candleMap = new Map(nextCandles.map(candle => [candle.time, candle]))
  currentCandles.forEach(candle => {
    const time = new Date(candle.time).getTime()
    if (Number.isFinite(time) && time >= latestNextTime) {
      candleMap.set(candle.time, candle)
    }
  })

  return [...candleMap.values()]
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
    .slice(-CANDLE_POINT_LIMIT_BY_BAR[bar])
}
