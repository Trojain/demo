import type { ExchangeCode, MarketHealth, MonitorRule, PrivateTradeStreamHealth } from '../types/domain.js'
import type { MarketCandle, MarketTickerSnapshot, TickerPrice } from '../types/exchange.js'
import { ExchangeFactory } from '../exchange/exchange-factory.js'
import { appConfig } from '../config/env.js'
import { shouldAcceptTicker, tickerEventTimestamp } from '../utils/market-ticker.js'
import { resolveBinanceTradingEnvironmentLabel, resolveOkxTradingEnvironmentLabel } from '../utils/trading-environment.js'
import type { MarketCapService } from './market-cap.service.js'
import { Decimal } from 'decimal.js'

export const OVERVIEW_SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT', 'OKB-USDT', 'BNB-USDT'] as const
export const OVERVIEW_SYMBOLS_BY_EXCHANGE: Record<ExchangeCode, readonly string[]> = {
  okx: OVERVIEW_SYMBOLS,
  binance: ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT', 'BNB-USDT'],
}

const OVERVIEW_REFRESH_INTERVAL_MS = 5_000
const TICKER_REST_MIN_INTERVAL_MS = 3_000
const TICKER_STALE_MS = 10_000
const REST_BACKOFF_MS = 30_000
const DEFAULT_CANDLE_CACHE_TTL_MS = 60_000
const EXCHANGE_CANDLE_PAGE_LIMIT = 300

const candleLimitByBar: Record<string, number> = {
  '1s': 300,
  '10s': 120,
  '1m': 1440,
  '5m': 288,
  '15m': 96,
}

interface CandleCacheItem {
  /** 缓存写入时间，用于判断是否过期 */
  cachedAt: number
  /** 已分页聚合后的 K 线数据 */
  data: MarketCandle[]
}

interface PrivateTradeStreamHealthProvider {
  getHealth(exchange: ExchangeCode): PrivateTradeStreamHealth
}

export class MarketService {
  private readonly latestTicker = new Map<string, TickerPrice>()
  private readonly overviewSnapshots = new Map<string, MarketTickerSnapshot>()
  private readonly candleCache = new Map<string, CandleCacheItem>()
  private readonly subscriptionSignatures = new Map<ExchangeCode, string>()
  private readonly overviewRefreshedAt = new Map<ExchangeCode, number>()
  private readonly latestTickerRestAt = new Map<string, number>()
  private readonly restBackoffUntil = new Map<ExchangeCode, number>()
  private readonly lastRestError = new Map<ExchangeCode, string>()
  private privateTradeStreamHealthProvider?: PrivateTradeStreamHealthProvider

  constructor(
    private readonly exchangeFactory: ExchangeFactory,
    private readonly marketCapService?: MarketCapService,
  ) {}

  setPrivateTradeStreamHealthProvider(provider: PrivateTradeStreamHealthProvider) {
    this.privateTradeStreamHealthProvider = provider
  }

  private cacheKey(exchange: ExchangeCode, symbol: string) {
    return `${exchange}:${symbol.toUpperCase()}`
  }

  private isTickerFresh(ticker: TickerPrice, now = Date.now()) {
    const eventTime = tickerEventTimestamp(ticker.eventTime)
    return eventTime !== undefined && now - eventTime <= TICKER_STALE_MS
  }

  private getBackoffMessage(exchange: ExchangeCode, now = Date.now()) {
    const backoffUntil = this.restBackoffUntil.get(exchange) ?? 0
    if (now < backoffUntil) {
      const seconds = Math.ceil((backoffUntil - now) / 1000)
      return `交易所 REST 限流退避中，约 ${seconds} 秒后恢复`
    }

    return undefined
  }

  private enterBackoffIfRateLimited(exchange: ExchangeCode, error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    this.lastRestError.set(exchange, message)
    if (message.includes('HTTP 状态码 429') || message.includes('交易所错误码 50011')) {
      this.restBackoffUntil.set(exchange, Date.now() + REST_BACKOFF_MS)
    }
  }

  private listOverviewSnapshotsBySymbols(exchange: ExchangeCode, symbols: readonly string[] = OVERVIEW_SYMBOLS_BY_EXCHANGE[exchange]) {
    return symbols
      .map(symbol => this.overviewSnapshots.get(this.cacheKey(exchange, symbol)))
      .filter((snapshot): snapshot is MarketTickerSnapshot => Boolean(snapshot))
  }

