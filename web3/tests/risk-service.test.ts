import test from 'node:test'
import assert from 'node:assert/strict'
import { RiskService } from '../apps/server/src/services/risk.service.ts'
import type { DailyRiskStats, MonitorRule, TradingSignal } from '../apps/server/src/types/domain.js'

class StubRiskCheckRepository {
  readonly createdChecks: Array<Record<string, unknown>> = []

  getPassedStatsByDate() {
    return {
      count: 2,
      quoteAmount: '160',
    }
  }

  create(check: Record<string, unknown>) {
    this.createdChecks.push(check)
    return check as never
  }

  listDailyStats(): DailyRiskStats[] {
    // 日期动态计算，避免绝对日期随时间推移失效
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const shiftDay = (days: number) => {
      const d = new Date()
      d.setDate(d.getDate() + days)
      return fmtDate(d)
    }
    return [
      {
        statDate: shiftDay(0), // 今天
        passedCount: 2,
        passedQuoteAmount: '160',
        rejectedCount: 1,
        rejectedQuoteAmount: '30',
        totalCount: 3,
        totalQuoteAmount: '190',
      },
      {
        statDate: shiftDay(-3), // 3 天前，中间有两天空档
        passedCount: 1,
        passedQuoteAmount: '50',
        rejectedCount: 0,
        rejectedQuoteAmount: '0',
        totalCount: 1,
        totalQuoteAmount: '50',
      },
    ]
  }
}

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
    quoteAmount: '80',
    maxSlippagePercent: '0.5',
    cooldownMs: 60000,
    maxTriggerCount: 5,
    triggeredCount: 0,
    simulationMode: true,
    enabled: true,
    runtimeStatus: 'running',
    createdAt: '2026-06-04T10:00:00.000Z',
    updatedAt: '2026-06-04T10:00:00.000Z',
    ...overrides,
  }
}

function createSignal(overrides?: Partial<TradingSignal>): TradingSignal {
  return {
    id: 'signal-1',
    ruleId: 'rule-1',
    exchange: 'okx',
    symbol: 'BTC-USDT',
    marketPrice: '70100',
    marketEventTime: new Date().toISOString(),
    sourceType: 'price_rule',
    targetPrice: '70000',
    operator: 'gte',
    side: 'buy',
    orderType: 'market',
    quoteAmount: '80',
    simulationMode: true,
    status: 'pending',
    reason: 'price matched',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

test('RiskService 会按本地日期补齐缺失的日统计空档', () => {
  const repository = new StubRiskCheckRepository()
  const service = new RiskService(
    repository as never,
    {
      record: () => undefined,
    } as never,
    {
      getConfig: () => ({
        maxQuoteAmount: '500',
        maxMarketAgeMs: 60_000,
        dailyMaxTriggerCount: 10,
        dailyMaxQuoteAmount: '1000',
        tradingMode: 'allow_real',
        updatedAt: '2026-06-04T00:00:00.000Z',
      }),
    } as never,
    {
      enableRealTrading: true,
    },
  )

  const items = service.listDailyStats(3)

  // today 动态计算，避免测试因日期推移而失效
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  assert.equal(items.length, 3)
  assert.equal(items[0]?.statDate, todayStr) // 最新一天（今天，有数据）
  assert.equal(items[1]?.totalCount, 0)       // 居中空档日期被补全
  assert.equal(items[2]?.statDate <= items[1]?.statDate, true) // 按日期倒序
})

test('RiskService 会把日维度统计日期写入风控记录', () => {

  const repository = new StubRiskCheckRepository()
  const service = new RiskService(
    repository as never,
    {
      record: () => undefined,
    } as never,
    {
      getConfig: () => ({
        maxQuoteAmount: '500',
        maxMarketAgeMs: 60_000,
        dailyMaxTriggerCount: 10,
        dailyMaxQuoteAmount: '1000',
        tradingMode: 'allow_real',
        updatedAt: '2026-06-04T00:00:00.000Z',
      }),
    } as never,
    {
      enableRealTrading: true,
    },
  )

  const signal = createSignal()
  const check = service.checkSignal({
    signal,
    rule: createRule(),
    hasPendingTrigger: false,
  })

  assert.equal(typeof check.statDate, 'string')
  assert.equal(check.statDate.length, 10)
  assert.equal(repository.createdChecks.length, 1)
})
