import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerApiRoutes } from '../src/routes/api.routes.ts'
import type { ApiRouteDeps } from '../src/routes/api.routes.ts'
import type { OrderRecoveryRecord } from '../../web/src/types.ts'

function createRecoveryRecord(overrides?: Partial<OrderRecoveryRecord>): OrderRecoveryRecord {
  return {
    id: 'recovery-1',
    identityKey: 'order_sync:order-1',
    orderId: 'order-1',
    exchangeOrderId: 'exchange-order-1',
    exchange: 'okx',
    source: 'manual',
    mode: 'real',
    symbol: 'BTC-USDT',
    failureStage: 'order_sync',
    recoveryStatus: 'pending_recovery',
    retryCount: 0,
    maxRetryCount: 3,
    lastErrorCode: 'sync_error',
    lastErrorMessage: '同步失败',
    nextRetryAt: '2026-06-04T18:00:00.000Z',
    payloadJson: JSON.stringify({ source: 'rest' }),
    createdAt: '2026-06-04T17:59:00.000Z',
    updatedAt: '2026-06-04T17:59:00.000Z',
    ...overrides,
  }
}

function createRouteDeps(overrides?: {
  listPage?: ApiRouteDeps['orderRecoveryService']['listPage']
  retryById?: ApiRouteDeps['orderRecoveryService']['retryById']
  retryBatch?: ApiRouteDeps['orderRecoveryService']['retryBatch']
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
      exportArchive: () => ({
        archiveType: 'web3-trading-config',
        schemaVersion: '1.0.0',
        exportedAt: '2026-06-05T00:00:00.000Z',
        meta: {
          description: 'stub',
          supportedExchanges: ['okx'],
          supportedSignalSources: ['price_rule'],
        },
        riskConfig: {},
        rules: [],
      }),
      importArchive: async () => ({
        riskConfigUpdated: false,
        createdRuleCount: 0,
        updatedRuleCount: 0,
        pausedRuleCount: 0,
      }),
    } as never,
    dailyReportService: {
      getDailyReport: () => [],
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
      listPage: overrides?.listPage ?? (() => ({
        items: [createRecoveryRecord()],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      retryById: overrides?.retryById ?? (async () => createRecoveryRecord({
        recoveryStatus: 'recovering',
        retryCount: 1,
        updatedAt: '2026-06-04T18:01:00.000Z',
      })),
      retryBatch: overrides?.retryBatch ?? (async () => ({
        totalCount: 1,
        successCount: 1,
        failedCount: 0,
        skippedCount: 0,
        items: [
          {
            id: 'recovery-1',
            result: 'succeeded',
            recoveryStatus: 'recovered',
          },
        ],
      })),
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
  listPage?: ApiRouteDeps['orderRecoveryService']['listPage']
  retryById?: ApiRouteDeps['orderRecoveryService']['retryById']
  retryBatch?: ApiRouteDeps['orderRecoveryService']['retryBatch']
}) {
  const app = Fastify()
  await registerApiRoutes(app, createRouteDeps(overrides))
  return app
}

test('GET /api/order-recoveries/page 返回分页恢复任务数据', async () => {
  const app = await createTestApp({
    listPage: input => ({
      items: [createRecoveryRecord({ recoveryStatus: 'recovery_failed' })],
      total: 1,
      page: input.page,
      pageSize: input.pageSize,
    }),
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/order-recoveries/page?page=2&pageSize=5&statuses=recovery_failed&stages=order_sync',
  })

  assert.equal(response.statusCode, 200)
  const payload = response.json() as {
    items: OrderRecoveryRecord[]
    total: number
    page: number
    pageSize: number
  }
  assert.equal(payload.total, 1)
  assert.equal(payload.page, 2)
  assert.equal(payload.pageSize, 5)
  assert.equal(payload.items[0]?.recoveryStatus, 'recovery_failed')

  await app.close()
})

test('GET /api/order-recoveries/page 参数不合法时返回 400', async () => {
  const app = await createTestApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/order-recoveries/page?page=0&pageSize=0&statuses=unknown',
  })

  assert.equal(response.statusCode, 400)
  assert.match(response.body, /恢复任务分页查询参数不合法/)

  await app.close()
})

test('POST /api/order-recoveries/:id/retry 成功时返回恢复任务', async () => {
  const app = await createTestApp({
    retryById: async (id, reason) => createRecoveryRecord({
      id,
      recoveryStatus: 'recovering',
      retryCount: 1,
      updatedAt: '2026-06-04T18:01:00.000Z',
      lastErrorMessage: reason,
    }),
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/order-recoveries/recovery-2/retry',
  })

  assert.equal(response.statusCode, 200)
  const payload = response.json() as OrderRecoveryRecord
  assert.equal(payload.id, 'recovery-2')
  assert.equal(payload.recoveryStatus, 'recovering')
  assert.equal(payload.retryCount, 1)

  await app.close()
})

test('POST /api/order-recoveries/:id/retry 失败时返回 400', async () => {
  const app = await createTestApp({
    retryById: async () => {
      throw new Error('恢复任务不存在')
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/order-recoveries/recovery-missing/retry',
  })

  assert.equal(response.statusCode, 400)
  assert.match(response.body, /恢复任务不存在/)

  await app.close()
})

test('POST /api/order-recoveries/retry-batch 可按筛选条件批量重试', async () => {
  const app = await createTestApp({
    retryBatch: async input => {
      assert.deepEqual(input, {
        statuses: ['pending_recovery'],
        stages: ['order_sync'],
        exchanges: ['okx'],
        modes: ['real'],
        sources: ['manual'],
        limit: 30,
      })
      return {
        totalCount: 2,
        successCount: 1,
        failedCount: 1,
        skippedCount: 0,
        items: [
          { id: 'recovery-1', result: 'succeeded', recoveryStatus: 'recovered' },
          { id: 'recovery-2', result: 'failed', recoveryStatus: 'recovery_failed', message: '同步失败' },
        ],
      }
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/order-recoveries/retry-batch',
    payload: {
      statuses: ['pending_recovery'],
      stages: ['order_sync'],
      exchanges: ['okx'],
      modes: ['real'],
      sources: ['manual'],
      limit: 30,
    },
  })

  assert.equal(response.statusCode, 200)
  const payload = response.json() as { totalCount: number; failedCount: number }
  assert.equal(payload.totalCount, 2)
  assert.equal(payload.failedCount, 1)

  await app.close()
})

test('POST /api/order-recoveries/retry-batch 会返回缺失恢复任务 ID 的失败结果', async () => {
  const app = await createTestApp({
    retryBatch: async input => {
      assert.deepEqual(input, {
        ids: ['recovery-1', 'recovery-missing'],
        limit: 2,
      })
      return {
        totalCount: 2,
        successCount: 1,
        failedCount: 1,
        skippedCount: 0,
        items: [
          { id: 'recovery-1', result: 'succeeded', recoveryStatus: 'recovered' },
          { id: 'recovery-missing', result: 'failed', recoveryStatus: 'recovery_failed', message: '恢复任务不存在或已被删除' },
        ],
      }
    },
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/order-recoveries/retry-batch',
    payload: {
      ids: ['recovery-1', 'recovery-missing'],
      limit: 2,
    },
  })

  assert.equal(response.statusCode, 200)
  const payload = response.json() as { totalCount: number; failedCount: number }
  assert.equal(payload.totalCount, 2)
  assert.equal(payload.failedCount, 1)

  await app.close()
})

test('POST /api/order-recoveries/retry-batch 参数不合法时返回 400', async () => {
  const app = await createTestApp()

  const response = await app.inject({
    method: 'POST',
    url: '/api/order-recoveries/retry-batch',
    payload: {
      limit: 10,
    },
  })

  assert.equal(response.statusCode, 400)
  assert.match(response.body, /批量恢复参数不合法/)

  await app.close()
})
