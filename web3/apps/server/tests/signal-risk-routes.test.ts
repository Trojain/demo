import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerApiRoutes } from '../src/routes/api.routes.ts'
import type { ApiRouteDeps } from '../src/routes/api.routes.ts'

function createRouteDeps(overrides?: {
  createExternalSignal?: ApiRouteDeps['signalService']['createExternalSignal']
  listDailyStats?: ApiRouteDeps['riskService']['listDailyStats']
}): ApiRouteDeps {
  return {
    auditLogRepository: {
      delete: () => false,
      listByRuleId: () => [],
    } as never,
    auditLogService: {
      list: () => [],
      listPage: () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
      record: () => undefined,
    } as never,
    exchangeFactory: {
      listExchanges: () => [],
    } as never,
    marketService: {
      countLatestTickers: () => 0,
      listLatestTickers: () => [],
      listOverviewSnapshots: () => [],
      refreshOverviewSnapshots: async () => [],
      getHealth: () => ({}),
      getRecentCandles: async () => [],
    } as never,
    orderRecoveryService: {
      listPage: () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
      retryById: async () => {
        throw new Error('not implemented')
      },
    } as never,
    orderPreviewService: {
      preview: async () => ({}),
    } as never,
    orderService: {
      confirmTrigger: async () => ({}),
    } as never,
    orderRepository: {
      countAll: () => 0,
      list: () => [],
      listByRuleId: () => [],
      delete: () => false,
    } as never,
    riskCheckRepository: {
      list: () => [],
      listByRuleId: () => [],
      delete: () => false,
    } as never,
    riskConfigService: {
      getConfig: () => ({}),
      update: () => ({}),
    } as never,
    riskService: {
      listDailyStats: overrides?.listDailyStats ?? (() => []),
    } as never,
    ruleRepository: {
      countEnabled: () => 0,
      countAll: () => 0,
      list: () => [],
      findById: () => undefined,
      create: input => input,
      update: input => input,
      setEnabled: () => undefined,
      delete: () => undefined,
    } as never,
    signalRepository: {
      delete: () => false,
      listByRuleId: () => [],
    } as never,
    signalService: {
      list: () => [],
      createExternalSignal: overrides?.createExternalSignal ?? (() => ({})),
    } as never,
    tradeAccountService: {
      listAccounts: () => [],
      listPositions: () => [],
      listFills: () => [],
      listOperationLogs: () => [],
    } as never,
    tradeExecutionService: {
      listAccountSummaries: async () => [],
      listEquityHistory: async () => [],
      listPositionViews: async () => [],
      preview: async () => ({}),
      confirm: async () => ({}),
    } as never,
    tradingRuleService: {
      listInstrumentRules: async () => [],
      validateMonitorRule: async () => undefined,
    } as never,
    triggerRepository: {
      countPending: () => 0,
      list: () => [],
      listByRuleId: () => [],
      delete: () => false,
      findById: () => undefined,
      markIgnored: () => undefined,
    } as never,
  }
}

async function createTestApp(overrides?: {
  createExternalSignal?: ApiRouteDeps['signalService']['createExternalSignal']
  listDailyStats?: ApiRouteDeps['riskService']['listDailyStats']
}) {
  const app = Fastify()
  await registerApiRoutes(app, createRouteDeps(overrides))
  return app
}

test('POST /api/signals/external 可接收外部信号', async () => {
  const app = await createTestApp({
    createExternalSignal: input => ({
      signal: {
        id: 'signal-1',
        ruleId: input.ruleId,
        exchange: 'okx',
        symbol: 'BTC-USDT',
        marketPrice: input.marketPrice,
        marketEventTime: input.marketEventTime ?? '2026-06-04T10:00:00.000Z',
        sourceType: 'external_input',
        targetPrice: '70000',
        operator: 'gte',
        side: 'buy',
        orderType: 'market',
        quoteAmount: '50',
        simulationMode: true,
        status: 'pending',
        reason: input.reason,
        createdAt: '2026-06-04T10:00:01.000Z',
      },
      trigger: {
        id: 'trigger-1',
        ruleId: input.ruleId,
        exchange: 'okx',
        symbol: 'BTC-USDT',
        marketPrice: input.marketPrice,
        targetPrice: '70000',
        status: 'pending',
        createdAt: '2026-06-04T10:00:01.000Z',
      },
    }),
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/signals/external',
    payload: {
      ruleId: 'rule-1',
      marketPrice: '70200',
      reason: 'webhook signal',
      sourceLabel: 'webhook',
    },
  })

  assert.equal(response.statusCode, 200)
  const payload = response.json() as { signal?: { sourceType: string }; trigger?: { id: string } }
  assert.equal(payload.signal?.sourceType, 'external_input')
  assert.equal(payload.trigger?.id, 'trigger-1')

  await app.close()
})

test('GET /api/risk-stats/daily 返回日维度风控统计', async () => {
  const app = await createTestApp({
    listDailyStats: () => [
      {
        statDate: '2026-06-04',
        passedCount: 3,
        passedQuoteAmount: '150',
        rejectedCount: 1,
        rejectedQuoteAmount: '20',
        totalCount: 4,
        totalQuoteAmount: '170',
      },
    ],
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/risk-stats/daily?days=7',
  })

  assert.equal(response.statusCode, 200)
  const payload = response.json() as {
    today: { passedCount: number }
    items: Array<{ statDate: string }>
  }
  assert.equal(payload.today?.passedCount, 3)
  assert.equal(payload.items[0]?.statDate, '2026-06-04')

  await app.close()
})
