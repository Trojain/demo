import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerApiRoutes } from '../src/routes/api.routes.ts'
import type { ApiRouteDeps } from '../src/routes/api.routes.ts'

function createRouteDeps(overrides?: {
  getQualityAnalysis?: ApiRouteDeps['qualityAnalysisService']['getQualityAnalysis']
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
      getQualityAnalysis: overrides?.getQualityAnalysis ?? (() => ({
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
      } as any)),
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
      listFillsPage: () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
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
  getQualityAnalysis?: ApiRouteDeps['qualityAnalysisService']['getQualityAnalysis']
}) {
  const app = Fastify()
  await registerApiRoutes(app, createRouteDeps(overrides))
  return app
}

test('GET /api/trade/quality-analysis 返回执行质量分析报表', async () => {
  const app = await createTestApp({
    getQualityAnalysis: (input) => {
      assert.equal(input.days, 15)
      assert.equal(input.exchange, 'okx')
      assert.equal(input.mode, 'real')
      return {
        summary: {
          totalOrderCount: 10,
          filledOrderCount: 8,
          failedOrderCount: 1,
          cancelledOrderCount: 1,
          fillRate: 0.8,
          avgTriggerLatencyMs: 150,
          avgExecutionLatencyMs: 450,
          avgSlippagePercent: 0.2,
          winRate: 0.75,
          profitLossRatio: 2.5,
        },
        statusDistribution: [
          { name: '已成交', value: 8 },
        ],
        topSymbols: [],
        dailyTrend: [],
        failedReasons: [],
      }
    }
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/trade/quality-analysis?days=15&exchange=okx&mode=real',
  })

  assert.equal(response.statusCode, 200)
  const payload = response.json()
  assert.equal(payload.summary?.totalOrderCount, 10)
  assert.equal(payload.summary?.winRate, 0.75)
  assert.equal(payload.statusDistribution[0]?.name, '已成交')

  await app.close()
})

test('GET /api/trade/quality-analysis 输入校验失败时返回 400', async () => {
  const app = await createTestApp()

  // 超过最大天数 365
  const response1 = await app.inject({
    method: 'GET',
    url: '/api/trade/quality-analysis?days=400',
  })
  assert.equal(response1.statusCode, 400)

  // 非法的 exchange
  const response2 = await app.inject({
    method: 'GET',
    url: '/api/trade/quality-analysis?exchange=other',
  })
  assert.equal(response2.statusCode, 400)

  await app.close()
})
