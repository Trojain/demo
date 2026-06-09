import { nanoid } from 'nanoid'
import type {
  AuditLogAction,
  ExchangeCode,
  OrderRecoveryActionSource,
  OrderRecoveryFailureStage,
  OrderRecoveryRecord,
  OrderRecoverySource,
  OrderRecoveryStatus,
  OrderRecord,
  TradeAccountType,
} from '../types/domain.js'
import type { AuditLogService } from './audit-log.service.js'
import type { OrderRecoveryRepository } from '../repositories/order-recovery.repository.js'
import type { OrderRepository } from '../repositories/order.repository.js'
import { resolveTradingEnvironmentLabel } from '../utils/trading-environment.js'
import type { RealOrderSyncService } from './real-order-sync.service.js'
import type { TriggerRepository } from '../repositories/trigger.repository.js'

interface OrderRecoveryServiceOptions {
  /** 自动恢复扫描间隔，单位毫秒。 */
  intervalMs: number
  /** 自动恢复最大尝试次数。 */
  maxRetryCount: number
  /** 单次自动恢复最多处理多少条任务。 */
  batchSize: number
  /** 自动恢复失败后的下一次重试间隔，单位毫秒。 */
  retryDelayMs: number
}

export interface CreateOrderRecoveryInput {
  /** 稳定恢复去重键，未恢复前重复异常复用同一条记录。 */
  identityKey: string
  /** 关联本地订单 ID，交易所级异常可为空。 */
  orderId?: string
  /** 关联交易所订单号。 */
  exchangeOrderId?: string
  /** 关联执行任务 ID。 */
  executionTaskId?: string
  /** 交易所编码。 */
  exchange: ExchangeCode
  /** 失败来源。 */
  source: OrderRecoverySource
  /** 下单模式，当前主要是 real。 */
  mode: TradeAccountType
  /** 统一交易对，交易所级异常可为空。 */
  symbol?: string
  /** 失败阶段。 */
  failureStage: OrderRecoveryFailureStage
  /** 最近一次错误码。 */
  lastErrorCode?: string
  /** 最近一次错误消息。 */
  lastErrorMessage?: string
  /** 结构化上下文对象。 */
  payload?: Record<string, unknown>
}

export interface ListOrderRecoveryPageInput {
  /** 当前页码。 */
  page: number
  /** 分页大小。 */
  pageSize: number
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

export interface RetryOrderRecoveryBatchInput {
  /** 指定重试的恢复任务 ID 列表，优先级高于筛选条件。 */
  ids?: string[]
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
  /** 批量恢复最大处理条数。 */
  limit: number
}

export interface RetryOrderRecoveryBatchItemResult {
  /** 恢复任务 ID。 */
  id: string
  /** 最终结果。 */
  result: 'succeeded' | 'failed' | 'skipped'
  /** 当前状态。 */
  recoveryStatus: OrderRecoveryStatus
  /** 失败或跳过原因。 */
  message?: string
}

export interface RetryOrderRecoveryBatchResult {
  /** 本次批量操作总处理条数。 */
  totalCount: number
  /** 成功条数。 */
  successCount: number
  /** 失败条数。 */
  failedCount: number
  /** 跳过条数。 */
  skippedCount: number
  /** 各条恢复任务执行结果。 */
  items: RetryOrderRecoveryBatchItemResult[]
}

export class OrderRecoveryService {
  private timer?: NodeJS.Timeout

  constructor(
    private readonly orderRecoveryRepository: OrderRecoveryRepository,
    private readonly orderRepository: OrderRepository,
    private readonly triggerRepository: TriggerRepository,
    private readonly auditLogService: AuditLogService,
    private readonly realOrderSyncService: RealOrderSyncService,
    private readonly options: OrderRecoveryServiceOptions,
  ) {}

