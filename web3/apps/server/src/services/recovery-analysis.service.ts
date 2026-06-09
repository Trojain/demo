import type {
  ExchangeCode,
  OrderRecoveryActionSource,
  OrderRecoveryFailureStage,
  OrderRecoverySource,
  OrderRecoveryStatus,
  TradeAccountType,
} from '../types/domain.js'
import type { OrderRecoveryRepository } from '../repositories/order-recovery.repository.js'
import { formatLocalDate, shiftLocalDate, toLocalDateString } from '../utils/local-date.js'

export interface OrderRecoveryAnalysisResult {
  summary: {
    /** 统计窗口内创建的恢复任务总数。 */
    totalRecoveryCount: number
    /** 当前已恢复成功的任务数。 */
    recoveredCount: number
    /** 当前仍待恢复的任务数。 */
    pendingRecoveryCount: number
    /** 当前处于恢复中的任务数。 */
    recoveringCount: number
    /** 当前已转人工处理的任务数。 */
    manualReviewRequiredCount: number
    /** 当前恢复失败且尚未转人工的任务数。 */
    recoveryFailedCount: number
    /** 恢复成功率，按 recovered / total 计算。 */
    recoverySuccessRate: number
    /** 人工介入率，按 manual_review_required / total 计算。 */
    manualReviewRate: number
    /** 平均重试次数。 */
    avgRetryCount: number
    /** 已恢复任务的平均尝试次数，直接复用 retryCount 字段。 */
    avgRecoveredAttemptCount: number
    /** 自动恢复成功数。 */
    autoRetryRecoveredCount: number
    /** 人工重试成功数。 */
    manualRetryRecoveredCount: number
    /** 正常链路自然恢复数。 */
    normalPathRecoveredCount: number
    /** 自动恢复成功任务的平均尝试次数。 */
    avgAutoRetryRecoveredAttemptCount: number
    /** 人工重试成功任务的平均尝试次数。 */
    avgManualRetryRecoveredAttemptCount: number
    /** 正常链路自然恢复任务的平均尝试次数。 */
    avgNormalPathRecoveredAttemptCount: number
    /** 自动恢复成功率，按 auto_retry 恢复成功数 / 总任务数计算。 */
    autoRetryRecoverySuccessRate: number
    /** 人工重试成功率，按 manual_retry 恢复成功数 / 总任务数计算。 */
    manualRetryRecoverySuccessRate: number
    /** 已恢复任务的平均恢复耗时，单位毫秒。 */
    avgRecoveredDurationMs: number
    /** 自动恢复成功任务的平均恢复耗时，单位毫秒。 */
    avgAutoRetryRecoveredDurationMs: number
    /** 人工重试成功任务的平均恢复耗时，单位毫秒。 */
    avgManualRetryRecoveredDurationMs: number
    /** 正常链路自然恢复任务的平均恢复耗时，单位毫秒。 */
    avgNormalPathRecoveredDurationMs: number
  }
  statusDistribution: Array<{
    name: string
    value: number
  }>
  stageDistribution: Array<{
    name: string
    value: number
  }>
  exchangeDistribution: Array<{
    name: string
    value: number
  }>
  sourceDistribution: Array<{
    name: string
    value: number
  }>
  recoveryActionDistribution: Array<{
    name: string
    value: number
  }>
  stageRecoveryBreakdown: Array<{
    stage: string
    autoRetryRecoveredCount: number
    manualRetryRecoveredCount: number
    normalPathRecoveredCount: number
  }>
  stageDurationBreakdown: Array<{
    stage: string
    recoveredCount: number
    avgRecoveredDurationMs: number
    avgAutoRetryRecoveredDurationMs: number
    avgManualRetryRecoveredDurationMs: number
    avgNormalPathRecoveredDurationMs: number
  }>
  stageAttemptBreakdown: Array<{
    stage: string
    recoveredCount: number
    avgRecoveredAttemptCount: number
    avgAutoRetryRecoveredAttemptCount: number
    avgManualRetryRecoveredAttemptCount: number
    avgNormalPathRecoveredAttemptCount: number
  }>
  dailyTrend: Array<{
    /** 本地归档日期。 */
    date: string
    /** 当日创建的恢复任务数。 */
    createdCount: number
    /** 当日创建任务中，当前状态已恢复成功的数量。 */
    recoveredCount: number
    /** 当日创建任务中，当前状态已转人工处理的数量。 */
    manualReviewCount: number
    /** 当日创建任务中，通过自动恢复成功的数量。 */
    autoRetryRecoveredCount: number
    /** 当日创建任务中，通过人工重试成功的数量。 */
    manualRetryRecoveredCount: number
    /** 当日创建任务中，通过正常链路自然恢复的数量。 */
    normalPathRecoveredCount: number
  }>
}