  refreshSubscriptions(rules: MonitorRule[], onTicker: (ticker: TickerPrice) => void) {
    const grouped = rules.reduce<Record<ExchangeCode, string[]>>(
      (acc, rule) => {
        acc[rule.exchange].push(rule.symbol)
        return acc
      },
      {
        // 监控总览曲线需要持续收到 WebSocket 行情，即使当前没有配置对应规则也要订阅。
        okx: [...OVERVIEW_SYMBOLS_BY_EXCHANGE.okx],
        binance: [...OVERVIEW_SYMBOLS_BY_EXCHANGE.binance],
      },
    )

    ;(Object.keys(grouped) as ExchangeCode[]).forEach(exchange => {
      const symbols = [...new Set(grouped[exchange].map(symbol => symbol.toUpperCase()))].sort()
      if (symbols.length === 0) {
        this.subscriptionSignatures.delete(exchange)
        return
      }

      const signature = symbols.join('|')
      if (this.subscriptionSignatures.get(exchange) === signature) {
        return
      }

      this.subscriptionSignatures.set(exchange, signature)
      this.exchangeFactory.getAdapter(exchange).connectTickerStream(symbols, ticker => {
        const acceptedTicker = this.updateLatestTicker(ticker)
        if (acceptedTicker !== ticker) {
          return
        }

        onTicker(ticker)
      })
    })
  }

  async getLatestPrice(exchange: ExchangeCode, symbol: string) {
    const cached = this.latestTicker.get(this.cacheKey(exchange, symbol))
    if (cached && this.isTickerFresh(cached)) {
      return cached
    }

    return this.refreshLatestPrice(exchange, symbol)
  }

  async refreshLatestPrice(exchange: ExchangeCode, symbol: string) {
    const key = this.cacheKey(exchange, symbol)
    const now = Date.now()
    const cached = this.latestTicker.get(key)
    const backoffMessage = this.getBackoffMessage(exchange, now)
    if (backoffMessage) {
      throw new Error(backoffMessage)
    }

    const lastRestAt = this.latestTickerRestAt.get(key) ?? 0
    if (cached && now - lastRestAt < TICKER_REST_MIN_INTERVAL_MS) {
      return cached
    }

    try {
      this.latestTickerRestAt.set(key, now)
      const ticker = await this.exchangeFactory.getAdapter(exchange).getLatestPrice(symbol)
      const mergedTicker = this.updateLatestTicker(ticker) ?? ticker
      this.lastRestError.delete(exchange)
      return mergedTicker
    } catch (error) {
      this.enterBackoffIfRateLimited(exchange, error)
      throw error
    }
  }

  async refreshOverviewSnapshots(exchange: ExchangeCode = 'okx') {
    const now = Date.now()
    const overviewSymbols = OVERVIEW_SYMBOLS_BY_EXCHANGE[exchange]
    const cached = this.listOverviewSnapshotsBySymbols(exchange, overviewSymbols)
    const lastRefreshAt = this.overviewRefreshedAt.get(exchange) ?? 0
    if (cached.length === overviewSymbols.length && now - lastRefreshAt < OVERVIEW_REFRESH_INTERVAL_MS) {
      return cached
    }

    const backoffMessage = this.getBackoffMessage(exchange, now)
    if (backoffMessage && cached.length > 0) {
      return cached
    }
    if (backoffMessage) {
      throw new Error(backoffMessage)
    }

    const adapter = this.exchangeFactory.getAdapter(exchange)
    try {
      const snapshots = adapter.getTickerSnapshots
        ? await adapter.getTickerSnapshots([...overviewSymbols])
        : await Promise.all(
            overviewSymbols.map(async symbol => {
              const snapshot = adapter.getTickerSnapshot
                ? await adapter.getTickerSnapshot(symbol)
                : {
                    ...(await adapter.getLatestPrice(symbol)),
                    open24h: '0',
                    changePercent24h: '0',
                    volume24h: '0',
                    volumeCurrency24h: '0',
                  }
              return snapshot
            }),
          )

      let marketCaps = new Map<string, string>()
      try {
        marketCaps = this.marketCapService ? await this.marketCapService.getMarketCaps(overviewSymbols) : marketCaps
      } catch (error) {
        this.lastRestError.set(exchange, error instanceof Error ? error.message : '市值数据刷新失败')
      }

      snapshots.forEach(snapshot => {
        const snapshotWithMarketCap = {
          ...snapshot,
          marketCap: marketCaps.get(snapshot.symbol) ?? snapshot.marketCap,
        }
        this.overviewSnapshots.set(this.cacheKey(snapshot.exchange, snapshot.symbol), snapshotWithMarketCap)
        this.updateLatestTicker(snapshotWithMarketCap)
      })
      this.overviewRefreshedAt.set(exchange, now)
      this.lastRestError.delete(exchange)

      return this.listOverviewSnapshotsBySymbols(exchange)
    } catch (error) {
      this.enterBackoffIfRateLimited(exchange, error)
      throw error
    }
  }

