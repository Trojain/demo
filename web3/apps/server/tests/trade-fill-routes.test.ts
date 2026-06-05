import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerApiRoutes } from '../src/routes/api.routes.ts'
import type { ApiRouteDeps } from '../src/routes/api.routes.ts'

function createRouteDeps(overrides?: {
  listFillsPage?: ApiRouteDeps['tradeAccountService']['listFillsPage']
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
    dailyReportService: {
      getDailyReport: () => [],
    } as never,
    qualityAnalysisService: {
      getQualityAnalysis: () => ({
        summary: {
          totalOrderCount: 0,
          filledOrderCount: 0,
          failedOrderCount: 0,
          cancelledOrderCount: 0,
          fillRate: 0,
          avgTriggerLatencyMs: 0,
          avgExecutionLatencyMs: 0,
          avgSlippagePercent: 0,
          winRate: 0,
          profitLossRatio: 0,
        },
        statusDistribution: [],
        topSymbols: [],
        dailyTrend: [],
        failedReasons: [],
      }),
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
      listDailyStats: () => [],
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
      createExternalSignal: () => ({}),
    } as never,
    tradeAccountService: {
      listAccounts: () => [],
      listPositions: () => [],
      listFills: () => [],
      listFillsPage: overrides?.listFillsPage ?? (() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
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
  listFillsPage?: ApiRouteDeps['tradeAccountService']['listFillsPage']
}) {
  const app = Fastify()
  await registerApiRoutes(app, createRouteDeps(overrides))
  return app
}

test('GET /api/trade/fills/page 应按日期和分页参数转发到服务层', async () => {
  const app = await createTestApp({
    listFillsPage: input => {
      assert.deepEqual(input, {
        mode: 'real',
        exchange: 'okx',
        localDate: '2026-06-05',
        page: 2,
        pageSize: 15,
      })
      return {
        items: [],
        total: 0,
        page: input.page,
        pageSize: input.pageSize,
      }
    },
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/trade/fills/page?mode=real&exchange=okx&date=2026-06-05&page=2&pageSize=15',
  })

  assert.equal(response.statusCode, 200)
  const payload = response.json()
  assert.equal(payload.page, 2)
  assert.equal(payload.pageSize, 15)

  await app.close()
})

test('GET /api/trade/fills/page 参数不合法时返回 400', async () => {
  const app = await createTestApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/trade/fills/page?date=20260605&page=0',
  })

  assert.equal(response.statusCode, 400)
  await app.close()
})