export interface ListOrderRecoveryAnalysisInput {
  /** 统计窗口天数。 */
  days: number
  /** 按恢复状态筛选。 */
  statuses?: OrderRecoveryStatus[]
  /** 按失败阶段筛选。 */
  stages?: OrderRecoveryFailureStage[]
  /** 按交易所筛选。 */
  exchanges?: ExchangeCode[]
  /** 按下单模式筛选。 */
  modes?: TradeAccountType[]
  /** 按来源筛选。 */
  sources?: OrderRecoverySource[]
}

const statusLabelMap: Record<OrderRecoveryStatus, string> = {
  pending_recovery: '待恢复',
  recovering: '恢复中',
  recovered: '已恢复',
  manual_review_required: '需人工处理',
  recovery_failed: '恢复失败',
}

const stageLabelMap: Record<OrderRecoveryFailureStage, string> = {
  order_submit_finalize: '订单提交落库',
  rule_trigger_finalize: '规则确认收尾',
  order_sync: '订单状态同步',
  private_stream: '私有推送',
  trade_fill_sync: '成交补全',
  balance_refresh: '余额刷新',
}

const sourceLabelMap: Record<OrderRecoverySource, string> = {
  manual: '快捷交易',
  rule: '策略计划',
  system: '系统任务',
}

const recoveryActionLabelMap: Record<OrderRecoveryActionSource, string> = {
  normal_path: '正常链路恢复',
  auto_retry: '自动恢复成功',
  manual_retry: '人工重试成功',
}

const exchangeLabelMap: Record<ExchangeCode, string> = {
  okx: 'OKX',
  binance: 'Binance',
}

export class RecoveryAnalysisService {
  constructor(private readonly orderRecoveryRepository: OrderRecoveryRepository) {}

