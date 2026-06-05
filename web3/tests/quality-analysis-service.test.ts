import test from 'node:test'
import assert from 'node:assert/strict'
import { Decimal } from 'decimal.js'
import { QualityAnalysisService } from '../apps/server/src/services/quality-analysis.service.ts'
import { toLocalDateString } from '../apps/server/src/utils/local-date.ts'

class StubOrderRepository {
  analysisRecords: any[] = []

  listAnalysisRecords() {
    return this.analysisRecords
  }
}

class StubTradeAccountRepository {
  fills: any[] = []

  listFillsForAnalysis() {
    return this.fills
  }
}

class StubAuditLogRepository {
  audits: any[] = []

  listAuditsForAnalysis() {
    return this.audits
  }
}

test('QualityAnalysisService 会正确计算综合交易质量指标且空档能正常补全', () => {
  const orderRepo = new StubOrderRepository()
  const tradeAccountRepo = new StubTradeAccountRepository()
  const auditRepo = new StubAuditLogRepository()

  const service = new QualityAnalysisService(
    orderRepo as any,
    tradeAccountRepo as any,
    auditRepo as any,
  )

  const todayStr = new Date().toISOString().slice(0, 10)

  // 模拟一个完全成交并有滑点和延迟的订单
  orderRepo.analysisRecords = [
    {
      id: 'order-1',
      exchange: 'okx',
      symbol: 'BTC-USDT',
      side: 'buy',
      status: 'filled',
      orderCreatedTime: `${todayStr}T10:00:05.000Z`,
      triggerCreatedTime: `${todayStr}T10:00:00.000Z`, // 响应延迟 5000ms
      triggerMarketPrice: '60000',
      maxFillCreatedTime: `${todayStr}T10:00:08.000Z`,  // 撮合成交延迟 3000ms
      fillAvgPrice: 60060,                              // 滑点 60 / 60000 = 0.1% = 0.001
    },
    {
      id: 'order-2',
      exchange: 'okx',
      symbol: 'ETH-USDT',
      side: 'sell',
      status: 'failed',
      orderCreatedTime: `${todayStr}T11:00:00.000Z`,
      triggerCreatedTime: null,
      triggerMarketPrice: null,
      maxFillCreatedTime: null,
      fillAvgPrice: null,
    }
  ]

  // 模拟两个平仓成交用于胜率和盈亏比计算
  tradeAccountRepo.fills = [
    {
      id: 'fill-1',
      symbol: 'BTC-USDT',
      side: 'sell',
      quoteAmount: '60060',
      realizedPnl: '100', // 盈利
      createdAt: `${todayStr}T10:00:08.000Z`,
    },
    {
      id: 'fill-2',
      symbol: 'BTC-USDT',
      side: 'sell',
      quoteAmount: '50000',
      realizedPnl: '-50', // 亏损
      createdAt: `${todayStr}T10:00:10.000Z`,
    }
  ]

  // 模拟一个失败的审计日志
  auditRepo.audits = [
    {
      id: 'audit-1',
      action: 'order.failed',
      message: '确认下单失败：余额不足',
      payloadJson: JSON.stringify({ errorMessage: '余额不足' }),
      createdAt: `${todayStr}T11:00:01.000Z`,
    }
  ]

  const result = service.getQualityAnalysis({ days: 3 })

  // 验证概览指标
  assert.equal(result.summary.totalOrderCount, 2)
  assert.equal(result.summary.filledOrderCount, 1)
  assert.equal(result.summary.failedOrderCount, 1)
  assert.equal(result.summary.fillRate, 0.5)
  assert.equal(result.summary.avgTriggerLatencyMs, 5000)
  assert.equal(result.summary.avgExecutionLatencyMs, 3000)
  // 滑点百分比 0.1% = 0.1
  assert.ok(Math.abs(result.summary.avgSlippagePercent - 0.1) < 0.0001)

  // 胜率与盈亏比
  assert.equal(result.summary.winRate, 0.5) // 1个盈利 1个亏损 = 50%
  assert.equal(result.summary.profitLossRatio, 2) // 平均盈利 100 / 平均亏损 50 = 2

  // 状态分布
  assert.equal(result.statusDistribution.find(d => d.name === '已成交')?.value, 1)
  assert.equal(result.statusDistribution.find(d => d.name === '失败/拒绝')?.value, 1)

  // 交易对排行
  assert.equal(result.topSymbols.length, 1)
  assert.equal(result.topSymbols[0]?.symbol, 'BTC-USDT')
  assert.equal(result.topSymbols[0]?.volume, '110060.0000') // 60060 + 50000 = 110060
  assert.equal(result.topSymbols[0]?.realizedPnl, '50.0000')  // 100 - 50 = 50

  // 每日趋势
  assert.equal(result.dailyTrend.length, 3)
  assert.equal(result.dailyTrend[0]?.date, todayStr)
  assert.ok(Math.abs((result.dailyTrend[0]?.avgSlippagePercent ?? 0) - 0.1) < 0.0001)
  assert.equal(result.dailyTrend[0]?.avgExecutionLatencyMs, 3000)

  // 失败排行
  assert.equal(result.failedReasons.length, 1)
  assert.equal(result.failedReasons[0]?.reason, '余额不足')
  assert.equal(result.failedReasons[0]?.count, 1)
})

