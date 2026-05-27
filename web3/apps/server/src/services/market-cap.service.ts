import { fetchExchangeJson } from '../exchange/http-client.js'

const MARKET_CAP_CACHE_TTL_MS = 60_000

const coinGeckoIdsBySymbol: Record<string, string> = {
  'BTC-USDT': 'bitcoin',
  'ETH-USDT': 'ethereum',
  'SOL-USDT': 'solana',
  'DOGE-USDT': 'dogecoin',
  'OKB-USDT': 'okb',
  'BNB-USDT': 'binancecoin',
}

type CoinGeckoSimplePriceResponse = Record<string, { usd_market_cap?: number }>

interface MarketCapCacheItem {
  /** 缓存写入时间 */
  cachedAt: number
  /** symbol 到美元市值的映射 */
  data: Map<string, string>
}

export class MarketCapService {
  private cache?: MarketCapCacheItem

  async getMarketCaps(symbols: readonly string[]) {
    if (this.cache && Date.now() - this.cache.cachedAt < MARKET_CAP_CACHE_TTL_MS) {
      return this.cache.data
    }

    const requestedIds = symbols.map(symbol => coinGeckoIdsBySymbol[symbol]).filter(Boolean)
    if (requestedIds.length === 0) {
      return new Map<string, string>()
    }

    const params = new URLSearchParams({
      ids: requestedIds.join(','),
      vs_currencies: 'usd',
      include_market_cap: 'true',
    })
    const payload = await fetchExchangeJson<CoinGeckoSimplePriceResponse>(`https://api.coingecko.com/api/v3/simple/price?${params.toString()}`)
    const marketCaps = new Map<string, string>()

    Object.entries(coinGeckoIdsBySymbol).forEach(([symbol, coinId]) => {
      const marketCap = payload[coinId]?.usd_market_cap
      if (Number.isFinite(marketCap)) {
        marketCaps.set(symbol, String(marketCap))
      }
    })

    this.cache = {
      cachedAt: Date.now(),
      data: marketCaps,
    }

    return marketCaps
  }
}