  /**
   * 恢复质量分析按恢复任务创建日期归档。
   * 这样恢复中心统计、审计回放和后续恢复质量分析都可以共用同一时间口径。
   */
  getAnalysis(input: ListOrderRecoveryAnalysisInput): OrderRecoveryAnalysisResult {
    const today = formatLocalDate(new Date())
    const fromDate = shiftLocalDate(today, -(input.days - 1))
    const records = this.orderRecoveryRepository.listForAnalysis({
      fromDate,
      toDate: today,
      statuses: input.statuses,
      stages: input.stages,
      exchanges: input.exchanges,
      modes: input.modes,
      sources: input.sources,
    })

    const totalRecoveryCount = records.length
    const recoveredCount = records.filter(record => record.recoveryStatus === 'recovered').length
    const pendingRecoveryCount = records.filter(record => record.recoveryStatus === 'pending_recovery').length
    const recoveringCount = records.filter(record => record.recoveryStatus === 'recovering').length
    const manualReviewRequiredCount = records.filter(record => record.recoveryStatus === 'manual_review_required').length
    const recoveryFailedCount = records.filter(record => record.recoveryStatus === 'recovery_failed').length
    const avgRetryCount = totalRecoveryCount > 0
      ? records.reduce((sum, record) => sum + record.retryCount, 0) / totalRecoveryCount
      : 0
    const autoRetryRecoveredCount = records.filter(record => record.resolvedBy === 'auto_retry').length
    const manualRetryRecoveredCount = records.filter(record => record.resolvedBy === 'manual_retry').length
    const normalPathRecoveredCount = records.filter(record => record.resolvedBy === 'normal_path').length
    const recoveredRecords = records.filter(record => record.recoveryStatus === 'recovered' && record.resolvedAt)
    const autoRetryRecoveredRecords = recoveredRecords.filter(record => record.resolvedBy === 'auto_retry')
    const manualRetryRecoveredRecords = recoveredRecords.filter(record => record.resolvedBy === 'manual_retry')
    const normalPathRecoveredRecords = recoveredRecords.filter(record => record.resolvedBy === 'normal_path')

    const summary = {
      totalRecoveryCount,
      recoveredCount,
      pendingRecoveryCount,
      recoveringCount,
      manualReviewRequiredCount,
      recoveryFailedCount,
      recoverySuccessRate: totalRecoveryCount > 0 ? recoveredCount / totalRecoveryCount : 0,
      manualReviewRate: totalRecoveryCount > 0 ? manualReviewRequiredCount / totalRecoveryCount : 0,
      avgRetryCount,
      avgRecoveredAttemptCount: this.calculateAverageAttemptCount(recoveredRecords),
      autoRetryRecoveredCount,
      manualRetryRecoveredCount,
      normalPathRecoveredCount,
      avgAutoRetryRecoveredAttemptCount: this.calculateAverageAttemptCount(autoRetryRecoveredRecords),
      avgManualRetryRecoveredAttemptCount: this.calculateAverageAttemptCount(manualRetryRecoveredRecords),
      avgNormalPathRecoveredAttemptCount: this.calculateAverageAttemptCount(normalPathRecoveredRecords),
      autoRetryRecoverySuccessRate: totalRecoveryCount > 0 ? autoRetryRecoveredCount / totalRecoveryCount : 0,
      manualRetryRecoverySuccessRate: totalRecoveryCount > 0 ? manualRetryRecoveredCount / totalRecoveryCount : 0,
      avgRecoveredDurationMs: this.calculateAverageDuration(recoveredRecords),
      avgAutoRetryRecoveredDurationMs: this.calculateAverageDuration(autoRetryRecoveredRecords),
      avgManualRetryRecoveredDurationMs: this.calculateAverageDuration(manualRetryRecoveredRecords),
      avgNormalPathRecoveredDurationMs: this.calculateAverageDuration(normalPathRecoveredRecords),
    }

    const statusDistribution = this.buildDistribution(
      Object.entries(statusLabelMap).map(([status, name]) => ({
        name,
        value: records.filter(record => record.recoveryStatus === status).length,
      })),
    )

    const stageDistribution = this.buildDistribution(
      Object.entries(stageLabelMap).map(([stage, name]) => ({
        name,
        value: records.filter(record => record.failureStage === stage).length,
      })),
    )

    const exchangeDistribution = this.buildDistribution(
      Object.entries(exchangeLabelMap).map(([exchange, name]) => ({
        name,
        value: records.filter(record => record.exchange === exchange).length,
      })),
    )

    const sourceDistribution = this.buildDistribution(
      Object.entries(sourceLabelMap).map(([source, name]) => ({
        name,
        value: records.filter(record => record.source === source).length,
      })),
    )

    const recoveryActionDistribution = this.buildDistribution(
      Object.entries(recoveryActionLabelMap).map(([actionSource, name]) => ({
        name,
        value: records.filter(record => record.resolvedBy === actionSource).length,
      })),
    )

    const stageRecoveryBreakdown = Object.entries(stageLabelMap)
      .map(([stage, stageLabel]) => ({
        stage: stageLabel,
        autoRetryRecoveredCount: records.filter(record => record.failureStage === stage && record.resolvedBy === 'auto_retry').length,
        manualRetryRecoveredCount: records.filter(record => record.failureStage === stage && record.resolvedBy === 'manual_retry').length,
        normalPathRecoveredCount: records.filter(record => record.failureStage === stage && record.resolvedBy === 'normal_path').length,
      }))
      .filter(item => item.autoRetryRecoveredCount > 0 || item.manualRetryRecoveredCount > 0 || item.normalPathRecoveredCount > 0)

    const stageDurationBreakdown = Object.entries(stageLabelMap)
      .map(([stage, stageLabel]) => {
        const stageRecoveredRecords = recoveredRecords.filter(record => record.failureStage === stage)
        const stageAutoRetryRecoveredRecords = stageRecoveredRecords.filter(record => record.resolvedBy === 'auto_retry')
        const stageManualRetryRecoveredRecords = stageRecoveredRecords.filter(record => record.resolvedBy === 'manual_retry')
        const stageNormalPathRecoveredRecords = stageRecoveredRecords.filter(record => record.resolvedBy === 'normal_path')

        return {
          stage: stageLabel,
          recoveredCount: stageRecoveredRecords.length,
          avgRecoveredDurationMs: this.calculateAverageDuration(stageRecoveredRecords),
          avgAutoRetryRecoveredDurationMs: this.calculateAverageDuration(stageAutoRetryRecoveredRecords),
          avgManualRetryRecoveredDurationMs: this.calculateAverageDuration(stageManualRetryRecoveredRecords),
          avgNormalPathRecoveredDurationMs: this.calculateAverageDuration(stageNormalPathRecoveredRecords),
        }
      })
      .filter(item => item.recoveredCount > 0)

    /**
     * 这里的“尝试次数”直接复用 retryCount 字段。
     * 当前模型没有尝试级流水表，因此人工恢复成功任务的平均尝试次数会包含前置自动重试次数。
     */
    const stageAttemptBreakdown = Object.entries(stageLabelMap)
      .map(([stage, stageLabel]) => {
        const stageRecoveredRecords = recoveredRecords.filter(record => record.failureStage === stage)
        const stageAutoRetryRecoveredRecords = stageRecoveredRecords.filter(record => record.resolvedBy === 'auto_retry')
        const stageManualRetryRecoveredRecords = stageRecoveredRecords.filter(record => record.resolvedBy === 'manual_retry')
        const stageNormalPathRecoveredRecords = stageRecoveredRecords.filter(record => record.resolvedBy === 'normal_path')

        return {
          stage: stageLabel,
          recoveredCount: stageRecoveredRecords.length,
          avgRecoveredAttemptCount: this.calculateAverageAttemptCount(stageRecoveredRecords),
          avgAutoRetryRecoveredAttemptCount: this.calculateAverageAttemptCount(stageAutoRetryRecoveredRecords),
          avgManualRetryRecoveredAttemptCount: this.calculateAverageAttemptCount(stageManualRetryRecoveredRecords),
          avgNormalPathRecoveredAttemptCount: this.calculateAverageAttemptCount(stageNormalPathRecoveredRecords),
        }
      })
      .filter(item => item.recoveredCount > 0)

    const recordGroups = new Map<string, typeof records>()
    records.forEach(record => {
      const localDate = toLocalDateString(record.createdAt)
      const current = recordGroups.get(localDate) ?? []
      current.push(record)
      recordGroups.set(localDate, current)
    })

    const dailyTrend = Array.from({ length: input.days }, (_, index) => {
      const date = shiftLocalDate(today, -index)
      const dayRecords = recordGroups.get(date) ?? []
      return {
        date,
        createdCount: dayRecords.length,
        recoveredCount: dayRecords.filter(record => record.recoveryStatus === 'recovered').length,
        manualReviewCount: dayRecords.filter(record => record.recoveryStatus === 'manual_review_required').length,
        autoRetryRecoveredCount: dayRecords.filter(record => record.resolvedBy === 'auto_retry').length,
        manualRetryRecoveredCount: dayRecords.filter(record => record.resolvedBy === 'manual_retry').length,
        normalPathRecoveredCount: dayRecords.filter(record => record.resolvedBy === 'normal_path').length,
      }
    }).reverse()

    return {
      summary,
      statusDistribution,
      stageDistribution,
      exchangeDistribution,
      sourceDistribution,
      recoveryActionDistribution,
      stageRecoveryBreakdown,
      stageDurationBreakdown,
      stageAttemptBreakdown,
      dailyTrend,
    }
  }

