import test from 'node:test'
import assert from 'node:assert/strict'
import { OrderRecoveryService } from '../apps/server/src/services/order-recovery.service.ts'
import type {
  AuditLog,
  OrderRecoveryFailureStage,
  OrderRecoveryRecord,
  OrderRecoveryStatus,
} from '../apps/server/src/types/domain.js'

class InMemoryOrderRecoveryRepository {
  private readonly records = new Map<string, OrderRecoveryRecord>()

  create(record: OrderRecoveryRecord) {
    this.records.set(record.id, record)
    return record
  }

  findById(id: string) {
    return this.records.get(id)
  }

  findLatestActiveByIdentityKey(identityKey: string) {
    return [...this.records.values()]
      .filter(record =>
        record.identityKey === identityKey
        && ['pending_recovery', 'recovering', 'recovery_failed', 'manual_review_required'].includes(record.recoveryStatus),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  }

  listPage() {
    return {
      items: [...this.records.values()],
      total: this.records.size,
      page: 1,
      pageSize: this.records.size,
    }
  }

  listDueForRetry(nowIso: string, limit: number) {
    return [...this.records.values()]
      .filter(record =>
        ['pending_recovery', 'recovery_failed'].includes(record.recoveryStatus)
        && (!record.nextRetryAt || record.nextRetryAt <= nowIso),
      )
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
      .slice(0, limit)
  }

  listByIds(ids: string[]) {
    const idSet = new Set(ids)
    return [...this.records.values()]
      .filter(record => idSet.has(record.id))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  listForBatch(input: {
    limit: number
    statuses?: OrderRecoveryStatus[]
    stages?: OrderRecoveryFailureStage[]
    exchanges?: OrderRecoveryRecord['exchange'][]
    modes?: OrderRecoveryRecord['mode'][]
    sources?: OrderRecoveryRecord['source'][]
  }) {
    return [...this.records.values()]
      .filter(record => !input.statuses || input.statuses.includes(record.recoveryStatus))
      .filter(record => !input.stages || input.stages.includes(record.failureStage))
      .filter(record => !input.exchanges || input.exchanges.includes(record.exchange))
      .filter(record => !input.modes || input.modes.includes(record.mode))
      .filter(record => !input.sources || input.sources.includes(record.source))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, input.limit)
  }

  update(record: OrderRecoveryRecord) {
    this.records.set(record.id, record)
    return record
  }

  findAll() {
    return [...this.records.values()]
  }
}

class InMemoryOrderRepository {
  private readonly orders = new Map<string, {
    id: string
    exchange: 'okx' | 'binance'
    exchangeOrderId: string
  } & Record<string, unknown>>()

  create(order: Record<string, unknown>) {
    this.orders.set(String(order.id), order as never)
    return order
  }

  findById(id: string) {
    return this.orders.get(id) as never
  }

  findByExchangeOrderId(exchange: 'okx' | 'binance', exchangeOrderId: string) {
    return [...this.orders.values()].find(order => order.exchange === exchange && order.exchangeOrderId === exchangeOrderId) as never
  }
}

class InMemoryAuditLogService {
  readonly logs: Array<{
    action: AuditLog['action']
    level?: AuditLog['level']
    message: string
    entityId?: string
    orderId?: string
    payload?: Record<string, unknown>
  }> = []

  record(input: {
    action: AuditLog['action']
    level?: AuditLog['level']
    message: string
    entityId?: string
    orderId?: string
    payload?: Record<string, unknown>
  }) {
    this.logs.push(input)
    return undefined
  }

  existsByActionAndEntity(input: { action: AuditLog['action']; orderId?: string; triggerId?: string }) {
    return this.logs.some(log => log.action === input.action && (!input.orderId || log.orderId === input.orderId))
  }
}

class InMemoryTriggerRepository {
  private readonly triggers = new Map<string, { id: string; status: string }>()

  seed(id: string, status = 'pending') {
    this.triggers.set(id, { id, status })
  }

  findById(id: string) {
    return this.triggers.get(id) as never
  }