test('QualityAnalysisService.getQualityAnalysis 应该在指定 exchange 或 mode 时对失败日志进行过滤', () => {
  const orderRepo = new StubOrderRepository()
  const tradeAccountRepo = new StubTradeAccountRepository()
  const auditRepo = new StubAuditLogRepository()

  const service = new QualityAnalysisService(
    orderRepo as any,
    tradeAccountRepo as any,
    auditRepo as any,
  )

  const todayStr = new Date().toISOString().slice(0, 10)

  // 模拟失败审计日志
  auditRepo.audits = [
    {
      id: 'audit-okx-real',
      action: 'order.failed',
      message: 'OKX真实失败',
      payloadJson: JSON.stringify({ exchange: 'okx', mode: 'real', errorMessage: 'OKX真实失败' }),
      createdAt: `${todayStr}T12:00:00.000Z`,
    },
    {
      id: 'audit-binance-real',
      action: 'order.failed',
      message: 'Binance真实失败',
      payloadJson: JSON.stringify({ exchange: 'binance', mode: 'real', errorMessage: 'Binance真实失败' }),
      createdAt: `${todayStr}T12:01:00.000Z`,
    },
    {
      id: 'audit-okx-sim',
      action: 'order.failed',
      message: 'OKX模拟失败',
      payloadJson: JSON.stringify({ exchange: 'okx', mode: 'simulation', errorMessage: 'OKX模拟失败' }),
      createdAt: `${todayStr}T12:02:00.000Z`,
    },
    {
      id: 'audit-no-payload',
      action: 'order.failed',
      message: '无Payload失败',
      payloadJson: null,
      createdAt: `${todayStr}T12:03:00.000Z`,
    }
  ]

  // 情况 1: 不筛选，全部都应该返回，且无Payload失败回退到 message
  const resAll = service.getQualityAnalysis({ days: 1 })
  assert.equal(resAll.failedReasons.length, 4)

  // 情况 2: 仅筛选 exchange = 'okx'
  const resOkx = service.getQualityAnalysis({ days: 1, exchange: 'okx' })
  // 应当只包含 okx-real 和 okx-sim
  assert.equal(resOkx.failedReasons.length, 2)
  assert.ok(resOkx.failedReasons.some(r => r.reason === 'OKX真实失败'))
  assert.ok(resOkx.failedReasons.some(r => r.reason === 'OKX模拟失败'))

  // 情况 3: 仅筛选 mode = 'real'
  const resReal = service.getQualityAnalysis({ days: 1, mode: 'real' })
  // 应当只包含 okx-real 和 binance-real
  assert.equal(resReal.failedReasons.length, 2)
  assert.ok(resReal.failedReasons.some(r => r.reason === 'OKX真实失败'))
  assert.ok(resReal.failedReasons.some(r => r.reason === 'Binance真实失败'))

  // 情况 4: 同时筛选 exchange = 'okx' 且 mode = 'real'
  const resOkxReal = service.getQualityAnalysis({ days: 1, exchange: 'okx', mode: 'real' })
  // 应当只包含 okx-real
  assert.equal(resOkxReal.failedReasons.length, 1)
  assert.equal(resOkxReal.failedReasons[0]?.reason, 'OKX真实失败')
})

