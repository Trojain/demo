import { nanoid } from 'nanoid'
import type {
  ExecutionTask,
  ExecutionTaskFailureStage,
  ExchangeCode,
  OrderRecord,
  OrderSide,
  OrderType,
  TradeAccountType,
} from '../types/domain.js'
import type { ExecutionTaskRepository } from '../repositories/execution-task.repository.js'
import type { AuditLogService } from './audit-log.service.js'

export class ExecutionTaskConflictError extends Error {
  constructor(readonly task: ExecutionTask) {
    super('当前账户、交易所和交易对已有执行任务处理中，请等待完成后再提交')
    this.name = 'ExecutionTaskConflictError'
  }
}

export interface CreateExecutionTaskInput {
  /** 策略实例 ID，快捷交易可为空。 */
  strategyId?: string
  /** 策略参数版本 ID，快捷交易可为空。 */
  strategyVersionId?: string
  /** 信号 ID，快捷交易可为空。 */
  signalId?: string
  /** 触发事件 ID，快捷交易可为空。 */
  triggerId?: string
  /** 交易所编码。 */
  exchange: ExchangeCode
  /** 统一交易对。 */
  symbol: string
  /** 下单模式。 */
  mode: TradeAccountType
  /** 买入或卖出。 */
  side: OrderSide
  /** 市价或限价。 */
  orderType: OrderType
  /** 任务来源。 */
  source: ExecutionTask['source']
  /** 幂等键。 */
  idempotencyKey: string
  /** 任务上下文。 */
  payload?: Record<string, unknown>
  /** 初始状态，默认等待确认。 */
  status?: ExecutionTask['status']
}

export class ExecutionTaskService {
  constructor(
    private readonly executionTaskRepository: ExecutionTaskRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  createOrGet(input: CreateExecutionTaskInput) {
    const existing = this.executionTaskRepository.findByIdempotencyKey(input.idempotencyKey)
    if (existing) {
      return existing
    }

    const lockKey = this.buildLockKey(input.mode, input.exchange, input.symbol)
    const active = this.executionTaskRepository.findActiveByLockKey(lockKey)
    if (active) {
      throw new ExecutionTaskConflictError(active)
    }

    const now = new Date().toISOString()
    const status = input.status ?? 'waiting_confirm'
    const task: ExecutionTask = {
      id: nanoid(),
      strategyId: input.strategyId,
      strategyVersionId: input.strategyVersionId,
      signalId: input.signalId,
      triggerId: input.triggerId,
      exchange: input.exchange,
      symbol: input.symbol,
      mode: input.mode,
      side: input.side,
      orderType: input.orderType,
      status,
      source: input.source,
      idempotencyKey: input.idempotencyKey,
      lockKey,
      waitingConfirmAt: status === 'waiting_confirm' ? now : undefined,
      payloadJson: input.payload ? JSON.stringify(input.payload) : undefined,
      createdAt: now,
      updatedAt: now,
    }
    this.executionTaskRepository.create(task)
    this.auditLogService.record({
      action: 'execution.created',
      entityType: 'execution_task',
      entityId: task.id,
      strategyId: task.strategyId,
      signalId: task.signalId,
      executionTaskId: task.id,
      triggerId: task.triggerId,
      message: `${task.symbol} 已创建执行任务`,
      payload: {
        exchange: task.exchange,
        symbol: task.symbol,
        mode: task.mode,
        side: task.side,
        orderType: task.orderType,
        source: task.source,
        status: task.status,
        idempotencyKey: task.idempotencyKey,
        lockKey: task.lockKey,
      },
    })
    return task
  }

  markRunning(taskId: string) {
    const task = this.findOrThrow(taskId)
    const now = new Date().toISOString()
    return this.executionTaskRepository.update({
      ...task,
      status: 'running',
      startedAt: task.startedAt ?? now,
      updatedAt: now,
    })
  }

  markSubmitted(taskId: string, order: OrderRecord) {
    const task = this.findOrThrow(taskId)
    const now = new Date().toISOString()
    return this.executionTaskRepository.update({
      ...task,
      status: 'submitted',
      orderId: order.id,
      submittedAt: task.submittedAt ?? now,
      updatedAt: now,
    })
  }

  markCompleted(taskId: string, order?: OrderRecord) {
    const task = this.findOrThrow(taskId)
    const now = new Date().toISOString()
    return this.executionTaskRepository.update({
      ...task,
      status: 'completed',
      orderId: order?.id ?? task.orderId,
      completedAt: task.completedAt ?? now,
      updatedAt: now,
    })
  }

  markFailed(taskId: string, failureStage: ExecutionTaskFailureStage, reason: string) {
    const task = this.findOrThrow(taskId)
    const now = new Date().toISOString()
    const failed = this.executionTaskRepository.update({
      ...task,
      status: 'failed',
      failureStage,
      failureReason: reason,
      updatedAt: now,
    })
    this.auditLogService.record({
      level: 'warning',
      action: 'execution.failed',
      entityType: 'execution_task',
      entityId: failed.id,
      strategyId: failed.strategyId,
      signalId: failed.signalId,
      executionTaskId: failed.id,
      triggerId: failed.triggerId,
      orderId: failed.orderId,
      message: `${failed.symbol} 执行任务失败：${reason}`,
      payload: {
        exchange: failed.exchange,
        symbol: failed.symbol,
        mode: failed.mode,
        source: failed.source,
        failureStage,
      },
    })
    return failed
  }

  findById(id: string) {
    return this.executionTaskRepository.findById(id)
  }

  findByTriggerId(triggerId: string) {
    return this.executionTaskRepository.findByTriggerId(triggerId)
  }

  private findOrThrow(taskId: string) {
    const task = this.executionTaskRepository.findById(taskId)
    if (!task) {
      throw new Error('执行任务不存在')
    }

    return task
  }

  private buildLockKey(mode: TradeAccountType, exchange: ExchangeCode, symbol: string) {
    return `${mode}:${exchange}:${symbol}`
  }
}
