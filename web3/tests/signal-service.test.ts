import test from 'node:test'
import assert from 'node:assert/strict'
import { SignalService } from '../apps/server/src/services/signal.service.ts'
import type { MonitorRule, RiskCheck, TradingSignal, TriggerEvent } from '../apps/server/src/types/domain.js'

class InMemorySignalRepository {
  readonly signals: TradingSignal[] = []

  list() {
    return this.signals
  }

  findPendingByRuleId(ruleId: string) {
    return this.signals.find(signal => signal.ruleId === ruleId && signal.status === 'pending')
  }

  findLatestByRuleId(ruleId: string) {
    return [...this.signals].reverse().find(signal => signal.ruleId === ruleId)
  }

  create(signal: TradingSignal) {
    this.signals.push(signal)
    return signal
  }

  markRejected(id: string) {
    const current = this.signals.find(signal => signal.id === id)
    if (!current) {
      return undefined
    }
    current.status = 'rejected'
    return current
  }

  markConverted(id: string) {
    const current = this.signals.find(signal => signal.id === id)
    if (!current) {
      return undefined
    }
    current.status = 'converted'
    current.convertedAt = '2026-06-04T10:05:00.000Z'
    return current
  }
}

class InMemoryTriggerRepository {
  readonly triggers: TriggerEvent[] = []

  findPendingByRuleId(ruleId: string) {
    return this.triggers.find(trigger => trigger.ruleId === ruleId && trigger.status === 'pending')
  }

  create(trigger: TriggerEvent) {
    this.triggers.push(trigger)
    return trigger
  }
}

function createRule(overrides?: Partial<MonitorRule>): MonitorRule {
  return {
    id: 'rule-1',
    exchange: 'okx',
    symbol: 'ETH-USDT',
    operator: 'lte',
    targetPrice: '2000',
    checkIntervalMs: 3000,
    side: 'buy',
    orderType: 'market',
    quoteAmount: '100',
    maxSlippagePercent: '0.5',
    cooldownMs: 60000,
    maxTriggerCount: 3,
    triggeredCount: 0,
    simulationMode: true,
    enabled: true,
    runtimeStatus: 'running',
    createdAt: '2026-06-04T10:00:00.000Z',
    updatedAt: '2026-06-04T10:00:00.000Z',
    ...overrides,
  }
}

test('外部信号会按统一信号模型写入并生成触发事件', () => {
  const signalRepository = new InMemorySignalRepository()
  const triggerRepository = new InMemoryTriggerRepository()
  const rule = createRule()
  const service = new SignalService(
    signalRepository as never,
    {
      findById: () => rule,
    } as never,
    triggerRepository as never,
    {
      record: () => undefined,
    } as never,
    {
      checkSignal: () =>
        ({
          id: 'risk-1',
          signalId: 'signal-1',
          ruleId: rule.id,
          exchange: rule.exchange,
          symbol: rule.symbol,
          status: 'passed',
          reason: '通过',
          quoteExposure: '100',
          marketPrice: '1995',
          itemsJson: '[]',
          statDate: '2026-06-04',
          createdAt: '2026-06-04T10:02:00.000Z',
        } satisfies RiskCheck),
    } as never,
  )

  const result = service.createExternalSignal({
    ruleId: rule.id,
    marketPrice: '1995',
    reason: '研究系统给出买入信号',
    sourceKey: 'research-001',
    sourceLabel: 'research',
    metadata: {
      confidence: '0.91',
    },
  })

  assert.ok(result.signal)
  assert.equal(result.signal?.sourceType, 'external_input')
  assert.equal(result.signal?.exchange, 'okx')
  assert.equal(triggerRepository.triggers.length, 1)
  assert.equal(result.trigger?.ruleId, rule.id)
})

test('外部信号要求关联规则已启用', () => {
  const service = new SignalService(
    new InMemorySignalRepository() as never,
    {
      findById: () => createRule({ enabled: false }),
    } as never,
    new InMemoryTriggerRepository() as never,
    {
      record: () => undefined,
    } as never,
    {
      checkSignal: () => undefined,
    } as never,
  )

  assert.throws(
    () =>
      service.createExternalSignal({
        ruleId: 'rule-1',
        marketPrice: '1995',
        reason: 'disabled rule',
      }),
    /未启用/,
  )
})

test('外部信号被同规则 pending trigger 阻断时抛出明确错误', () => {
  const signalRepository = new InMemorySignalRepository()
  const triggerRepository = new InMemoryTriggerRepository()
  const rule = createRule()

  // 才入一个待确认触发事件
  triggerRepository.triggers.push({
    id: 'trigger-pending',
    ruleId: rule.id,
    exchange: rule.exchange,
    symbol: rule.symbol,
    marketPrice: '1990',
    targetPrice: rule.targetPrice,
    status: 'pending',
    createdAt: new Date().toISOString(),
  })

  const service = new SignalService(
    signalRepository as never,
    { findById: () => rule } as never,
    triggerRepository as never,
    { record: () => undefined } as never,
    { checkSignal: () => undefined } as never,
  )

  assert.throws(
    () => service.createExternalSignal({ ruleId: rule.id, marketPrice: '1990', reason: '外部测试信号' }),
    /待确认触发事件/,
  )
})

test('外部信号被同规则 pending signal 阻断时抛出明确错误', () => {
  const signalRepository = new InMemorySignalRepository()
  const triggerRepository = new InMemoryTriggerRepository()
  const rule = createRule()

  // 才入一个待处理信号
  signalRepository.signals.push({
    id: 'signal-pending',
    ruleId: rule.id,
    exchange: rule.exchange,
    symbol: rule.symbol,
    marketPrice: '1990',
    marketEventTime: new Date().toISOString(),
    sourceType: 'price_rule',
    targetPrice: rule.targetPrice,
    operator: rule.operator,
    side: rule.side,
    orderType: rule.orderType,
    quoteAmount: rule.quoteAmount,
    simulationMode: rule.simulationMode,
    status: 'pending',
    reason: '价格命中',
    createdAt: new Date().toISOString(),
  })

  const service = new SignalService(
    signalRepository as never,
    { findById: () => rule } as never,
    triggerRepository as never,
    { record: () => undefined } as never,
    { checkSignal: () => undefined } as never,
  )

  assert.throws(
    () => service.createExternalSignal({ ruleId: rule.id, marketPrice: '1990', reason: '外部测试信号' }),
    /待处理信号/,
  )
})