  markConfirmed(id: string) {
    const current = this.triggers.get(id)
    if (!current) {
      return undefined
    }
    const next = { ...current, status: 'confirmed' }
    this.triggers.set(id, next)
    return next as never
  }
}

class StubRealOrderSyncService {
  syncOrderByIdCalls: string[] = []
  syncPendingOrdersByExchangeCalls: Array<{ exchange: string; limit: number }> = []
  shouldFail = false

  async syncOrderById(orderId: string) {
    this.syncOrderByIdCalls.push(orderId)
    if (this.shouldFail) {
      throw new Error('同步失败')
    }
  }

  async syncPendingOrdersByExchange(exchange: string, limit: number) {
    this.syncPendingOrdersByExchangeCalls.push({ exchange, limit })
    if (this.shouldFail) {
      throw new Error('同步失败')
    }
  }
}

function createService(options?: {
  maxRetryCount?: number
  retryDelayMs?: number
}) {
  const repository = new InMemoryOrderRecoveryRepository()
  const orderRepository = new InMemoryOrderRepository()
  const triggerRepository = new InMemoryTriggerRepository()
  const auditLogService = new InMemoryAuditLogService()
  const realOrderSyncService = new StubRealOrderSyncService()
  const service = new OrderRecoveryService(
    repository as never,
    orderRepository as never,
    triggerRepository as never,
    auditLogService as never,
    realOrderSyncService as never,
    {
      intervalMs: 10_000,
      maxRetryCount: options?.maxRetryCount ?? 3,
      batchSize: 20,
      retryDelayMs: options?.retryDelayMs ?? 30_000,
    },
  )

  return {
    service,
    repository,
    orderRepository,
    triggerRepository,
    auditLogService,
    realOrderSyncService,
  }
}

function createRecoveryInput(stage: OrderRecoveryFailureStage = 'order_sync') {
  return {
    identityKey: `identity:${stage}`,
    orderId: 'order-1',
    exchangeOrderId: 'exchange-order-1',
    exchange: 'okx' as const,
    source: 'manual' as const,
    mode: 'real' as const,
    symbol: 'BTC-USDT',
    failureStage: stage,
    lastErrorMessage: '首次失败',
    payload: {
      source: 'rest',
    },
  }
}

test('createOrRefresh 会复用同一 identityKey 的活动恢复任务', () => {
  const { service, repository, auditLogService } = createService()

  const first = service.createOrRefresh(createRecoveryInput())
  const second = service.createOrRefresh({
    ...createRecoveryInput(),
    lastErrorMessage: '第二次失败',
  })

  assert.equal(repository.findAll().length, 1)
  assert.equal(first.id, second.id)
  assert.equal(second.lastErrorMessage, '第二次失败')
  assert.equal(auditLogService.logs.filter(log => log.action === 'recovery.created').length, 1)
})

test('processDueRecoveries 成功后会将恢复任务标记为 recovered', async () => {
  const { service, repository, realOrderSyncService, auditLogService } = createService()

  const created = service.createOrRefresh(createRecoveryInput())
  await service.processDueRecoveries()

  const current = repository.findById(created.id)
  assert.ok(current)
  assert.equal(current?.recoveryStatus, 'recovered')
  assert.equal(current?.retryCount, 1)
  assert.equal(realOrderSyncService.syncOrderByIdCalls[0], 'order-1')
  assert.equal(auditLogService.logs.some(log => log.action === 'recovery.retry_succeeded'), true)
})

test('自动恢复超过最大次数后会转 manual_review_required', async () => {
  const { service, repository, realOrderSyncService, auditLogService } = createService({
    maxRetryCount: 1,
    retryDelayMs: 1_000,
  })
  realOrderSyncService.shouldFail = true

  const created = service.createOrRefresh(createRecoveryInput('trade_fill_sync'))
  await service.processDueRecoveries()

  const current = repository.findById(created.id)
  assert.ok(current)
  assert.equal(current?.recoveryStatus, 'manual_review_required')
  assert.equal(current?.retryCount, 1)
  assert.equal(current?.nextRetryAt, undefined)
  assert.equal(auditLogService.logs.some(log => log.action === 'recovery.manual_review_required'), true)
})

test('人工重试私有推送恢复任务时会按交易所触发近期真实订单同步', async () => {
  const { service, realOrderSyncService } = createService()

  const created = service.createOrRefresh({
    ...createRecoveryInput('private_stream'),
    orderId: undefined,
    symbol: undefined,
    identityKey: 'private_stream:exchange:okx',
  })
  const retried = await service.retryById(created.id, 'manual')

  assert.equal(retried.recoveryStatus, 'recovered')
  assert.deepEqual(realOrderSyncService.syncPendingOrdersByExchangeCalls, [{ exchange: 'okx', limit: 20 }])
})

test('人工重试缺少订单 ID 的订单同步任务会失败并保留失败状态', async () => {
  const { service, repository } = createService({
    maxRetryCount: 3,
  })

  const created = service.createOrRefresh({
    ...createRecoveryInput('order_sync'),
    orderId: undefined,
    identityKey: 'order_sync:missing-order-id',
  })

  await assert.rejects(() => service.retryById(created.id, 'manual'), /缺少本地订单 ID/)

  const current = repository.findById(created.id)
  assert.ok(current)
  assert.equal(current?.recoveryStatus, 'recovery_failed')
  assert.equal(current?.retryCount, 1)
})

test('订单提交落库恢复任务会重建最小订单记录并继续同步', async () => {
  const { service, orderRepository, realOrderSyncService } = createService()

  const created = service.createOrRefresh({
    ...createRecoveryInput('order_submit_finalize'),
    orderId: undefined,
    identityKey: 'order_submit_finalize:okx:exchange-order-2',
    payload: {
      symbol: 'ETH-USDT',
      side: 'buy',
      orderType: 'market',
      exchangeOrderId: 'exchange-order-2',
      status: 'submitted',
      rawMessage: '交易所已接单',
      quoteAmount: '100',
    },
  })

  const recovered = await service.retryById(created.id, 'manual')

  assert.equal(recovered.recoveryStatus, 'recovered')
  const restoredOrder = orderRepository.findByExchangeOrderId('okx', 'exchange-order-2')
  assert.ok(restoredOrder)
  assert.equal(String(restoredOrder.symbol), 'ETH-USDT')
  assert.equal(realOrderSyncService.syncOrderByIdCalls.length, 1)
})

test('规则确认收尾恢复任务会补齐触发状态和缺失审计', async () => {
  const { service, orderRepository, triggerRepository, auditLogService } = createService()
  triggerRepository.seed('trigger-1', 'pending')
  orderRepository.create({
    id: 'order-9',
    exchange: 'okx',
    exchangeOrderId: 'exchange-order-9',
    symbol: 'BTC-USDT',
    side: 'buy',
    orderType: 'market',
    simulationMode: false,
    rawMessage: 'submitted',
  })

  const created = service.createOrRefresh({
    ...createRecoveryInput('rule_trigger_finalize'),
    identityKey: 'rule_trigger_finalize:okx:exchange-order-9',
    orderId: 'order-9',
    exchangeOrderId: 'exchange-order-9',
    payload: {
      triggerId: 'trigger-1',
      ruleId: 'rule-1',
      orderId: 'order-9',
      executionMode: 'manual',
    },
  })

  const recovered = await service.retryById(created.id, 'manual')

  assert.equal(recovered.recoveryStatus, 'recovered')
  assert.equal((triggerRepository.findById('trigger-1') as { status: string }).status, 'confirmed')
  assert.equal(auditLogService.logs.some(log => log.action === 'trigger.confirmed' && log.orderId === 'order-9'), true)
  assert.equal(auditLogService.logs.some(log => log.action === 'order.submitted' && log.orderId === 'order-9'), true)
})

test('批量恢复会汇总成功、失败和跳过结果', async () => {
  const { service, repository } = createService()

  const succeeded = service.createOrRefresh({
    ...createRecoveryInput('trade_fill_sync'),
    identityKey: 'trade_fill_sync:order-2',
    orderId: 'order-2',
  })
  const skipped = service.createOrRefresh({
    ...createRecoveryInput('private_stream'),
    identityKey: 'private_stream:exchange:okx',
    orderId: undefined,
  })
  repository.update({
    ...skipped,
    recoveryStatus: 'recovered',
  })

  const result = await service.retryBatch({
    ids: [succeeded.id, skipped.id],
    limit: 20,
  })

  assert.equal(result.totalCount, 2)
  assert.equal(result.successCount, 1)
  assert.equal(result.failedCount, 0)
  assert.equal(result.skippedCount, 1)
  assert.equal(result.items.find(item => item.id === succeeded.id)?.result, 'succeeded')
  assert.equal(result.items.find(item => item.id === skipped.id)?.result, 'skipped')
})

test('批量恢复在单条失败时会继续处理并写入批量审计', async () => {
  const { service, auditLogService } = createService()

  service.createOrRefresh({
    ...createRecoveryInput('order_sync'),
    orderId: undefined,
    identityKey: 'order_sync:missing-order-id-batch',
  })
  service.createOrRefresh({
    ...createRecoveryInput('private_stream'),
    identityKey: 'private_stream:exchange:binance',
    exchange: 'binance',
    orderId: undefined,
  })

  const result = await service.retryBatch({
    statuses: ['pending_recovery'],
    limit: 20,
  })

  assert.equal(result.totalCount, 2)
  assert.equal(result.successCount, 1)
  assert.equal(result.failedCount, 1)
  assert.equal(result.skippedCount, 0)
  assert.equal(auditLogService.logs.some(log => log.action === 'recovery.batch_started'), true)
  assert.equal(auditLogService.logs.some(log => log.action === 'recovery.batch_finished'), true)
})

test('批量恢复会明确返回不存在的恢复任务 ID', async () => {
  const { service } = createService()

  const created = service.createOrRefresh(createRecoveryInput('trade_fill_sync'))
  const result = await service.retryBatch({
    ids: [created.id, 'recovery-missing'],
    limit: 20,
  })

  assert.equal(result.totalCount, 2)
  assert.equal(result.successCount, 1)
  assert.equal(result.failedCount, 1)
  assert.equal(result.items.some(item => item.id === 'recovery-missing' && item.message?.includes('不存在')), true)
})

// ── 风险 1 覆盖：order_submit_finalize payload 不完整时报错说明缺少哪些字段 ──
test('order_submit_finalize 缺少 exchangeOrderId 时报错信息包含字段名', async () => {
  const { service } = createService()

  const created = service.createOrRefresh({
    ...createRecoveryInput('order_submit_finalize'),
    orderId: undefined,
    exchangeOrderId: undefined, // record 层也没有 exchangeOrderId
    identityKey: 'order_submit_finalize:okx:missing-fields',
    payload: {
      symbol: 'ETH-USDT',
      side: 'buy',
      orderType: 'market',
      // exchangeOrderId 故意不填
    },
  })

  await assert.rejects(
    () => service.retryById(created.id, 'manual'),
    (error: Error) => {
      // 错误消息必须包含缺失字段名 exchangeOrderId，方便排查
      assert.ok(error.message.includes('exchangeOrderId'), `错误消息应包含 'exchangeOrderId'，实际：${error.message}`)
      return true
    },
  )
})

// ── 风险 2 覆盖：rule_trigger_finalize payload 缺 orderId 时报错指向具体字段 ──
test('rule_trigger_finalize 缺少 orderId 时报错信息明确指向 orderId', async () => {
  const { service, triggerRepository } = createService()
  triggerRepository.seed('trigger-2', 'pending')

  const created = service.createOrRefresh({
    ...createRecoveryInput('rule_trigger_finalize'),
    orderId: undefined, // record 层无 orderId
    identityKey: 'rule_trigger_finalize:okx:no-order-id',
    payload: {
      triggerId: 'trigger-2',
      ruleId: 'rule-1',
      // orderId 故意不填
      executionMode: 'manual',
    },
  })

  await assert.rejects(
    () => service.retryById(created.id, 'manual'),
    (error: Error) => {
      // 错误消息必须包含 orderId，明确是哪个字段缺失
      assert.ok(error.message.toLowerCase().includes('orderid'), `错误消息应包含 'orderId'，实际：${error.message}`)
      return true
    },
  )
})
