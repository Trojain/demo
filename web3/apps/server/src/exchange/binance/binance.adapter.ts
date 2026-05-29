import { nanoid } from 'nanoid'
import WebSocket from 'ws'
import { Decimal } from 'decimal.js'
import { createHmac } from 'node:crypto'
import type { AccountBalance, ExchangeAdapter, InstrumentRule, MarketCandle, MarketTickerSnapshot, PlaceOrderRequest, PlaceOrderResult, TickerPrice } from '../../types/exchange.js'
import { fetchExchangeJson } from '../http-client.js'
import { toBinanceSymbol, toDisplaySymbol } from '../symbol.js'
import { appConfig } from '../../config/env.js'
import { createExchangeWebSocket } from '../ws-client.js'

type BinanceTickerResponse = {
  symbol: string
  price: string
}

type BinanceTicker24hResponse = {
  symbol: string
  lastPrice: string
  openPrice: string
  priceChangePercent: string
  volume: string
  quoteVolume: string
  closeTime: number
}

type BinanceKlineResponse = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
][]

type BinanceExchangeInfoResponse = {
  symbols: Array<{
    symbol: string
    status: string
    baseAsset: string
    quoteAsset: string
    filters: Array<{
      filterType: string
      tickSize?: string
      stepSize?: string
      minQty?: string
      minNotional?: string
      minNotionalValue?: string
    }>
  }>
}

type BinanceTickerStreamMessage = {
  stream?: string
  data?: {
    s?: string
    c?: string
    E?: number
  }
  s?: string
  c?: string
  E?: number
}

type BinanceKlineStreamMessage = {
  k?: {
    t?: number
    s?: string
    o?: string
    h?: string
    l?: string
    c?: string
    v?: string
    q?: string
  }
}

type BinanceAccountResponse = {
  balances?: Array<{
    asset: string
    free: string
    locked: string
  }>
}

export class BinanceAdapter implements ExchangeAdapter {
  readonly code = 'binance' as const
  private ws?: WebSocket
  private candleWs?: WebSocket
  private reconnectTimer?: NodeJS.Timeout
  private candleReconnectTimer?: NodeJS.Timeout
  private currentTickerSignature = ''
  private currentCandleSignature = ''
  private tickerHandler?: (ticker: TickerPrice) => void
  private candleHandler?: (candle: MarketCandle) => void

  connectTickerStream(symbols: string[], onTicker: (ticker: TickerPrice) => void) {
    const uniqueSymbols = [...new Set(symbols.map(toBinanceSymbol))].sort()
    if (uniqueSymbols.length === 0) {
      return
    }

    const signature = uniqueSymbols.join('|')
    this.tickerHandler = onTicker
    const tickerSocketActive = this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN
    if (this.currentTickerSignature === signature && tickerSocketActive) {
      return
    }

    this.currentTickerSignature = signature
    this.ws?.close()
    const streams = uniqueSymbols.map(symbol => `${symbol.toLowerCase()}@ticker`).join('/')
    this.ws = createExchangeWebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)

    this.ws.on('message', raw => {
      const payload = JSON.parse(raw.toString()) as BinanceTickerStreamMessage
      const data = payload.data ?? payload
      if (!data.s || !data.c) {
        return
      }

      this.tickerHandler?.({
        exchange: this.code,
        symbol: toDisplaySymbol(data.s),
        price: data.c,
        eventTime: new Date(data.E ?? Date.now()).toISOString(),
      })
    })

    this.ws.on('close', () => {
      clearTimeout(this.reconnectTimer)
      const reconnectSymbols = this.currentTickerSignature.split('|').filter(Boolean)
      const reconnectHandler = this.tickerHandler
      if (reconnectSymbols.length > 0 && reconnectHandler) {
        this.reconnectTimer = setTimeout(() => {
          this.currentTickerSignature = ''
          this.connectTickerStream(reconnectSymbols, reconnectHandler)
        }, 3000)
      }
    })