  listOverviewSnapshots() {
    return [...this.overviewSnapshots.values()]
  }

  listLatestTickers() {
    return [...this.latestTicker.values()]
  }

  countLatestTickers() {
    return this.latestTicker.size
  }

  private aggregateCandles(candles: MarketCandle[], barSeconds: number, limit: number) {
    const grouped = new Map<number, MarketCandle[]>()
    candles.forEach(candle => {
      const time = new Date(candle.time).getTime()
      if (!Number.isFinite(time)) {
        return
      }

      const bucketTime = Math.floor(time / (barSeconds * 1000)) * barSeconds * 1000
      const bucket = grouped.get(bucketTime) ?? []
      bucket.push(candle)
      grouped.set(bucketTime, bucket)
    })

    return [...grouped.entries()]
      .sort(([left], [right]) => left - right)
      .map(([bucketTime, bucket]) => {
        const sortedBucket = bucket.sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
        const first = sortedBucket[0]
        const last = sortedBucket[sortedBucket.length - 1]
        const high = sortedBucket.reduce((max, item) => Decimal.max(max, item.high), new Decimal(first.high)).toFixed()
        const low = sortedBucket.reduce((min, item) => Decimal.min(min, item.low), new Decimal(first.low)).toFixed()
        const volume = sortedBucket.reduce((total, item) => total.plus(item.volume || '0'), new Decimal(0)).toFixed()
        const volumeCurrency = sortedBucket.reduce((total, item) => total.plus(item.volumeCurrency || '0'), new Decimal(0)).toFixed()

        return {
          symbol: first.symbol,
          time: new Date(bucketTime).toISOString(),
          open: first.open,
          high,
          low,
          close: last.close,
          volume,
          volumeCurrency,
        }
      })
      .slice(-limit)
  }

  connectCandleStream(exchange: ExchangeCode, symbol: string, bar: string, onCandle: (candle: MarketCandle) => void) {
    const adapter = this.exchangeFactory.getAdapter(exchange)
    if (!adapter.connectCandleStream) {
      throw new Error('当前交易所暂不支持 K 线 WebSocket')
    }

    if (bar !== '10s') {
      return adapter.connectCandleStream(symbol, bar, onCandle)
    }

    const sourceCandles = new Map<string, MarketCandle>()
    // 10 秒是本地聚合周期，底层只订阅交易所官方 1 秒 K 线，避免传入交易所未确认支持的 10s。
    return adapter.connectCandleStream(symbol, '1s', candle => {
      const time = new Date(candle.time).getTime()
      if (!Number.isFinite(time)) {
        return
      }

      const bucketTime = Math.floor(time / 10_000) * 10_000
      const bucketStart = new Date(bucketTime).toISOString()
      for (const itemTime of sourceCandles.keys()) {
        const itemBucketTime = Math.floor(new Date(itemTime).getTime() / 10_000) * 10_000
        if (itemBucketTime !== bucketTime) {
          sourceCandles.delete(itemTime)
        }
      }

      sourceCandles.set(candle.time, candle)
      const aggregated = this.aggregateCandles([...sourceCandles.values()], 10, 1)[0]
      if (aggregated) {
        onCandle({ ...aggregated, time: bucketStart })
      }
    })
  }