test('QualityAnalysisService 不应将已取消订单重复计入失败统计', () => {
  const orderRepo = new StubOrderRepository()
  const tradeAccountRepo = new StubTradeAccountRepository()
  const auditRepo = new StubAuditLogRepository()
  const service = new QualityAnalysisService(orderRepo as any, tradeAccountRepo as any, auditRepo as any)

  const today = new Date()
  const todayStr = toLocalDateString(today)

  orderRepo.analysisRecords = [
    {
      id: 'filled-order',
      exchange: 'okx',
      symbol: 'BTC-USDT',
      side: 'buy',
      status: 'filled',
      orderCreatedTime: `${todayStr}T10:00:00.000Z`,
      triggerCreatedTime: null,
      triggerMarketPrice: null,
      maxFillCreatedTime: null,
      fillAvgPrice: null,
    },
    {
      id: 'failed-order',
      exchange: 'okx',
      symbol: 'ETH-USDT',
      side: 'sell',
      status: 'failed',
      orderCreatedTime: `${todayStr}T11:00:00.000Z`,
      triggerCreatedTime: null,
      triggerMarketPrice: null,
      maxFillCreatedTime: null,
      fillAvgPrice: null,
    },
    {
      id: 'cancelled-order',
      exchange: 'okx',
      symbol: 'SOL-USDT',
      side: 'sell',
      status: 'cancelled',
      orderCreatedTime: `${todayStr}T12:00:00.000Z`,
      triggerCreatedTime: null,
      triggerMarketPrice: null,
      maxFillCreatedTime: null,
      fillAvgPrice: null,
    },
  ]

  const result = service.getQualityAnalysis({ days: 1 })

  assert.equal(result.summary.totalOrderCount, 3)
  assert.equal(result.summary.filledOrderCount, 1)
  assert.equal(result.summary.failedOrderCount, 1)
  assert.equal(result.summary.cancelledOrderCount, 1)
  assert.equal(result.statusDistribution.find(item => item.name === '失败/拒绝')?.value, 1)
  assert.equal(result.statusDistribution.find(item => item.name === '已取消')?.value, 1)
})

test('QualityAnalysisService 日趋势应该按本地日期归档而不是 UTC 前缀归档', () => {
  const orderRepo = new StubOrderRepository()
  const tradeAccountRepo = new StubTradeAccountRepository()
  const auditRepo = new StubAuditLogRepository()
  const service = new QualityAnalysisService(orderRepo as any, tradeAccountRepo as any, auditRepo as any)

  const localNow = new Date()
  const targetLocalDate = toLocalDateString(localNow)
  const localNearMidnight = new Date(`${targetLocalDate}T00:30:00`)
  const utcIso = localNearMidnight.toISOString()

  orderRepo.analysisRecords = [
    {
      id: 'filled-near-midnight',
      exchange: 'okx',
      symbol: 'BTC-USDT',
      side: 'buy',
      status: 'filled',
      orderCreatedTime: utcIso,
      triggerCreatedTime: utcIso,
      triggerMarketPrice: '100',
      maxFillCreatedTime: new Date(localNearMidnight.getTime() + 1000).toISOString(),
      fillAvgPrice: 100.1,
    },
  ]

  const result = service.getQualityAnalysis({ days: 1 })

  assert.equal(result.dailyTrend[0]?.date, targetLocalDate)
  assert.ok((result.dailyTrend[0]?.avgExecutionLatencyMs ?? 0) > 0)
  assert.ok((result.dailyTrend[0]?.avgSlippagePercent ?? 0) > 0)
})
