import test from 'node:test'
import assert from 'node:assert/strict'
import { OrderService } from '../apps/server/src/services/order.service.ts'
import type { MonitorRule, OrderPreview, OrderRecord, TriggerEvent } from '../apps/server/src/types/domain.js'

function createRule(overrides?: Partial<MonitorRule>): MonitorRule {
  return {
    id: 'rule-1',
    exchange: 'okx',
    symbol: 'BTC-USDT',
    operator: 'gte',
    targetPrice: '70000',
    checkIntervalMs: 3000,
    side: 'buy',
    orderType: 'market',
    quoteAmount: '50',
    maxSlippagePercent: '0.5',
    cooldownMs: 60000,
    maxTriggerCount: 1,
    triggeredCount: 0,
    simulationMode: false,
    enabled: true,
    runtimeStatus: 'running',
    createdAt: '2026-06-04T10:00:00.000Z',
    updatedAt: '2026-06-04T10:00:00.000Z',
    ...overrides,
  }
}

function createTrigger(overrides?: Partial<TriggerEvent>): TriggerEvent {
  return {
    id: 'trigger-1',
    ruleId: 'rule-1',
    exchange: 'okx',
    symbol: 'BTC-USDT',
    marketPrice: '70500',
    targetPrice: '70000',
    status: 'pending',
    createdAt: '2026-06-04T10:01:00.000Z',
    ...overrides,
  }
}

function createPreview(overrides?: Partial<OrderPreview>): OrderPreview {
  return {
    triggerId: 'trigger-1',
    ruleId: 'rule-1',
    exchange: 'okx',
    symbol: 'BTC-USDT',
    side: 'buy',
    orderType: 'market',
    targetPrice: '70000',
    triggerPrice: '70500',
    executionPrice: '70510',
    quoteAmount: '50',
    estimatedQuoteAmount: '50',
    maxSlippagePercent: '0.5',
    simulationMode: false,
    tradingRulePassed: true,
    tradingRuleItems: [],
    riskPassed: true,
    riskItems: [],
    accountPassed: true,
    accountItems: [],
    previewedAt: '2026-06-04T10:02:00.000Z',
    ...overrides,
  }
}

function createOrder(overrides?: Partial<OrderRecord>): OrderRecord {
  return {
    id: 'order-1',
    triggerId: 'trigger-1',
    ruleId: 'rule-1',
    exchange: 'okx',
    symbol: 'BTC-USDT',
    side: 'buy',
    orderType: 'market',
    quoteAmount: '50',
    exchangeOrderId: 'exchange-order-1',
    status: 'submitted',
    simulationMode: false,
    rawMessage: 'submitted',
    createdAt: '2026-06-04T10:02:30.000Z',
    ...overrides,
  }
}

test('规则确认成功后审计补充失败会登记收尾恢复任务并继续返回订单', async () => {
  const rule = createRule()
  const trigger = createTrigger()
  const preview = createPreview()
  const order = createOrder()
  let currentTrigger = trigger
  const recoveryCalls: Array<Record<string, unknown>> = []
  const auditLogs: Array<{ action: string; message: string }> = []

  const service = new OrderService(
    {
      findById: () => rule,
    } as never,
    {
      findById: () => currentTrigger,
      markConfirmed: () => {
        currentTrigger = { ...currentTrigger, status: 'confirmed', confirmedAt: '2026-06-04T10:03:00.000Z' }
        return currentTrigger
      },
      markFailed: () => {
        currentTrigger = { ...currentTrigger, status: 'failed', confirmedAt: '2026-06-04T10:03:30.000Z' }
        return currentTrigger
      },
    } as never,
    {
      preview: async () => preview,
    } as never,
    {
      confirmRuleTrigger: async () => order,
    } as never,
    {
      record: (input: { action: string; message: string }) => {
        auditLogs.push(input)
        if (input.action === 'trigger.confirmed') {
          throw new Error('触发确认审计写入失败')
        }
        return undefined
      },
    } as never,
    {
      createOrRefresh: (input: Record<string, unknown>) => {
        recoveryCalls.push(input)
        return undefined
      },
    } as never,
  )

  const result = await service.confirmTrigger('trigger-1', { executionMode: 'manual' })

  assert.equal(result.id, 'order-1')
  assert.equal(currentTrigger.status, 'confirmed')
  assert.equal(recoveryCalls.length, 1)
  assert.equal(recoveryCalls[0]?.failureStage, 'rule_trigger_finalize')
  assert.equal(recoveryCalls[0]?.orderId, 'order-1')
  assert.equal(recoveryCalls[0]?.exchangeOrderId, 'exchange-order-1')
  assert.equal(auditLogs.some(log => log.action === 'trigger.failed'), false)
})
