import type { TradeDailyReport } from '../types/domain.js'
import type { OrderRepository } from '../repositories/order.repository.js'
import type { TradeAccountRepository } from '../repositories/trade-account.repository.js'
import type { SignalRepository } from '../repositories/signal.repository.js'
import type { RiskCheckRepository } from '../repositories/risk-check.repository.js'
import { formatLocalDate, shiftLocalDate } from '../utils/local-date.js'

type TradeDailyReportWithCancelled = TradeDailyReport & {
  /** 当日已取消订单数。 */
  cancelledOrderCount: number
}

export class DailyReportService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly tradeAccountRepository: TradeAccountRepository,
    private readonly signalRepository: SignalRepository,
    private readonly riskCheckRepository: RiskCheckRepository,
  ) {}

  /**
   * 生成最近 days 天（包含今天）的交易日报表。
   * 结果按日期倒序排列，近 N 天每天补全一行，无数据的日期字段均为 0。
   */
  getDailyReport(input: {
    days: number
    exchange?: string
    mode?: 'simulation' | 'real'
  }): TradeDailyReport[] {
    const { days, exchange, mode } = input
    const today = formatLocalDate(new Date())
    const fromDate = shiftLocalDate(today, -(days - 1))

    // 从各数据源批量查询日聚合，结果中只有有数据的日期
    const orderRows = this.orderRepository.listDailySummary({ fromDate, toDate: today, exchange, mode })
    const fillRows = this.tradeAccountRepository.listDailyFillSummary({ fromDate, toDate: today, exchange, mode })
    const signalRows = this.signalRepository.listDailySignalCount({ fromDate, toDate: today, exchange, mode })
    // 风控统计按 stat_date 字段而非 created_at，保持与现有风控日期口径一致
    const riskRows = this.riskCheckRepository.listDailyStats({ fromDate, toDate: today, exchange, mode })

    // 以日期为 key 建立快速查找 Map
    const orderByDate = new Map(orderRows.map(r => [r.date, r]))
    const fillByDate = new Map(fillRows.map(r => [r.date, r]))
    const signalByDate = new Map(signalRows.map(r => [r.date, r]))
    const riskByDate = new Map(riskRows.map(r => [r.statDate, r]))

    // 补全 days 天（含无数据日期），按日期倒序生成
    return Array.from({ length: days }, (_, index) => {
      const statDate = shiftLocalDate(today, -index)
      const order = orderByDate.get(statDate)
      const fill = fillByDate.get(statDate)
      const signal = signalByDate.get(statDate)
      const risk = riskByDate.get(statDate)

      return {
        date: statDate,
        orderCount: order?.orderCount ?? 0,
        filledOrderCount: order?.filledOrderCount ?? 0,
        failedOrderCount: order?.failedOrderCount ?? 0,
        cancelledOrderCount: order?.cancelledOrderCount ?? 0,
        totalQuoteAmount: fill?.totalQuoteAmount ?? '0',
        totalFeeAmount: fill?.totalFeeAmount ?? '0',
        totalRealizedPnl: fill?.totalRealizedPnl ?? '0',
        buyCount: fill?.buyCount ?? 0,
        sellCount: fill?.sellCount ?? 0,
        signalCount: signal?.signalCount ?? 0,
        riskPassCount: risk?.passedCount ?? 0,
        riskRejectCount: risk?.rejectedCount ?? 0,
      } satisfies TradeDailyReportWithCancelled
    }) as TradeDailyReport[]
  }
}
