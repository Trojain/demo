import type { ExchangeCode, MonitorRule } from '../types/domain.js';
import type { MarketCandle, MarketTickerSnapshot, TickerPrice } from '../types/exchange.js';
import { ExchangeFactory } from '../exchange/exchange-factory.js';

export const OVERVIEW_SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT', 'OKB-USDT', 'BNB-USDT'] as const;

const CANDLE_CACHE_TTL_MS = 60_000;
const EXCHANGE_CANDLE_PAGE_LIMIT = 300;

const candleLimitByBar: Record<string, number> = {
  '1m': 1440,
  '5m': 288,
  '15m': 96
};

interface CandleCacheItem {
  /** 缓存写入时间，用于判断是否过期 */
  cachedAt: number;
  /** 已分页聚合后的 K 线数据 */
  data: MarketCandle[];
}

export class MarketService {
  private readonly latestTicker = new Map<string, TickerPrice>();
  private readonly overviewSnapshots = new Map<string, MarketTickerSnapshot>();
  private readonly candleCache = new Map<string, CandleCacheItem>();

  constructor(private readonly exchangeFactory: ExchangeFactory) {}

  private cacheKey(exchange: ExchangeCode, symbol: string) {
    return `${exchange}:${symbol.toUpperCase()}`;
  }

  refreshSubscriptions(rules: MonitorRule[], onTicker: (ticker: TickerPrice) => void) {
    const grouped = rules.reduce<Record<ExchangeCode, string[]>>(
      (acc, rule) => {
        acc[rule.exchange].push(rule.symbol);
        return acc;
      },
      { okx: [], binance: [] }
    );

    (Object.keys(grouped) as ExchangeCode[]).forEach((exchange) => {
      const symbols = [...new Set(grouped[exchange])];
      if (symbols.length === 0) {
        return;
      }

      this.exchangeFactory.getAdapter(exchange).connectTickerStream(symbols, (ticker) => {
        this.latestTicker.set(this.cacheKey(ticker.exchange, ticker.symbol), ticker);
        onTicker(ticker);
      });
    });
  }

  async getLatestPrice(exchange: ExchangeCode, symbol: string) {
    const cached = this.latestTicker.get(this.cacheKey(exchange, symbol));
    if (cached) {
      return cached;
    }

    return this.refreshLatestPrice(exchange, symbol);
  }

  async refreshLatestPrice(exchange: ExchangeCode, symbol: string) {
    const ticker = await this.exchangeFactory.getAdapter(exchange).getLatestPrice(symbol);
    this.latestTicker.set(this.cacheKey(exchange, symbol), ticker);
    return ticker;
  }

  async refreshOverviewSnapshots(exchange: ExchangeCode = 'okx') {
    const adapter = this.exchangeFactory.getAdapter(exchange);
    const snapshots = await Promise.all(
      OVERVIEW_SYMBOLS.map(async (symbol) => {
        const snapshot = adapter.getTickerSnapshot
          ? await adapter.getTickerSnapshot(symbol)
          : {
              ...(await adapter.getLatestPrice(symbol)),
              open24h: '0',
              changePercent24h: '0',
              volume24h: '0',
              volumeCurrency24h: '0'
            };
        this.overviewSnapshots.set(this.cacheKey(snapshot.exchange, snapshot.symbol), snapshot);
        this.latestTicker.set(this.cacheKey(snapshot.exchange, snapshot.symbol), snapshot);
        return snapshot;
      })
    );

    return snapshots;
  }

  listOverviewSnapshots() {
    return [...this.overviewSnapshots.values()];
  }

  listLatestTickers() {
    return [...this.latestTicker.values()];
  }

  async getRecentCandles(exchange: ExchangeCode, symbol: string, bar: string) {
    const limit = candleLimitByBar[bar] ?? 288;
    const cacheKey = `${exchange}:${symbol.toUpperCase()}:${bar}:${limit}`;
    const cached = this.candleCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CANDLE_CACHE_TTL_MS) {
      return cached.data;
    }

    const adapter = this.exchangeFactory.getAdapter(exchange);
    if (!adapter.getCandles) {
      throw new Error('当前交易所暂不支持 K 线查询');
    }

    const candles: MarketCandle[] = [];
    let after: string | undefined;

    while (candles.length < limit) {
      const pageLimit = Math.min(EXCHANGE_CANDLE_PAGE_LIMIT, limit - candles.length);
      const page = await adapter.getCandles(symbol, bar, pageLimit, after);
      if (page.length === 0) {
        break;
      }

      candles.push(...page);

      const oldestCandle = page[0];
      const oldestTime = new Date(oldestCandle.time).getTime();
      if (!Number.isFinite(oldestTime)) {
        break;
      }

      // OKX after 表示继续取该时间戳之前的更早 K 线，用于补齐 1m 的 24 小时数据。
      after = String(oldestTime);
      if (page.length < pageLimit) {
        break;
      }
    }

    const uniqueCandles = [...new Map(candles.map((item) => [item.time, item])).values()]
      .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
      .slice(-limit);

    this.candleCache.set(cacheKey, {
      cachedAt: Date.now(),
      data: uniqueCandles
    });

    return uniqueCandles;
  }
}
