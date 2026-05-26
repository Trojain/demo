import type { ExchangeCode } from '../types/domain.js'
import type { ExchangeAdapter } from '../types/exchange.js'
import { BinanceAdapter } from './binance/binance.adapter.js'
import { OkxAdapter } from './okx/okx.adapter.js'

export class ExchangeFactory {
  private readonly adapters: Record<ExchangeCode, ExchangeAdapter> = {
    okx: new OkxAdapter(),
    binance: new BinanceAdapter(),
  }

  getAdapter(exchange: ExchangeCode): ExchangeAdapter {
    return this.adapters[exchange]
  }

  listExchanges() {
    return [
      { code: 'okx', name: 'OKX', enabled: true },
      { code: 'binance', name: 'Binance', enabled: true },
    ]
  }
}
