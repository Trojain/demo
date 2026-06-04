import test from 'node:test'
import assert from 'node:assert/strict'
import { MarketService } from '../apps/server/src/services/market.service.ts'
import type { ExchangeCode, MonitorRule } from '../apps/server/src/types/domain.js'
import type { ExchangeAdapter, MarketTickerSnapshot, TickerPrice } from '../apps/server/src/types/exchange.js'

type MutableAdapter = ExchangeAdapter & {
  latestTicker: TickerPrice
  overviewSnapshots: MarketTickerSnapshot[]
}

function createAdapter(exchange: ExchangeCode): MutableAdapter {
  return {
    code: exchange,
    name: exchange.toUpperCase(),
    latestTicker: {
      exchange,
      symbol: 'BTC-USDT',
      price: '100',
      eventTime: '2026-06-04T10:00:00.000Z',
    },
    overviewSnapshots: [
      {
        exchange,
        symbol: 'BTC-USDT',
        price: '100',
        eventTime: '2026-06-04T10:00:00.000Z',
        open24h: '95',
        changePercent24h: '1',
        volume24h: '100',
        volumeCurrency24h: '10000',
      },
      {
        exchange,
        symbol: 'ETH-USDT',
        price: '2000',
        eventTime: '2026-06-04T10:00:00.000Z',
        open24h: '1900',
        changePercent24h: '2',
        volume24h: '200',
        volumeCurrency24h: '20000',
      },
      {
        exchange,
        symbol: 'SOL-USDT',
        price: '150',
        eventTime: '2026-06-04T10:00:00.000Z',
        open24h: '140',
        changePercent24h: '3',
        volume24h: '300',
        volumeCurrency24h: '30000',
      },
      {
        exchange,
        symbol: 'DOGE-USDT',
        price: '0.2',
        eventTime: '2026-06-04T10:00:00.000Z',
        open24h: '0.18',
        changePercent24h: '4',
        volume24h: '400',
        volumeCurrency24h: '40000',
      },
      {
        exchange,
        symbol: exchange === 'okx' ? 'OKB-USDT' : 'BNB-USDT',
        price: '50',
        eventTime: '2026-06-04T10:00:00.000Z',
        open24h: '48',
        changePercent24h: '5',
        volume24h: '500',
        volumeCurrency24h: '50000',
      },
      ...(exchange === 'okx'
        ? [
            {
              exchange,
              symbol: 'BNB-USDT',
              price: '600',
              eventTime: '2026-06-04T10:00:00.000Z',
              open24h: '580',
              changePercent24h: '6',
              volume24h: '600',
              volumeCurrency24h: '60000',
            },
          ]
        : []),
    ],
    async getLatestPrice(symbol: string) {
      return {
        ...this.latestTicker,
        symbol,
      }
    },
    async getTickerSnapshots(symbols: string[]) {
      return this.overviewSnapshots.filter(snapshot => symbols.includes(snapshot.symbol))
    },
    connectTickerStream(symbols: string[], onTicker: (ticker: TickerPrice) => void) {
      void symbols
      this._onTicker = onTicker
      return () => undefined
    },
    _onTicker: undefined as ((ticker: TickerPrice) => void) | undefined,
  } as MutableAdapter
}

function createMarketService() {
  const okxAdapter = createAdapter('okx')
  const binanceAdapter = createAdapter('binance')
  const exchangeFactory = {
    getAdapter(exchange: ExchangeCode) {
      return exchange === 'okx' ? okxAdapter : binanceAdapter
    },
  } as unknown as ConstructorParameters<typeof MarketService>[0]

  return {
    service: new MarketService(exchangeFactory),
    okxAdapter,
    binanceAdapter,
  }
}

function latestTickerPrice(service: MarketService, exchange: ExchangeCode, symbol: string) {
  const latestTickerMap = (service as unknown as { latestTicker: Map<string, TickerPrice> }).latestTicker
  return latestTickerMap.get(`${exchange}:${symbol.toUpperCase()}`)
}

test('refreshOverviewSnapshots 不会用更旧的 REST 快照覆盖更新的 latestTicker', async () => {
  const { service, okxAdapter } = createMarketService()

  ;(service as unknown as { latestTicker: Map<string, TickerPrice> }).latestTicker.set('okx:BTC-USDT', {
    exchange: 'okx',
    symbol: 'BTC-USDT',
    price: '101',
    eventTime: '2026-06-04T10:00:10.000Z',
  })
  okxAdapter.overviewSnapshots = okxAdapter.overviewSnapshots.map(snapshot =>
    snapshot.symbol === 'BTC-USDT'
      ? { ...snapshot, price: '99', eventTime: '2026-06-04T10:00:05.000Z' }
      : snapshot,
  )

  await service.refreshOverviewSnapshots('okx')

  assert.equal(latestTickerPrice(service, 'okx', 'BTC-USDT')?.price, '101')
  assert.equal(latestTickerPrice(service, 'okx', 'BTC-USDT')?.eventTime, '2026-06-04T10:00:10.000Z')
})

test('refreshLatestPrice 不会让更旧的 REST 单点查询覆盖更新缓存', async () => {
  const { service, okxAdapter } = createMarketService()

  ;(service as unknown as { latestTicker: Map<string, TickerPrice> }).latestTicker.set('okx:BTC-USDT', {
    exchange: 'okx',
    symbol: 'BTC-USDT',
    price: '102',
    eventTime: '2026-06-04T10:00:10.000Z',
  })
  okxAdapter.latestTicker = {
    exchange: 'okx',
    symbol: 'BTC-USDT',
    price: '100',
    eventTime: '2026-06-04T10:00:05.000Z',
  }

  const ticker = await service.refreshLatestPrice('okx', 'BTC-USDT')

  assert.equal(ticker.price, '102')
  assert.equal(latestTickerPrice(service, 'okx', 'BTC-USDT')?.price, '102')
})

test('refreshSubscriptions 接收更旧的 WebSocket ticker 时不会回退缓存', () => {
  const { service, okxAdapter } = createMarketService()
  const pushedTickers: TickerPrice[] = []
  const rules: MonitorRule[] = [
    {
      id: 'rule-1',
      exchange: 'okx',
      symbol: 'BTC-USDT',
      targetPrice: '100',
      operator: 'lte',
      checkIntervalMs: 3000,
      side: 'buy',
      orderType: 'market',
      maxSlippagePercent: '0.5',
      cooldownMs: 60000,
      maxTriggerCount: 1,
      triggeredCount: 0,
      simulationMode: true,
      enabled: true,
      runtimeStatus: 'running',
      createdAt: '2026-06-04T10:00:00.000Z',
      updatedAt: '2026-06-04T10:00:00.000Z',
    },
  ]

  ;(service as unknown as { latestTicker: Map<string, TickerPrice> }).latestTicker.set('okx:BTC-USDT', {
    exchange: 'okx',
    symbol: 'BTC-USDT',
    price: '105',
    eventTime: '2026-06-04T10:00:10.000Z',
  })

  service.refreshSubscriptions(rules, ticker => {
    pushedTickers.push(ticker)
  })
  okxAdapter._onTicker?.({
    exchange: 'okx',
    symbol: 'BTC-USDT',
    price: '103',
    eventTime: '2026-06-04T10:00:05.000Z',
  })

  assert.equal(latestTickerPrice(service, 'okx', 'BTC-USDT')?.price, '105')
  assert.equal(latestTickerPrice(service, 'okx', 'BTC-USDT')?.eventTime, '2026-06-04T10:00:10.000Z')
  assert.equal(pushedTickers.length, 0)
})
