import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMarketPriceSnapshot,
  mergeMarketPriceMap,
  resolvePreferredTicker,
  shouldAcceptMarketPrice,
  tickerKey,
  type MarketPriceSnapshot,
} from '../apps/web/src/utils/marketPrice.ts'
import { mergeCalibrationCandles, mergeRealtimeCandle } from '../apps/web/src/utils/marketCandle.ts'

function createSnapshot(
  price: string,
  eventTime: string,
  source: MarketPriceSnapshot['source'],
): MarketPriceSnapshot {
  return createMarketPriceSnapshot(
    {
      exchange: 'okx',
      symbol: 'BTC-USDT',
      price,
      eventTime,
    },
    source,
  )
}

test('更旧的行情不能覆盖更新的行情', () => {
  const current = createSnapshot('100', '2026-06-04T10:00:05.000Z', 'realtime')
  const incoming = createSnapshot('99', '2026-06-04T10:00:04.000Z', 'rest')

  assert.equal(shouldAcceptMarketPrice(current, incoming), false)
})

test('同一时间戳下实时行情优先于 REST 和估值快照', () => {
  const restSnapshot = createSnapshot('100', '2026-06-04T10:00:05.000Z', 'rest')
  const realtimeSnapshot = createSnapshot('101', '2026-06-04T10:00:05.000Z', 'realtime')
  const valuationSnapshot = createSnapshot('99', '2026-06-04T10:00:05.000Z', 'valuation')

  assert.equal(shouldAcceptMarketPrice(restSnapshot, realtimeSnapshot), true)
  assert.equal(shouldAcceptMarketPrice(realtimeSnapshot, valuationSnapshot), false)
})

test('没有 eventTime 的兜底快照不能覆盖有 eventTime 的实时行情', () => {
  const current = createSnapshot('100', '2026-06-04T10:00:05.000Z', 'realtime')
  const incoming = createSnapshot('101', '', 'rest')

  assert.equal(shouldAcceptMarketPrice(current, incoming), false)
})

test('resolvePreferredTicker 会优先返回更新的实时行情', () => {
  const snapshotTicker = {
    exchange: 'okx' as const,
    symbol: 'BTC-USDT',
    price: '100',
    eventTime: '2026-06-04T10:00:05.000Z',
  }
  const realtimeTicker = {
    exchange: 'okx' as const,
    symbol: 'BTC-USDT',
    price: '101',
    eventTime: '2026-06-04T10:00:06.000Z',
  }

  assert.deepEqual(resolvePreferredTicker(snapshotTicker, realtimeTicker), realtimeTicker)
})

test('mergeMarketPriceMap 只接收通过时序校验的快照，并返回最新接受时间', () => {
  const currentMap = {
    [tickerKey({ exchange: 'okx', symbol: 'BTC-USDT' })]: createSnapshot('100', '2026-06-04T10:00:05.000Z', 'realtime'),
  }
  const result = mergeMarketPriceMap(currentMap, [
    createSnapshot('99', '2026-06-04T10:00:04.000Z', 'rest'),
    createSnapshot('101', '2026-06-04T10:00:06.000Z', 'rest'),
  ])

  assert.equal(result.changed, true)
  assert.equal(result.latestAcceptedEventTime, '2026-06-04T10:00:06.000Z')
  assert.equal(result.nextMap[tickerKey({ exchange: 'okx', symbol: 'BTC-USDT' })]?.price, '101')
})

test('mergeRealtimeCandle 只在同一时间桶内容变化时更新', () => {
  const currentCandles = [
    {
      symbol: 'BTC-USDT',
      time: '2026-06-04T10:00:00.000Z',
      open: '100',
      high: '101',
      low: '99',
      close: '100',
      volume: '10',
      volumeCurrency: '1000',
    },
  ]
  const sameBucketCandle = {
    symbol: 'BTC-USDT',
    time: '2026-06-04T10:00:00.000Z',
    open: '100',
    high: '101',
    low: '99',
    close: '102',
    volume: '11',
    volumeCurrency: '1100',
  }

  const merged = mergeRealtimeCandle(currentCandles, sameBucketCandle, '1m')
  assert.equal(merged.length, 1)
  assert.equal(merged[0]?.close, '102')
  assert.equal(merged[0]?.volume, '11')
})

test('mergeCalibrationCandles 不会让 REST 校准回退最新桶', () => {
  const currentCandles = [
    {
      symbol: 'BTC-USDT',
      time: '2026-06-04T10:00:00.000Z',
      open: '100',
      high: '101',
      low: '99',
      close: '100',
      volume: '10',
      volumeCurrency: '1000',
    },
    {
      symbol: 'BTC-USDT',
      time: '2026-06-04T10:01:00.000Z',
      open: '100',
      high: '103',
      low: '100',
      close: '103',
      volume: '12',
      volumeCurrency: '1200',
    },
  ]
  const restCandles = [
    {
      symbol: 'BTC-USDT',
      time: '2026-06-04T10:00:00.000Z',
      open: '100',
      high: '101',
      low: '99',
      close: '100',
      volume: '10',
      volumeCurrency: '1000',
    },
    {
      symbol: 'BTC-USDT',
      time: '2026-06-04T10:01:00.000Z',
      open: '100',
      high: '102',
      low: '100',
      close: '102',
      volume: '11',
      volumeCurrency: '1100',
    },
  ]

  const merged = mergeCalibrationCandles(currentCandles, restCandles, '1m')
  assert.equal(merged.length, 2)
  assert.equal(merged[1]?.close, '103')
  assert.equal(merged[1]?.volume, '12')
})
