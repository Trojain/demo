import { Decimal } from 'decimal.js'
import type { OrderRepository } from '../repositories/order.repository.js'
import type { TradeAccountRepository } from '../repositories/trade-account.repository.js'
import type { AuditLogRepository } from '../repositories/audit-log.repository.js'
import { formatLocalDate, shiftLocalDate, toLocalDateString } from '../utils/local-date.js'

export interface TradeQualityAnalysisResult {
  summary: {
    totalOrderCount: number
    filledOrderCount: number
    failedOrderCount: number
    cancelledOrderCount: number
    fillRate: number
    avgTriggerLatencyMs: number
    avgExecutionLatencyMs: number
    avgSlippagePercent: number
    winRate: number
    profitLossRatio: number
  }
  statusDistribution: Array<{
    name: string
    value: number
  }>
  topSymbols: Array<{
    symbol: string
    volume: string
    count: number
    realizedPnl: string
  }>
  dailyTrend: Array<{
    date: string
    avgSlippagePercent: number
    avgExecutionLatencyMs: number
  }>
  failedReasons: Array<{
    reason: string
    count: number
  }>
}

export class QualityAnalysisService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly tradeAccountRepository: TradeAccountRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  getQualityAnalysis(input: {
    days: number
    exchange?: string
    mode?: 'simulation' | 'real'
  }): TradeQualityAnalysisResult {
    const { days, exchange, mode } = input
    const today = formatLocalDate(new Date())
    const fromDate = shiftLocalDate(today, -(days - 1))

    // 1. 查询基础数据
    const orders = this.orderRepository.listAnalysisRecords({ fromDate, toDate: today, exchange, mode })
    const fills = this.tradeAccountRepository.listFillsForAnalysis({ fromDate, toDate: today, exchange, mode })
    const failedAudits = this.auditLogRepository.listAuditsForAnalysis({ fromDate, toDate: today, action: 'order.failed' })

    // 2. 统计 summary 指标
    const totalOrderCount = orders.length
    const filledOrderCount = orders.filter(o => o.status === 'filled').length
    const cancelledOrderCount = orders.filter(o => o.status === 'cancelled').length
    const failedOrderCount = orders.filter(o => ['failed', 'rejected'].includes(o.status)).length
    const fillRate = totalOrderCount > 0 ? filledOrderCount / totalOrderCount : 0

    // 计算平均触发响应延迟 (Trigger-to-Order)
    let triggerLatencySum = 0
    let triggerLatencyCount = 0
    // 计算平均撮合成交延迟 (Order-to-Fill)
    let execLatencySum = 0
    let execLatencyCount = 0
    // 计算平均滑点
    let slippageSum = 0
    let slippageCount = 0

    orders.forEach(o => {
      // 触发响应延迟
      if (o.triggerCreatedTime) {
        const diff = new Date(o.orderCreatedTime).getTime() - new Date(o.triggerCreatedTime).getTime()
        if (diff >= 0) {
          triggerLatencySum += diff
          triggerLatencyCount++
        }
      }

      // 撮合成交延迟 与 滑点
      if (o.status === 'filled') {
        if (o.maxFillCreatedTime) {
          const diff = new Date(o.maxFillCreatedTime).getTime() - new Date(o.orderCreatedTime).getTime()
          if (diff >= 0) {
            execLatencySum += diff
            execLatencyCount++
          }
        }

        if (o.triggerMarketPrice && o.fillAvgPrice) {
          const triggerPrice = new Decimal(o.triggerMarketPrice)
          if (triggerPrice.greaterThan(0)) {
            const fillPrice = new Decimal(o.fillAvgPrice)
            const slip = fillPrice.minus(triggerPrice).abs().div(triggerPrice).toNumber()
            slippageSum += slip
            slippageCount++
          }
        }
      }
    })

    const avgTriggerLatencyMs = triggerLatencyCount > 0 ? triggerLatencySum / triggerLatencyCount : 0
    const avgExecutionLatencyMs = execLatencyCount > 0 ? execLatencySum / execLatencyCount : 0
    // 转换为百分比
    const avgSlippagePercent = slippageCount > 0 ? (slippageSum / slippageCount) * 100 : 0

    // 胜率与盈亏比统计 (仅限 side === 'sell' 且有 realizedPnl 的 fills)
    const sellFills = fills.filter(f => f.side === 'sell' && f.realizedPnl && Number(f.realizedPnl) !== 0)
    const winFills = sellFills.filter(f => Number(f.realizedPnl) > 0)
    const loseFills = sellFills.filter(f => Number(f.realizedPnl) < 0)
    const winRate = sellFills.length > 0 ? winFills.length / sellFills.length : 0

    let profitLossRatio = 0
    if (winFills.length > 0) {
      const avgWin = winFills.reduce((sum, f) => sum.plus(f.realizedPnl), new Decimal(0)).div(winFills.length)
      if (loseFills.length > 0) {
        const avgLose = loseFills.reduce((sum, f) => sum.plus(f.realizedPnl), new Decimal(0)).div(loseFills.length).abs()
        profitLossRatio = avgLose.greaterThan(0) ? avgWin.div(avgLose).toNumber() : 999
      } else {
        profitLossRatio = 999 // 无亏损只有盈利
      }
    }

    const summary = {
      totalOrderCount,
      filledOrderCount,
      failedOrderCount,
      cancelledOrderCount,
      fillRate,
      avgTriggerLatencyMs,
      avgExecutionLatencyMs,
      avgSlippagePercent,
      winRate,
      profitLossRatio,
    }

    // 3. 统计 statusDistribution
    const statusDistribution = [
      { name: '已成交', value: filledOrderCount },
      { name: '失败/拒绝', value: failedOrderCount },
      { name: '已取消', value: cancelledOrderCount },
    ]
    // 如有其他订单状态也可以统计进去
    const otherCount = totalOrderCount - (filledOrderCount + failedOrderCount + cancelledOrderCount)
    if (otherCount > 0) {
      statusDistribution.push({ name: '其他', value: otherCount })
    }

    // 4. 统计 topSymbols (交易对成交额排行)
    const symbolMap = new Map<string, { volume: Decimal; count: number; realizedPnl: Decimal }>()
    fills.forEach(f => {
      const current = symbolMap.get(f.symbol) ?? { volume: new Decimal(0), count: 0, realizedPnl: new Decimal(0) }
      current.volume = current.volume.plus(f.quoteAmount)
      current.count += 1
      if (f.realizedPnl) {
        current.realizedPnl = current.realizedPnl.plus(f.realizedPnl)
      }
      symbolMap.set(f.symbol, current)
    })

    const topSymbols = Array.from(symbolMap.entries())
      .map(([symbol, stats]) => ({
        symbol,
        volume: stats.volume.toFixed(4),
        count: stats.count,
        realizedPnl: stats.realizedPnl.toFixed(4),
      }))
      .sort((a, b) => Number(b.volume) - Number(a.volume))
      .slice(0, 10)

    // 5. 统计 dailyTrend
    // 按本地日期分组，然后补全近 days 天，保证和日报聚合口径一致。
    const filledOrdersByDate = new Map<string, typeof orders>()
    orders
      .filter(order => order.status === 'filled')
      .forEach(order => {
        const localDate = toLocalDateString(order.orderCreatedTime)
        const current = filledOrdersByDate.get(localDate) ?? []
        current.push(order)
        filledOrdersByDate.set(localDate, current)
      })

    const dailyTrend = Array.from({ length: days }, (_, index) => {
      const date = shiftLocalDate(today, -index)
      const dayFilledOrders = filledOrdersByDate.get(date) ?? []

      let daySlipSum = 0
      let daySlipCount = 0
      let dayExecSum = 0
      let dayExecCount = 0

      dayFilledOrders.forEach(o => {
        if (o.maxFillCreatedTime) {
          const diff = new Date(o.maxFillCreatedTime).getTime() - new Date(o.orderCreatedTime).getTime()
          if (diff >= 0) {
            dayExecSum += diff
            dayExecCount++
          }
        }
        if (o.triggerMarketPrice && o.fillAvgPrice) {
          const triggerPrice = new Decimal(o.triggerMarketPrice)
          if (triggerPrice.greaterThan(0)) {
            const slip = new Decimal(o.fillAvgPrice).minus(triggerPrice).abs().div(triggerPrice).toNumber()
            daySlipSum += slip
            daySlipCount++
          }
        }
      })

      return {
        date,
        avgSlippagePercent: daySlipCount > 0 ? (daySlipSum / daySlipCount) * 100 : 0,
        avgExecutionLatencyMs: dayExecCount > 0 ? dayExecSum / dayExecCount : 0,
      }
    })

    // 6. 统计 failedReasons
    const reasonsMap = new Map<string, number>()
    // 内存过滤：按 exchange 和 mode 对失败日志过滤，保证多维筛选口径对齐
    const filteredFailedAudits = failedAudits.filter(audit => {
      if (!exchange && !mode) {
        return true
      }
      if (!audit.payloadJson) {
        return false
      }
      try {
        const payload = JSON.parse(audit.payloadJson)
        if (exchange && payload.exchange !== exchange) {
          return false
        }
        if (mode && payload.mode !== mode) {
          return false
        }
        return true
      } catch {
        return false
      }
    })

    filteredFailedAudits.forEach(audit => {
      let reason = ''
      if (audit.payloadJson) {
        try {
          const payload = JSON.parse(audit.payloadJson)
          reason = payload.errorMessage || payload.rawMessage || audit.message
        } catch {
          reason = audit.message
        }
      } else {
        reason = audit.message
      }

      // 清理错误原因前缀使统计更精简，如去除 “下单最终校验未通过：” 等前缀
      if (reason.startsWith('下单最终校验未通过：')) {
        reason = reason.replace('下单最终校验未通过：', '')
      }
      if (reason.startsWith('确认下单失败：')) {
        reason = reason.replace('确认下单失败：', '')
      }

      reasonsMap.set(reason, (reasonsMap.get(reason) ?? 0) + 1)
    })

    const failedReasons = Array.from(reasonsMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      summary,
      statusDistribution,
      topSymbols,
      dailyTrend,
      failedReasons,
    }
  }
}
