import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerApiRoutes } from '../src/routes/api.routes.ts'
import type { ApiRouteDeps } from '../src/routes/api.routes.ts'

function createArchive() {
  return {
    archiveType: 'web3-trading-config' as const,
    schemaVersion: '1.0.0' as const,
    exportedAt: '2026-06-05T09:00:00.000Z',
    meta: {
      description: '测试导入导出',
      supportedExchanges: ['okx', 'binance'] as const,
      supportedSignalSources: ['price_rule', 'external_input'] as const,
    },
    riskConfig: {
      maxQuoteAmount: '1000',
      maxMarketAgeMs: 8000,
      dailyMaxTriggerCount: 10,
      dailyMaxQuoteAmount: '5000',
      tradingMode: 'allow_real' as const,
    },
    rules: [
      {
        id: 'rule-1',
        exchange: 'okx' as const,
        symbol: 'BTC-USDT',
        operator: 'gte' as const,
        targetPrice: '70000',
        checkIntervalMs: 3000,
        side: 'buy' as const,
        orderType: 'market' as const,
        quoteAmount: '50',
        maxSlippagePercent: '0.5',
        cooldownMs: 60000,
        maxTriggerCount: 1,
        simulationMode: true,
        enabled: true,
      },
    ],
  }
}

function createRouteDeps(overrides?: {
  exportArchive?: ApiRouteDeps['configArchiveService']['exportArchive']
  importArchive?: ApiRouteDeps['configArchiveService']['importArchive']
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
    configArchiveService: {
      exportArchive: overrides?.exportArchive ?? (() => createArchive()),
      importArchive: overrides?.importArchive ?? (async () => ({
        riskConfigUpdated: true,
        createdRuleCount: 1,
        updatedRuleCount: 0,
        pausedRuleCount: 1,
      })),
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
  exportArchive?: ApiRouteDeps['configArchiveService']['exportArchive']
  importArchive?: ApiRouteDeps['configArchiveService']['importArchive']
}) {
  const app = Fastify()
  await registerApiRoutes(app, createRouteDeps(overrides))
  return app
}

test('GET /api/config/archive 返回配置归档', async () => {
  const app = await createTestApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/config/archive',
  })

  assert.equal(response.statusCode, 200)
  const payload = response.json() as ReturnType<typeof createArchive>
  assert.equal(payload.archiveType, 'web3-trading-config')
  assert.equal(payload.rules.length, 1)

  await app.close()
})

test('POST /api/config/archive/import 会将归档参数转发给服务层', async () => {
  const app = await createTestApp({
    importArchive: async (input) => {
      assert.equal(input.pauseImportedRules, true)
      assert.equal(input.overwriteRiskConfig, false)
      assert.equal(input.archive.rules[0]?.id, 'rule-1')
      return {
        riskConfigUpdated: false,
        createdRuleCount: 0,
        updatedRuleCount: 1,
        pausedRuleCount: 1,
      }
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/config/archive/import',
    payload: {
      archive: createArchive(),
      pauseImportedRules: true,
      overwriteRiskConfig: false,
    },
  })

  assert.equal(response.statusCode, 200)
  const payload = response.json() as {
    updatedRuleCount: number
  }
  assert.equal(payload.updatedRuleCount, 1)

  await app.close()
})

test('POST /api/config/archive/import 参数不合法时返回 400', async () => {
  const app = await createTestApp()

  const response = await app.inject({
    method: 'POST',
    url: '/api/config/archive/import',
    payload: {
      archive: {
        archiveType: 'other',
      },
    },
  })

  assert.equal(response.statusCode, 400)
  assert.match(response.body, /配置导入参数不合法/)

  await app.close()
})
