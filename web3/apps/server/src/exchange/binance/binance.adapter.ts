import { nanoid } from 'nanoid'
import WebSocket from 'ws'
import { Decimal } from 'decimal.js'
import { createHmac } from 'node:crypto'
import type {
  AccountBalance,
  ExchangeAdapter,
  GetOrderDetailRequest,
  GetOrderDetailResult,
  InstrumentRule,
  MarketCandle,
  MarketTickerSnapshot,
  PlaceOrderRequest,
  PlaceOrderResult,
  PrivateTradeStreamHandlers,
  TickerPrice,
} from '../../types/exchange.js'
import { fetchExchangeJson } from '../http-client.js'
import { normalizeExchangeOrderError } from '../exchange-order-error.js'
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

type BinancePlaceOrderResponse = {
  orderId?: number
  clientOrderId?: string
  transactTime?: number
  status?: string
  price?: string
  origQty?: string
  cummulativeQuoteQty?: string
  code?: number
  msg?: string
}

type BinanceQueryOrderResponse = {
  orderId?: number
  status?: string
  price?: string
  origQty?: string
  executedQty?: string
  cummulativeQuoteQty?: string
  updateTime?: number
}

type BinanceTradeFillResponse = Array<{
  orderId?: number
  commission?: string
  commissionAsset?: string
}>

type BinanceUserDataStreamResponse = {
  id?: string
  status?: number
  error?: {
    code?: number
    msg?: string
  }
  result?: {
    subscriptionId?: number
  }
  subscriptionId?: number
  event?: {
    e?: string
    E?: number
    T?: number
    s?: string
    i?: number
    X?: string
    p?: string
    z?: string
    Z?: string
    n?: string
    N?: string | null
    u?: number
    B?: Array<{
      a?: string
      f?: string
      l?: string
    }>
  }
}

type BinancePrivateFeeTracker = {
  amount: Decimal
  currency?: string
  mixed: boolean
}

