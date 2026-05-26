import { nanoid } from 'nanoid'
import type { ExchangeAdapter, PlaceOrderRequest, PlaceOrderResult, TickerPrice } from '../../types/exchange.js'
import { fetchExchangeJson } from '../http-client.js'
import { toBinanceSymbol, toDisplaySymbol } from '../symbol.js'

type BinanceTickerResponse = {
  symbol: string
  price: string
}

export class BinanceAdapter implements ExchangeAdapter {
  readonly code = 'binance' as const

  connectTickerStream(_symbols: string[], _onTicker: (ticker: TickerPrice) => void) {
    // Binance WebSocket 在第一版预留，业务层已经通过统一适配器隔离。
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