  private buildDistribution(items: Array<{ name: string; value: number }>) {
    return items.filter(item => item.value > 0)
  }

  /**
   * 当前恢复模型只持久化任务级 retryCount。
   * 因此这里统计的是“任务达到当前恢复结果前累计尝试了多少次”。
   */
  private calculateAverageAttemptCount(
    records: Array<{ retryCount: number }>,
  ) {
    if (records.length === 0) {
      return 0
    }

    return records.reduce((sum, record) => sum + record.retryCount, 0) / records.length
  }

  /**
   * 恢复耗时统一按创建时间到 resolvedAt 计算。
   * 仅统计已经恢复完成且具备 resolvedAt 的任务，避免未完成任务污染平均值。
   */
  private calculateAverageDuration(
    records: Array<{ createdAt: string; resolvedAt?: string }>,
  ) {
    const durations = records
      .map(record => this.calculateDurationMs(record.createdAt, record.resolvedAt))
      .filter((duration): duration is number => duration !== undefined)

    if (durations.length === 0) {
      return 0
    }

    return durations.reduce((sum, duration) => sum + duration, 0) / durations.length
  }

  private calculateDurationMs(createdAt: string, resolvedAt?: string) {
    if (!resolvedAt) {
      return undefined
    }

    const createdAtMs = Date.parse(createdAt)
    const resolvedAtMs = Date.parse(resolvedAt)
    if (Number.isNaN(createdAtMs) || Number.isNaN(resolvedAtMs) || resolvedAtMs < createdAtMs) {
      return undefined
    }

    return resolvedAtMs - createdAtMs
  }
}