  start() {
    if (this.timer) {
      return
    }

    this.timer = setInterval(() => {
      void this.processDueRecoveries()
    }, this.options.intervalMs)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  listPage(input: ListOrderRecoveryPageInput) {
    return this.orderRecoveryRepository.listPage(input)
  }

  createOrRefresh(input: CreateOrderRecoveryInput) {
    const now = new Date().toISOString()
    const payloadJson = input.payload ? JSON.stringify(input.payload) : undefined
    const current = this.orderRecoveryRepository.findLatestActiveByIdentityKey(input.identityKey)
    if (current) {
      const nextStatus: OrderRecoveryStatus = current.recoveryStatus === 'manual_review_required'
        ? 'manual_review_required'
        : 'pending_recovery'
      const updated = this.orderRecoveryRepository.update({
        ...current,
        orderId: input.orderId ?? current.orderId,
        exchangeOrderId: input.exchangeOrderId ?? current.exchangeOrderId,
        executionTaskId: input.executionTaskId ?? current.executionTaskId,
        symbol: input.symbol ?? current.symbol,
        source: input.source,
        mode: input.mode,
        failureStage: input.failureStage,
        recoveryStatus: nextStatus,
        lastRecoverySource: undefined,
        resolvedBy: undefined,
        lastErrorCode: input.lastErrorCode,
        lastErrorMessage: input.lastErrorMessage,
        payloadJson,
        nextRetryAt: current.recoveryStatus === 'manual_review_required' ? current.nextRetryAt : now,
        resolvedAt: undefined,
        updatedAt: now,
      })
      return updated
    }

    const created = this.orderRecoveryRepository.create({
      id: nanoid(),
      identityKey: input.identityKey,
      orderId: input.orderId,
      exchangeOrderId: input.exchangeOrderId,
      executionTaskId: input.executionTaskId,
      exchange: input.exchange,
      source: input.source,
      mode: input.mode,
      symbol: input.symbol,
      failureStage: input.failureStage,
      recoveryStatus: 'pending_recovery',
      retryCount: 0,
      maxRetryCount: this.options.maxRetryCount,
      lastRecoverySource: undefined,
      resolvedBy: undefined,
      lastErrorCode: input.lastErrorCode,
      lastErrorMessage: input.lastErrorMessage,
      nextRetryAt: now,
      payloadJson,
      createdAt: now,
      updatedAt: now,
    })
    this.recordAudit('recovery.created', created, `已创建 ${this.getFailureStageLabel(created.failureStage)} 恢复任务`)
    return created
  }

  markRecoveredByIdentityKey(identityKey: string, message?: string) {
    const current = this.orderRecoveryRepository.findLatestActiveByIdentityKey(identityKey)
    if (!current) {
      return undefined
    }

    const recoveredAt = new Date().toISOString()
    const recovered = this.orderRecoveryRepository.update({
      ...current,
      recoveryStatus: 'recovered',
      resolvedBy: 'normal_path',
      updatedAt: recoveredAt,
      resolvedAt: recoveredAt,
      nextRetryAt: undefined,
    })
    this.recordAudit(
      'recovery.retry_succeeded',
      recovered,
      message ?? `${this.getFailureStageLabel(recovered.failureStage)} 已通过正常链路恢复`,
    )
    return recovered
  }

  async retryById(id: string, reason: 'manual' | 'auto' = 'manual') {
    const record = this.orderRecoveryRepository.findById(id)
    if (!record) {
      throw new Error('恢复任务不存在')
    }

    return this.retryRecord(record, reason)
  }

  async retryBatch(input: RetryOrderRecoveryBatchInput): Promise<RetryOrderRecoveryBatchResult> {
    const requestedIds = input.ids && input.ids.length > 0 ? [...new Set(input.ids)] : undefined
    const records = requestedIds
      ? this.orderRecoveryRepository.listByIds(requestedIds)
      : this.orderRecoveryRepository.listForBatch({
          limit: input.limit,
          statuses: input.statuses,
          stages: input.stages,
          exchanges: input.exchanges,
          modes: input.modes,
          sources: input.sources,
        })

    this.auditLogService.record({
      action: 'recovery.batch_started',
      entityType: 'recovery_batch',
      message: `开始批量重试恢复任务，共 ${records.length} 条`,
      payload: {
        ids: input.ids,
        statuses: input.statuses,
        stages: input.stages,
        exchanges: input.exchanges,
        modes: input.modes,
        sources: input.sources,
        limit: input.limit,
        totalCount: records.length,
      },
    })

    const items: RetryOrderRecoveryBatchItemResult[] = []
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    if (requestedIds) {
      const existingIdSet = new Set(records.map(record => record.id))
      for (const id of requestedIds) {
        if (existingIdSet.has(id)) {
          continue
        }

        failedCount += 1
        items.push({
          id,
          result: 'failed',
          recoveryStatus: 'recovery_failed',
          message: '恢复任务不存在或已被删除',
        })
      }
    }

    for (const record of records) {
      if (record.recoveryStatus === 'recovering' || record.recoveryStatus === 'recovered') {
        skippedCount += 1
        items.push({
          id: record.id,
          result: 'skipped',
          recoveryStatus: record.recoveryStatus,
          message: record.recoveryStatus === 'recovered' ? '恢复任务已完成' : '恢复任务正在处理中',
        })
        continue
      }

      try {
        const retried = await this.retryRecord(record, 'manual')
        successCount += 1
        items.push({
          id: retried.id,
          result: 'succeeded',
          recoveryStatus: retried.recoveryStatus,
        })
      } catch (error) {
        failedCount += 1
        const current = this.orderRecoveryRepository.findById(record.id)
        items.push({
          id: record.id,
          result: 'failed',
          recoveryStatus: current?.recoveryStatus ?? 'recovery_failed',
          message: error instanceof Error ? error.message : '恢复任务重试失败',
        })
      }
    }

    const result = {
      totalCount: requestedIds ? requestedIds.length : records.length,
      successCount,
      failedCount,
      skippedCount,
      items,
    } satisfies RetryOrderRecoveryBatchResult

    this.auditLogService.record({
      action: 'recovery.batch_finished',
      entityType: 'recovery_batch',
      message: `批量重试完成，成功 ${successCount} 条，失败 ${failedCount} 条，跳过 ${skippedCount} 条`,
      payload: result,
    })

    return result
  }

  async processDueRecoveries() {
    const now = new Date().toISOString()
    const dueRecords = this.orderRecoveryRepository.listDueForRetry(now, this.options.batchSize)
    for (const record of dueRecords) {
      await this.retryRecord(record, 'auto')
    }
  }

  private async retryRecord(record: OrderRecoveryRecord, reason: 'manual' | 'auto') {
    const current = this.orderRecoveryRepository.findById(record.id)
    if (!current) {
      throw new Error('恢复任务不存在')
    }
    if (current.recoveryStatus === 'recovering') {
      return current
    }
    if (current.recoveryStatus === 'recovered') {
      return current
    }

    const now = new Date().toISOString()
    const actionSource = this.getRecoveryActionSource(reason)
    const recovering = this.orderRecoveryRepository.update({
      ...current,
      recoveryStatus: 'recovering',
      retryCount: current.retryCount + 1,
      lastRecoverySource: actionSource,
      nextRetryAt: undefined,
      updatedAt: now,
    })
    this.recordAudit(
      'recovery.retry_started',
      recovering,
      `${reason === 'manual' ? '人工' : '自动'}开始恢复 ${this.getFailureStageLabel(recovering.failureStage)}`,
    )

    try {
      const recoveryPatch = await this.executeRecovery(recovering)
      const recoveredAt = new Date().toISOString()
      const recovered = this.orderRecoveryRepository.update({
        ...recovering,
        ...recoveryPatch,
        recoveryStatus: 'recovered',
        resolvedBy: actionSource,
        updatedAt: recoveredAt,
        resolvedAt: recoveredAt,
        nextRetryAt: undefined,
      })
      this.recordAudit('recovery.retry_succeeded', recovered, `${this.getFailureStageLabel(recovered.failureStage)} 已恢复成功`)
      return recovered
    } catch (error) {
      const message = error instanceof Error ? error.message : '恢复执行失败'
      const reachedLimit = recovering.retryCount >= recovering.maxRetryCount
      const failedAt = new Date().toISOString()
      const nextRetryAt = reachedLimit ? undefined : new Date(Date.now() + this.options.retryDelayMs).toISOString()
      const failed = this.orderRecoveryRepository.update({
        ...recovering,
        recoveryStatus: reachedLimit ? 'manual_review_required' : 'recovery_failed',
        lastErrorMessage: message,
        updatedAt: failedAt,
        nextRetryAt,
      })
      this.recordAudit('recovery.retry_failed', failed, `${this.getFailureStageLabel(failed.failureStage)} 恢复失败：${message}`)
      if (reachedLimit) {
        this.recordAudit('recovery.manual_review_required', failed, `${this.getFailureStageLabel(failed.failureStage)} 已转人工处理`)
      }
      if (reason === 'manual') {
        throw error
      }
      return failed
    }
  }

  private async executeRecovery(record: OrderRecoveryRecord): Promise<Partial<OrderRecoveryRecord> | undefined> {
    if (record.failureStage === 'order_submit_finalize') {
      const order = this.restoreSubmittedOrderRecord(record)
      await this.realOrderSyncService.syncOrderById(order.id)
      return {
        orderId: order.id,
      }
    }

    if (record.failureStage === 'rule_trigger_finalize') {
      await this.finalizeRuleTriggeredOrder(record)
      return
    }

    if (record.failureStage === 'order_sync' || record.failureStage === 'trade_fill_sync') {
      if (!record.orderId) {
        throw new Error('缺少本地订单 ID，无法重试订单同步')
      }
      await this.realOrderSyncService.syncOrderById(record.orderId)
      return
    }

    if (record.failureStage === 'private_stream' || record.failureStage === 'balance_refresh') {
      await this.realOrderSyncService.syncPendingOrdersByExchange(record.exchange, this.options.batchSize)
      return
    }

    throw new Error(`暂不支持的恢复阶段：${record.failureStage}`)
  }

  private recordAudit(action: AuditLogAction, record: OrderRecoveryRecord, message: string) {
    const payload = this.parsePayload(record.payloadJson)
    this.auditLogService.record({
      level: action === 'recovery.retry_failed' || action === 'recovery.manual_review_required' ? 'warning' : 'info',
      action,
      entityType: 'recovery',
      entityId: record.id,
      orderId: record.orderId,
      executionTaskId: record.executionTaskId,
      message,
      payload: {
        recoveryId: record.id,
        identityKey: record.identityKey,
        exchange: record.exchange,
        tradingEnvironment: resolveTradingEnvironmentLabel(record.exchange),
        source: record.source,
        mode: record.mode,
        symbol: record.symbol,
        failureStage: record.failureStage,
        recoveryStatus: record.recoveryStatus,
        retryCount: record.retryCount,
        maxRetryCount: record.maxRetryCount,
        lastErrorCode: record.lastErrorCode,
        lastErrorMessage: record.lastErrorMessage,
        lastRecoverySource: record.lastRecoverySource,
        resolvedBy: record.resolvedBy,
        nextRetryAt: record.nextRetryAt,
        exchangeOrderId: record.exchangeOrderId,
        executionTaskId: record.executionTaskId,
        ...payload,
      },
    })
  }

  private getRecoveryActionSource(reason: 'manual' | 'auto'): OrderRecoveryActionSource {
    return reason === 'manual' ? 'manual_retry' : 'auto_retry'
  }

  private parsePayload(payloadJson?: string) {
    if (!payloadJson) {
      return {}
    }

    try {
      return JSON.parse(payloadJson) as Record<string, unknown>
    } catch {
      return {
        rawPayloadJson: payloadJson,
      }
    }
  }

  private getFailureStageLabel(stage: OrderRecoveryFailureStage) {
    switch (stage) {
      case 'order_submit_finalize':
        return '订单提交落库'
      case 'rule_trigger_finalize':
        return '规则确认收尾'
      case 'order_sync':
        return '订单状态同步'
      case 'private_stream':
        return '私有推送'
      case 'trade_fill_sync':
        return '成交补全'
      case 'balance_refresh':
        return '账户余额刷新'
      default:
        return stage
    }
  }

  /**
   * 交易所已成功接单，但本地订单落库失败时，通过恢复任务重建最小订单记录，
   * 然后再交给真实订单同步链路补齐最终状态和真实账本。
   */
  private restoreSubmittedOrderRecord(record: OrderRecoveryRecord) {
    if (record.orderId) {
      const existingOrder = this.orderRepository.findById(record.orderId)
      if (existingOrder) {
        return existingOrder
      }
    }

    if (record.exchangeOrderId) {
      const existingExchangeOrder = this.orderRepository.findByExchangeOrderId(record.exchange, record.exchangeOrderId)
      if (existingExchangeOrder) {
        return existingExchangeOrder
      }
    }

    const payload = this.parsePayload(record.payloadJson)
    const symbol = typeof payload.symbol === 'string' ? payload.symbol : record.symbol
    const side = typeof payload.side === 'string' ? payload.side : undefined
    const orderType = typeof payload.orderType === 'string' ? payload.orderType : undefined
    const exchangeOrderId = typeof payload.exchangeOrderId === 'string' ? payload.exchangeOrderId : record.exchangeOrderId
    const status = typeof payload.status === 'string' ? payload.status : 'submitted'
    const missingFields: string[] = []
    if (!symbol) missingFields.push('symbol')
    if (!side) missingFields.push('side')
    if (!orderType) missingFields.push('orderType')
    if (!exchangeOrderId) missingFields.push('exchangeOrderId')
    if (missingFields.length > 0) {
      throw new Error(`恢复任务缺少订单重建上下文，缺少字段：${missingFields.join('、')}`)
    }

    // 经过上方 missingFields 校验后，4 个字段必然非空，使用非空断言消除 TS 类型窄化限制。
    return this.orderRepository.create({
      id: record.orderId ?? nanoid(),
      executionTaskId: record.executionTaskId ?? (typeof payload.executionTaskId === 'string' ? payload.executionTaskId : undefined),
      triggerId: typeof payload.triggerId === 'string' ? payload.triggerId : undefined,
      ruleId: typeof payload.ruleId === 'string' ? payload.ruleId : undefined,
      exchange: record.exchange,
      symbol: symbol!,
      side: side! as 'buy' | 'sell',
      orderType: orderType! as 'market' | 'limit',
      baseQuantity: typeof payload.baseQuantity === 'string' ? payload.baseQuantity : undefined,
      quoteAmount: typeof payload.quoteAmount === 'string' ? payload.quoteAmount : undefined,
      price: typeof payload.price === 'string' ? payload.price : undefined,
      exchangeOrderId: exchangeOrderId!,
      status: status as OrderRecord['status'],
      simulationMode: false,
      rawMessage: typeof payload.rawMessage === 'string' ? payload.rawMessage : '恢复任务重建真实订单记录',
      createdAt: typeof payload.acceptedAt === 'string' ? payload.acceptedAt : record.createdAt,
    })
  }

  /**
   * 规则触发真实订单已经存在，但触发确认状态或审计补充失败时，
   * 恢复任务负责补齐触发状态和缺失的审计记录。
   */
  private async finalizeRuleTriggeredOrder(record: OrderRecoveryRecord) {
    const payload = this.parsePayload(record.payloadJson)
    const triggerId = typeof payload.triggerId === 'string' ? payload.triggerId : undefined
    const orderId = record.orderId ?? (typeof payload.orderId === 'string' ? payload.orderId : undefined)
    const ruleId = typeof payload.ruleId === 'string' ? payload.ruleId : undefined
    // triggerId / orderId 分别给出具体提示，方便排查是 payload 还是 record 字段缺失。
    if (!triggerId) {
      throw new Error('规则确认收尾恢复缺少 triggerId，请检查 payload.triggerId 是否完整')
    }
    if (!orderId) {
      throw new Error('规则确认收尾恢复缺少 orderId，请检查 record.orderId 或 payload.orderId 是否完整')
    }

    const trigger = this.triggerRepository.findById(triggerId)
    if (!trigger) {
      throw new Error('规则确认收尾恢复对应触发事件不存在')
    }

    const order = this.orderRepository.findById(orderId)
    if (!order) {
      throw new Error('规则确认收尾恢复对应订单不存在')
    }

    if (trigger.status === 'pending') {
      this.triggerRepository.markConfirmed(triggerId)
    }

    if (!this.auditLogService.existsByActionAndEntity({
      action: 'trigger.confirmed',
      entityType: 'trigger',
      entityId: triggerId,
      orderId,
      triggerId,
    })) {
      this.auditLogService.record({
        action: 'trigger.confirmed',
        entityType: 'trigger',
        entityId: triggerId,
        ruleId,
        triggerId,
        orderId,
        message: `${order.symbol} 触发事件已通过恢复任务补齐确认记录`,
        payload: {
          exchange: order.exchange,
          tradingEnvironment: resolveTradingEnvironmentLabel(order.exchange),
          symbol: order.symbol,
          executionMode: payload.executionMode,
          recoveredBy: 'order_recovery',
          recoveryStage: record.failureStage,
        },
      })
    }

    if (!this.auditLogService.existsByActionAndEntity({
      action: 'order.submitted',
      entityType: 'order',
      entityId: orderId,
      orderId,
      triggerId,
    })) {
      this.auditLogService.record({
        action: 'order.submitted',
        entityType: 'order',
        entityId: orderId,
        ruleId,
        triggerId,
        orderId,
        message: `${order.symbol} 订单已通过恢复任务补齐提交记录`,
        payload: {
          source: 'rule',
          exchange: order.exchange,
          tradingEnvironment: resolveTradingEnvironmentLabel(order.exchange),
          side: order.side,
          orderType: order.orderType,
          simulationMode: order.simulationMode,
          exchangeOrderId: order.exchangeOrderId,
          recoveredBy: 'order_recovery',
          recoveryStage: record.failureStage,
        },
      })
    }
  }
}