export class BinanceAdapter implements ExchangeAdapter {
  readonly code = 'binance' as const
  private ws?: WebSocket
  private candleWs?: WebSocket
  private privateTradeWs?: WebSocket
  private reconnectTimer?: NodeJS.Timeout
  private candleReconnectTimer?: NodeJS.Timeout
  private privateTradeReconnectTimer?: NodeJS.Timeout
  private currentTickerSignature = ''
  private currentCandleSignature = ''
  private tickerHandler?: (ticker: TickerPrice) => void
  private candleHandler?: (candle: MarketCandle) => void
  private privateTradeHandlers?: PrivateTradeStreamHandlers
  private privateTradeStopRequested = false
  private readonly privateOrderFeeTrackers = new Map<string, BinancePrivateFeeTracker>()

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
    this.ws = createExchangeWebSocket(`${this.getCombinedStreamBaseUrl()}?streams=${streams}`)

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
    const payload = await fetchExchangeJson<BinanceTickerResponse>(`${this.getRestApiBaseUrl()}/v3/ticker/price?symbol=${binanceSymbol}`)
    return {
      exchange: this.code,
      symbol: toDisplaySymbol(payload.symbol),
      price: payload.price,
      eventTime: new Date().toISOString(),
    }
  }

  async getTickerSnapshot(symbol: string): Promise<MarketTickerSnapshot> {
    const binanceSymbol = toBinanceSymbol(symbol)
    const payload = await fetchExchangeJson<BinanceTicker24hResponse>(`${this.getRestApiBaseUrl()}/v3/ticker/24hr?symbol=${binanceSymbol}`)
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

    const payload = await fetchExchangeJson<BinanceKlineResponse>(`${this.getRestApiBaseUrl()}/v3/klines?${params.toString()}`)

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
    this.candleWs = createExchangeWebSocket(`${this.getRawStreamBaseUrl()}/${binanceSymbol.toLowerCase()}@kline_${bar}`)

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
    const payload = await fetchExchangeJson<BinanceExchangeInfoResponse>(`${this.getRestApiBaseUrl()}/v3/exchangeInfo`)

    return payload.symbols
      .filter(item => item.quoteAsset === 'USDT')
      .map(item => {
        const priceFilter = item.filters.find(filter => filter.filterType === 'PRICE_FILTER')
        const lotSizeFilter = item.filters.find(filter => filter.filterType === 'LOT_SIZE')
        const marketLotSizeFilter = item.filters.find(filter => filter.filterType === 'MARKET_LOT_SIZE')
        const minNotionalFilter = item.filters.find(filter => filter.filterType === 'MIN_NOTIONAL' || filter.filterType === 'NOTIONAL')

        return {
          exchange: this.code,
          symbol: toDisplaySymbol(item.symbol),
          baseCurrency: item.baseAsset,
          quoteCurrency: item.quoteAsset,
          tickSize: priceFilter?.tickSize ?? '0',
          lotSize: lotSizeFilter?.stepSize ?? '0',
          marketLotSize: marketLotSizeFilter?.stepSize ?? lotSizeFilter?.stepSize ?? '0',
          minSize: lotSizeFilter?.minQty ?? '0',
          marketMinSize: marketLotSizeFilter?.minQty ?? lotSizeFilter?.minQty ?? '0',
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
    const payload = await fetchExchangeJson<BinanceAccountResponse>(`${this.getRestApiBaseUrl()}/v3/account?${params.toString()}`, {
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

  connectPrivateTradeStream(handlers: PrivateTradeStreamHandlers) {
    if (!appConfig.binance.apiKey || !appConfig.binance.apiSecret) {
      return () => undefined
    }

    this.privateTradeHandlers = handlers
    this.privateTradeStopRequested = false
    clearTimeout(this.privateTradeReconnectTimer)
    this.privateTradeWs?.close()
    this.privateTradeHandlers.onStatusChange?.('connecting')
    this.openPrivateTradeStream()

    return () => {
      this.privateTradeStopRequested = true
      clearTimeout(this.privateTradeReconnectTimer)
      this.privateTradeReconnectTimer = undefined
      this.privateTradeHandlers?.onStatusChange?.('stopped')
      this.privateTradeWs?.close()
      this.privateTradeWs = undefined
      this.privateOrderFeeTrackers.clear()
    }
  }

  async getOrderDetail(request: GetOrderDetailRequest): Promise<GetOrderDetailResult> {
    try {
      if (!appConfig.binance.apiKey || !appConfig.binance.apiSecret) {
        throw new Error('Binance API Key 或 Secret 未配置，无法查询真实订单详情')
      }

      const params = new URLSearchParams({
        symbol: toBinanceSymbol(request.symbol),
        orderId: request.exchangeOrderId,
        recvWindow: '5000',
        timestamp: String(Date.now()),
      })
      const signature = createHmac('sha256', appConfig.binance.apiSecret).update(params.toString()).digest('hex')
      params.set('signature', signature)
      const payload = await fetchExchangeJson<BinanceQueryOrderResponse>(`${this.getRestApiBaseUrl()}/v3/order?${params.toString()}`, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': appConfig.binance.apiKey,
        },
      })
      if (!payload.orderId) {
        throw new Error(`Binance 订单详情返回缺少 orderId，响应=${JSON.stringify(payload)}`)
      }

      const baseQuantity = this.resolvePositiveDecimal(payload.executedQty)
      const quoteAmount = this.resolvePositiveDecimal(payload.cummulativeQuoteQty)
      const averagePrice = this.resolveAveragePrice(baseQuantity, quoteAmount) ?? this.resolvePositiveDecimal(payload.price)
      const fee = await this.tryGetOrderFee(request, payload.orderId)

      return {
        status: this.mapOrderStatus(payload.status),
        price: averagePrice,
        baseQuantity,
        quoteAmount,
        feeAmount: fee?.amount,
        feeCurrency: fee?.currency,
        updatedAt: payload.updateTime ? new Date(payload.updateTime).toISOString() : undefined,
        rawMessage: JSON.stringify({
          order: payload,
          trades: fee?.rawTrades ?? [],
        }),
      }
    } catch (error) {
      throw normalizeExchangeOrderError(this.code, error)
    }
  }

  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResult> {
    try {
      if (request.simulationMode) {
        return {
          exchangeOrderId: `sim-binance-${nanoid(12)}`,
          status: 'submitted',
          clientOrderId: request.clientOrderId,
          acceptedAt: new Date().toISOString(),
          price: request.price,
          baseQuantity: request.baseQuantity,
          quoteAmount: request.quoteAmount,
          rawMessage: `Binance 模拟下单成功，symbol=${request.symbol}, side=${request.side}, type=${request.type}`,
        }
      }

      if (!appConfig.binance.apiKey || !appConfig.binance.apiSecret) {
        throw new Error('Binance API Key 或 Secret 未配置，无法发起真实下单')
      }

      const params = this.buildPlaceOrderParams(request)
      const signature = createHmac('sha256', appConfig.binance.apiSecret).update(params.toString()).digest('hex')
      params.set('signature', signature)
      const payload = await fetchExchangeJson<BinancePlaceOrderResponse>(`${this.getRestApiBaseUrl()}/v3/order?${params.toString()}`, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': appConfig.binance.apiKey,
        },
      })
      if (!payload.orderId) {
        throw new Error(`Binance 下单返回缺少 orderId，响应=${JSON.stringify(payload)}`)
      }

      return {
        exchangeOrderId: String(payload.orderId),
        status: this.mapOrderStatus(payload.status),
        clientOrderId: payload.clientOrderId ?? request.clientOrderId,
        acceptedAt: payload.transactTime ? new Date(payload.transactTime).toISOString() : new Date().toISOString(),
        price: this.resolveReturnedPrice(payload.price, request.price),
        baseQuantity: payload.origQty || request.baseQuantity,
        quoteAmount: this.resolveReturnedQuoteAmount(payload.cummulativeQuoteQty, request.quoteAmount),
        rawMessage: JSON.stringify(payload),
      }
    } catch (error) {
      throw normalizeExchangeOrderError(this.code, error)
    }
  }

  private buildPlaceOrderParams(request: PlaceOrderRequest) {
    const params = new URLSearchParams({
      symbol: toBinanceSymbol(request.symbol),
      side: request.side.toUpperCase(),
      type: request.type.toUpperCase(),
      newClientOrderId: request.clientOrderId,
      recvWindow: '5000',
      timestamp: String(Date.now()),
    })

    if (request.type === 'limit') {
      if (!request.price || !request.baseQuantity) {
        // Binance 真实限价单统一要求上游先给出基础币数量，避免金额换算口径在适配层分叉。
        throw new Error('Binance 真实限价单必须同时提供 price 和基础币数量')
      }

      params.set('timeInForce', 'GTC')
      params.set('price', request.price)
      params.set('quantity', request.baseQuantity)
      return params
    }

    if (request.quoteAmount) {
      params.set('quoteOrderQty', request.quoteAmount)
      return params
    }

    if (!request.baseQuantity) {
      throw new Error('Binance 下单缺少数量参数')
    }

    params.set('quantity', request.baseQuantity)
    return params
  }

  private getRestApiBaseUrl() {
    return appConfig.binance.apiBaseUrl
  }

  private getCombinedStreamBaseUrl() {
    return `${appConfig.binance.streamBaseUrl}/stream`
  }

  private getRawStreamBaseUrl() {
    return `${appConfig.binance.streamBaseUrl}/ws`
  }

  private getWsApiBaseUrl() {
    return appConfig.binance.wsApiBaseUrl
  }

  private openPrivateTradeStream() {
    this.privateTradeWs = createExchangeWebSocket(this.getWsApiBaseUrl())

    this.privateTradeWs.on('open', () => {
      this.privateTradeWs?.send(JSON.stringify(this.buildPrivateSubscribePayload()))
    })

    this.privateTradeWs.on('message', raw => {
      const payload = JSON.parse(raw.toString()) as BinanceUserDataStreamResponse
      if (payload.error) {
        this.privateTradeHandlers?.onStatusChange?.('error', payload.error.msg ?? String(payload.error.code ?? '未知错误'))
        this.privateTradeHandlers?.onError?.(new Error(`Binance 私有推送异常：${payload.error.msg ?? payload.error.code ?? '未知错误'}`))
        return
      }

      if (payload.id && payload.status && payload.status >= 400) {
        this.privateTradeHandlers?.onStatusChange?.('error', `订阅失败，状态码 ${payload.status}`)
        this.privateTradeHandlers?.onError?.(new Error(`Binance 私有推送订阅失败，状态码 ${payload.status}`))
        this.privateTradeWs?.close()
        return
      }

      if (payload.id && payload.status === 200 && payload.result?.subscriptionId) {
        this.privateTradeHandlers?.onStatusChange?.('connected')
      }

      if (!payload.event?.e) {
        return
      }

      this.handlePrivateStreamEvent(payload)
    })

    this.privateTradeWs.on('ping', data => {
      this.privateTradeWs?.pong(data)
    })

    this.privateTradeWs.on('close', () => {
      this.privateTradeWs = undefined
      if (this.privateTradeStopRequested) {
        return
      }

      this.privateTradeHandlers?.onStatusChange?.('reconnecting')
      clearTimeout(this.privateTradeReconnectTimer)
      this.privateTradeReconnectTimer = setTimeout(() => {
        this.openPrivateTradeStream()
      }, 3000)
    })

    this.privateTradeWs.on('error', error => {
      this.privateTradeHandlers?.onStatusChange?.('error', error instanceof Error ? error.message : 'Binance 私有推送连接异常')
      this.privateTradeHandlers?.onError?.(error instanceof Error ? error : new Error('Binance 私有推送连接异常'))
      this.privateTradeWs?.close()
    })
  }

  private buildPrivateSubscribePayload() {
    const params = {
      apiKey: appConfig.binance.apiKey,
      recvWindow: 5000,
      timestamp: Date.now(),
    }

    return {
      id: nanoid(),
      method: 'userDataStream.subscribe.signature',
      params: {
        ...params,
        signature: this.signPrivateStreamParams(params),
      },
    }
  }

  private signPrivateStreamParams(params: Record<string, string | number>) {
    const payload = Object.entries(params)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, value]) => `${key}=${value}`)
      .join('&')
    return createHmac('sha256', appConfig.binance.apiSecret).update(payload).digest('hex')
  }

  private handlePrivateStreamEvent(payload: BinanceUserDataStreamResponse) {
    const event = payload.event
    if (!event?.e) {
      return
    }

    if (event.e === 'executionReport') {
      this.handleExecutionReport(event)
      return
    }

    if (event.e === 'outboundAccountPosition') {
      this.handleOutboundAccountPosition(event)
      return
    }

    if (event.e === 'eventStreamTerminated') {
      this.privateTradeHandlers?.onError?.(new Error('Binance 用户数据流已终止，准备自动重连'))
      this.privateTradeWs?.close()
    }
  }

  private handleExecutionReport(event: NonNullable<BinanceUserDataStreamResponse['event']>) {
    if (!event.s || !event.i) {
      return
    }

    const orderId = String(event.i)
    const feeTracker = this.updatePrivateFeeTracker(orderId, event.n, event.N ?? undefined)
    const baseQuantity = this.resolvePositiveDecimal(event.z)
    const quoteAmount = this.resolvePositiveDecimal(event.Z)
    this.privateTradeHandlers?.onOrderUpdate({
      exchange: this.code,
      symbol: toDisplaySymbol(event.s),
      exchangeOrderId: orderId,
      status: this.mapOrderStatus(event.X),
      price: this.resolveAveragePrice(baseQuantity, quoteAmount) ?? this.resolvePositiveDecimal(event.p),
      baseQuantity,
      quoteAmount,
      feeAmount: feeTracker?.mixed ? undefined : feeTracker?.amount.toFixed(),
      feeCurrency: feeTracker?.mixed ? undefined : feeTracker?.currency,
      updatedAt: new Date(event.T ?? event.E ?? Date.now()).toISOString(),
      rawMessage: JSON.stringify(event),
    })

    if (this.isFinalOrderStatus(event.X)) {
      this.privateOrderFeeTrackers.delete(orderId)
    }
  }

  private handleOutboundAccountPosition(event: NonNullable<BinanceUserDataStreamResponse['event']>) {
    const balances = (event.B ?? [])
      .filter(item => Boolean(item.a))
      .map(item => ({
        currency: item.a!,
        available: item.f ?? '0',
        locked: item.l ?? '0',
        total: new Decimal(item.f ?? 0).plus(item.l ?? 0).toFixed(),
      }))
    if (balances.length === 0) {
      return
    }

    this.privateTradeHandlers?.onBalanceUpdate?.({
      exchange: this.code,
      balances,
      updatedAt: new Date(event.u ?? event.E ?? Date.now()).toISOString(),
      rawMessage: JSON.stringify(event),
    })
  }

  private updatePrivateFeeTracker(orderId: string, commission?: string, commissionCurrency?: string) {
    const currentTracker = this.privateOrderFeeTrackers.get(orderId) ?? {
      amount: new Decimal(0),
      currency: commissionCurrency,
      mixed: false,
    }

    if (commission && new Decimal(commission).greaterThan(0)) {
      if (currentTracker.currency && commissionCurrency && currentTracker.currency !== commissionCurrency) {
        currentTracker.mixed = true
      }

      if (!currentTracker.currency && commissionCurrency) {
        currentTracker.currency = commissionCurrency
      }

      currentTracker.amount = currentTracker.amount.plus(commission)
    }

    this.privateOrderFeeTrackers.set(orderId, currentTracker)
    return currentTracker
  }

  private isFinalOrderStatus(status?: string) {
    return ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'EXPIRED_IN_MATCH'].includes((status || '').toUpperCase())
  }

  private mapOrderStatus(status?: string): PlaceOrderResult['status'] {
    switch ((status || '').toUpperCase()) {
      case 'NEW':
        return 'submitted'
      case 'PARTIALLY_FILLED':
        return 'partially_filled'
      case 'FILLED':
        return 'filled'
      case 'CANCELED':
      case 'PENDING_CANCEL':
        return 'cancelled'
      case 'REJECTED':
      case 'EXPIRED':
      case 'EXPIRED_IN_MATCH':
        return 'rejected'
      default:
        return 'submitted'
    }
  }

  private async tryGetOrderFee(request: GetOrderDetailRequest, orderId: number) {
    try {
      const params = new URLSearchParams({
        symbol: toBinanceSymbol(request.symbol),
        orderId: String(orderId),
        recvWindow: '5000',
        timestamp: String(Date.now()),
      })
      const signature = createHmac('sha256', appConfig.binance.apiSecret).update(params.toString()).digest('hex')
      params.set('signature', signature)
      const trades = await fetchExchangeJson<BinanceTradeFillResponse>(`${this.getRestApiBaseUrl()}/v3/myTrades?${params.toString()}`, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': appConfig.binance.apiKey,
        },
      })
      if (!Array.isArray(trades) || trades.length === 0) {
        return undefined
      }

      const feeByCurrency = new Map<string, Decimal>()
      trades.forEach(trade => {
        if (!trade.commission || !trade.commissionAsset) {
          return
        }

        const currentAmount = feeByCurrency.get(trade.commissionAsset) ?? new Decimal(0)
        feeByCurrency.set(trade.commissionAsset, currentAmount.plus(trade.commission))
      })
      if (feeByCurrency.size !== 1) {
        return {
          rawTrades: trades,
        }
      }

      const [currency, amount] = feeByCurrency.entries().next().value as [string, Decimal]
      return {
        amount: amount.toFixed(),
        currency,
        rawTrades: trades,
      }
    } catch {
      // Binance 手续费需要从 myTrades 聚合获取。该补充接口失败时仍保留订单状态主链路可用性。
      return undefined
    }
  }

  private resolveReturnedPrice(price?: string, fallbackPrice?: string) {
    if (price && new Decimal(price).greaterThan(0)) {
      return price
    }

    return fallbackPrice
  }

  private resolveReturnedQuoteAmount(quoteAmount?: string, fallbackQuoteAmount?: string) {
    if (quoteAmount && new Decimal(quoteAmount).greaterThan(0)) {
      return quoteAmount
    }

    return fallbackQuoteAmount
  }

  private resolvePositiveDecimal(value?: string) {
    if (!value) {
      return undefined
    }

    try {
      const decimalValue = new Decimal(value)
      return decimalValue.greaterThan(0) ? decimalValue.toFixed() : undefined
    } catch {
      return undefined
    }
  }

  private resolveAveragePrice(baseQuantity?: string, quoteAmount?: string) {
    if (!baseQuantity || !quoteAmount) {
      return undefined
    }

    try {
      const decimalBaseQuantity = new Decimal(baseQuantity)
      if (!decimalBaseQuantity.greaterThan(0)) {
        return undefined
      }

      return new Decimal(quoteAmount).div(decimalBaseQuantity).toFixed()
    } catch {
      return undefined
    }
  }
}