  getHealth(exchange: ExchangeCode = 'okx'): MarketHealth {
    const now = Date.now()
    const backoffUntil = this.restBackoffUntil.get(exchange) ?? 0
    const overviewRefreshedAt = this.overviewRefreshedAt.get(exchange)
    const subscribedSymbols = (this.subscriptionSignatures.get(exchange) ?? '').split('|').filter(Boolean)

    return {
      exchange,
      tradingEnvironment: this.resolveTradingEnvironment(exchange),
      restBackoffActive: now < backoffUntil,
      restBackoffUntil: backoffUntil > 0 ? new Date(backoffUntil).toISOString() : undefined,
      lastRestError: this.lastRestError.get(exchange),
      overviewRefreshedAt: overviewRefreshedAt ? new Date(overviewRefreshedAt).toISOString() : undefined,
      subscribedSymbols,
      privateTradeStream: this.privateTradeStreamHealthProvider?.getHealth(exchange) ?? {
        exchange,
        enabled: false,
        status: 'idle',
        reconnectCount: 0,
      },
      tickers: [...this.latestTicker.values()]
        .filter(ticker => ticker.exchange === exchange)
        .map(ticker => {
          const eventTime = new Date(ticker.eventTime).getTime()
          return {
            exchange: ticker.exchange,
            symbol: ticker.symbol,
            price: ticker.price,
            eventTime: ticker.eventTime,
            ageMs: Number.isFinite(eventTime) ? Math.max(now - eventTime, 0) : 0,
          }
        }),
    }
  }

  private resolveTradingEnvironment(exchange: ExchangeCode) {
    if (exchange === 'okx') {
      return resolveOkxTradingEnvironmentLabel()
    }

    return resolveBinanceTradingEnvironmentLabel()
  }

  async getRecentCandles(exchange: ExchangeCode, symbol: string, bar: string) {
    const limit = candleLimitByBar[bar] ?? 288
    const requestBar = bar === '10s' ? '1s' : bar
    const requestLimit = bar === '10s' ? limit * 10 : limit
    const cacheKey = `${exchange}:${symbol.toUpperCase()}:${bar}:${limit}`
    const cached = this.candleCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < DEFAULT_CANDLE_CACHE_TTL_MS) {
      return cached.data
    }

    const adapter = this.exchangeFactory.getAdapter(exchange)
    if (!adapter.getCandles) {
      throw new Error('当前交易所暂不支持 K 线查询')
    }

    const candles: MarketCandle[] = []
    let after: string | undefined

    while (candles.length < requestLimit) {
      const pageLimit = Math.min(EXCHANGE_CANDLE_PAGE_LIMIT, requestLimit - candles.length)
      // 交易所官方 K 线支持 1s，但没有统一 10s 周期，所以 10s 只在本服务内按 1s 数据聚合。
      const page = await adapter.getCandles(symbol, requestBar, pageLimit, after)
      if (page.length === 0) {
        break
      }

      candles.push(...page)

      const oldestCandle = page[0]
      const oldestTime = new Date(oldestCandle.time).getTime()
      if (!Number.isFinite(oldestTime)) {
        break
      }

      // OKX after 表示继续取该时间戳之前的更早 K 线，用于补齐 1m 的 24 小时数据。
      after = String(oldestTime)
      if (page.length < pageLimit) {
        break
      }
    }

    const uniqueSourceCandles = [...new Map(candles.map(item => [item.time, item])).values()]
      .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
      .slice(-requestLimit)
    const uniqueCandles = bar === '10s' ? this.aggregateCandles(uniqueSourceCandles, 10, limit) : uniqueSourceCandles.slice(-limit)

    this.candleCache.set(cacheKey, {
      cachedAt: Date.now(),
      data: uniqueCandles,
    })

    return uniqueCandles
  }

  /**
   * 统一写入 latestTicker 缓存，确保服务端也遵循事件时间优先级。
   */
  private updateLatestTicker(ticker: TickerPrice) {
    const key = this.cacheKey(ticker.exchange, ticker.symbol)
    const currentTicker = this.latestTicker.get(key)
    if (!shouldAcceptTicker(currentTicker, ticker)) {
      return currentTicker
    }

    this.latestTicker.set(key, ticker)
    return ticker
  }
}
