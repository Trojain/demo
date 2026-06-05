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
    url: '/api/order-recoveries/page?page=0&pageSize=0',
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