    this.ws.on('error', () => {
      console.warn('Binance ticker WebSocket 异常，准备重连')
      this.ws?.close()
    })
  }

  async getLatestPrice(symbol: string): Promise<TickerPrice> {
    const binanceSymbol = toBinanceSymbol(symbol)
    const payload = await fetchExchangeJson<BinanceTickerResponse>(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`)
    return {
      exchange: this.code,
      symbol: toDisplaySymbol(payload.symbol),
      price: payload.price,
      eventTime: new Date().toISOString(),
    }
  }

  async getTickerSnapshot(symbol: string): Promise<MarketTickerSnapshot> {
    const binanceSymbol = toBinanceSymbol(symbol)
    const payload = await fetchExchangeJson<BinanceTicker24hResponse>(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`)
    return this.mapTickerSnapshot(payload)
  }

  async getTickerSnapshots(symbols: string[]): Promise<MarketTickerSnapshot[]> {
    return Promise.all(symbols.map(symbol => this.getTickerSnapshot(symbol)))
  }

  async getCandles(symbol: string, bar: string, limit: number, after?: string): Promise<MarketCandle[]> {
    const binanceSymbol = toBinanceSymbol(symbol)
    const params = new URLSearchParams({
      symbol: binanceSymbol,
      interval: bar,
      limit: String(limit),
    })

    if (after) {
      params.set('endTime', String(Number(after) - 1))
    }

    const payload = await fetchExchangeJson<BinanceKlineResponse>(`https://api.binance.com/api/v3/klines?${params.toString()}`)

    return payload.map(item => ({
      symbol: toDisplaySymbol(binanceSymbol),
      time: new Date(item[0]).toISOString(),
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4],
      volume: item[5],
      volumeCurrency: item[7],
    }))
  }

  connectCandleStream(symbol: string, bar: string, onCandle: (candle: MarketCandle) => void) {
    const binanceSymbol = toBinanceSymbol(symbol)
    const signature = `${binanceSymbol}:${bar}`
    this.candleHandler = onCandle
    const candleSocketActive = this.candleWs?.readyState === WebSocket.CONNECTING || this.candleWs?.readyState === WebSocket.OPEN
    if (this.currentCandleSignature === signature && candleSocketActive) {
      return () => undefined
    }

    this.currentCandleSignature = signature
    clearTimeout(this.candleReconnectTimer)
    this.candleWs?.close()
    this.candleWs = createExchangeWebSocket(`wss://stream.binance.com:9443/ws/${binanceSymbol.toLowerCase()}@kline_${bar}`)

    this.candleWs.on('message', raw => {
      const payload = JSON.parse(raw.toString()) as BinanceKlineStreamMessage
      const item = payload.k
      if (!item?.t || !item.o || !item.h || !item.l || !item.c) {
        return
      }

      this.candleHandler?.({
        symbol: toDisplaySymbol(item.s ?? binanceSymbol),
        time: new Date(item.t).toISOString(),
        open: item.o,
        high: item.h,
        low: item.l,
        close: item.c,
        volume: item.v ?? '0',
        volumeCurrency: item.q ?? '0',
      })
    })

    this.candleWs.on('close', () => {
      const reconnectSignature = this.currentCandleSignature
      const reconnectHandler = this.candleHandler
      if (reconnectSignature === signature && reconnectHandler) {
        this.candleReconnectTimer = setTimeout(() => {
          this.currentCandleSignature = ''
          this.connectCandleStream(symbol, bar, reconnectHandler)
        }, 3000)
      }
    })

    this.candleWs.on('error', () => {
      console.warn('Binance K 线 WebSocket 异常，准备重连')
      this.candleWs?.close()
    })

    return () => {
      if (this.currentCandleSignature !== signature) {
        return
      }

      this.currentCandleSignature = ''
      clearTimeout(this.candleReconnectTimer)
      this.candleWs?.close()
      this.candleWs = undefined
    }
  }

  async getInstrumentRules(): Promise<InstrumentRule[]> {
    const payload = await fetchExchangeJson<BinanceExchangeInfoResponse>('https://api.binance.com/api/v3/exchangeInfo')

    return payload.symbols
      .filter(item => item.quoteAsset === 'USDT')
      .map(item => {
        const priceFilter = item.filters.find(filter => filter.filterType === 'PRICE_FILTER')
        const lotSizeFilter = item.filters.find(filter => filter.filterType === 'LOT_SIZE')
        const minNotionalFilter = item.filters.find(filter => filter.filterType === 'MIN_NOTIONAL' || filter.filterType === 'NOTIONAL')

        return {
          exchange: this.code,
          symbol: toDisplaySymbol(item.symbol),
          baseCurrency: item.baseAsset,
          quoteCurrency: item.quoteAsset,
          tickSize: priceFilter?.tickSize ?? '0',
          lotSize: lotSizeFilter?.stepSize ?? '0',
          minSize: lotSizeFilter?.minQty ?? '0',
          minNotional: minNotionalFilter?.minNotional ?? minNotionalFilter?.minNotionalValue,
          state: item.status === 'TRADING' ? 'live' : item.status.toLowerCase(),
        }
      })
  }

  private mapTickerSnapshot(payload: BinanceTicker24hResponse): MarketTickerSnapshot {
    const openPrice = payload.openPrice || payload.lastPrice
    const changePercent24h = payload.priceChangePercent || new Decimal(payload.lastPrice).minus(openPrice).div(openPrice).mul(100).toFixed(2)

    return {
      exchange: this.code,
      symbol: toDisplaySymbol(payload.symbol),
      price: payload.lastPrice,
      eventTime: new Date(payload.closeTime).toISOString(),
      open24h: openPrice,
      changePercent24h,
      volume24h: payload.volume,
      volumeCurrency24h: payload.quoteVolume,
    }
  }

  async getAccountBalances(currencies?: string[]): Promise<AccountBalance[]> {
    if (!appConfig.binance.apiKey || !appConfig.binance.apiSecret) {
      throw new Error('Binance API Key 或 Secret 未配置，无法查询真实账户余额')
    }

    const params = new URLSearchParams({
      recvWindow: '5000',
      timestamp: String(Date.now()),
    })
    const signature = createHmac('sha256', appConfig.binance.apiSecret).update(params.toString()).digest('hex')
    params.set('signature', signature)
    const payload = await fetchExchangeJson<BinanceAccountResponse>(`https://api.binance.com/api/v3/account?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': appConfig.binance.apiKey,
      },
    })
    const currencySet = currencies?.length ? new Set(currencies.map(currency => currency.toUpperCase())) : undefined

    return (payload.balances ?? [])
      .filter(item => !currencySet || currencySet.has(item.asset))
      .map(item => ({
        currency: item.asset,
        available: item.free,
        locked: item.locked,
        total: new Decimal(item.free).plus(item.locked).toFixed(),
      }))
  }

  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResult> {
    if (request.simulationMode) {
      return {
        exchangeOrderId: `sim-binance-${nanoid(12)}`,
        status: 'submitted',
        rawMessage: `Binance 模拟下单成功，symbol=${request.symbol}, side=${request.side}, type=${request.type}`,
      }
    }

    throw new Error('Binance 真实下单尚未在第一版开启，请先保持 ENABLE_REAL_TRADING=false')
  }
}
