import { useMemo } from 'react'
import type { ExchangeCode, TickerPrice } from '../types'
import { useTradingStore } from '../stores/tradingStore'
import { tickerKey } from '../utils/marketPrice'

function toTickerSignature(ticker?: TickerPrice) {
  return ticker ? `${ticker.eventTime}|${ticker.price}` : ''
}

export function useTickerSnapshot(exchange?: ExchangeCode, symbol?: string) {
  const snapshotKey = useMemo(() => (exchange && symbol ? tickerKey({ exchange, symbol }) : ''), [exchange, symbol])
  const signature = useTradingStore(state => (snapshotKey ? toTickerSignature(state.tickerMap[snapshotKey]) : ''))

  return useMemo(() => {
    if (!snapshotKey) {
      return undefined
    }

    return useTradingStore.getState().tickerMap[snapshotKey]
  }, [signature, snapshotKey])
}

export function useTickerSnapshots(keys: string[]) {
  const normalizedKeys = useMemo(() => [...keys].sort(), [keys])
  const keysSignature = useMemo(() => normalizedKeys.join('|'), [normalizedKeys])
  const tickerSignature = useTradingStore(state => normalizedKeys.map(key => toTickerSignature(state.tickerMap[key])).join('|'))

  return useMemo(() => {
    const tickerMap = useTradingStore.getState().tickerMap
    return normalizedKeys.reduce<Record<string, TickerPrice>>((accumulator, key) => {
      const ticker = tickerMap[key]
      if (ticker) {
        accumulator[key] = ticker
      }

      return accumulator
    }, {})
  }, [keysSignature, normalizedKeys, tickerSignature])
}
