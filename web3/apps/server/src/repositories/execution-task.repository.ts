import type Database from 'better-sqlite3'
import type { ExecutionTask, ExecutionTaskFailureStage } from '../types/domain.js'

type ExecutionTaskRow = {
  id: string
  strategy_id?: string | null
  strategy_version_id?: string | null
  signal_id?: string | null
  trigger_id?: string | null
  order_id?: string | null
  exchange: ExecutionTask['exchange']
  symbol: string
  mode: ExecutionTask['mode']
  side: ExecutionTask['side']
  order_type: ExecutionTask['orderType']
  status: ExecutionTask['status']
  source: ExecutionTask['source']
  idempotency_key: string
  lock_key: string
  failure_stage?: ExecutionTaskFailureStage | null
  failure_reason?: string | null
  waiting_confirm_at?: string | null
  started_at?: string | null
  submitted_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  payload_json?: string | null
  created_at: string
  updated_at: string
}

function mapTask(row: ExecutionTaskRow): ExecutionTask {
  return {
    id: row.id,
    strategyId: row.strategy_id ?? undefined,
    strategyVersionId: row.strategy_version_id ?? undefined,
    signalId: row.signal_id ?? undefined,
    triggerId: row.trigger_id ?? undefined,
    orderId: row.order_id ?? undefined,
    exchange: row.exchange,
    symbol: row.symbol,
    mode: row.mode,
    side: row.side,
    orderType: row.order_type,
    status: row.status,
    source: row.source,
    idempotencyKey: row.idempotency_key,
    lockKey: row.lock_key,
    failureStage: row.failure_stage ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    waitingConfirmAt: row.waiting_confirm_at ?? undefined,
    startedAt: row.started_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    payloadJson: row.payload_json ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ExecutionTaskRepository {
  constructor(private readonly db: Database.Database) {}

  findById(id: string): ExecutionTask | undefined {
    const row = this.db.prepare('SELECT * FROM execution_tasks WHERE id = ? LIMIT 1').get(id) as ExecutionTaskRow | undefined
    return row ? mapTask(row) : undefined
  }

  findByIdempotencyKey(idempotencyKey: string): ExecutionTask | undefined {
    const row = this.db.prepare('SELECT * FROM execution_tasks WHERE idempotency_key = ? LIMIT 1').get(idempotencyKey) as ExecutionTaskRow | undefined
    return row ? mapTask(row) : undefined
  }

  findByTriggerId(triggerId: string): ExecutionTask | undefined {
    const row = this.db
      .prepare('SELECT * FROM execution_tasks WHERE trigger_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(triggerId) as ExecutionTaskRow | undefined
    return row ? mapTask(row) : undefined
  }

  findActiveByLockKey(lockKey: string): ExecutionTask | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM execution_tasks
         WHERE lock_key = ?
           AND status IN ('pending','waiting_confirm','running','submitted')
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(lockKey) as ExecutionTaskRow | undefined
    return row ? mapTask(row) : undefined
  }

  create(task: ExecutionTask): ExecutionTask {
    this.db
      .prepare(
        `INSERT INTO execution_tasks (
          id, strategy_id, strategy_version_id, signal_id, trigger_id, order_id,
          exchange, symbol, mode, side, order_type, status, source, idempotency_key, lock_key,
          failure_stage, failure_reason, waiting_confirm_at, started_at, submitted_at, completed_at,
          cancelled_at, payload_json, created_at, updated_at
        ) VALUES (
          @id, @strategyId, @strategyVersionId, @signalId, @triggerId, @orderId,
          @exchange, @symbol, @mode, @side, @orderType, @status, @source, @idempotencyKey, @lockKey,
          @failureStage, @failureReason, @waitingConfirmAt, @startedAt, @submittedAt, @completedAt,
          @cancelledAt, @payloadJson, @createdAt, @updatedAt
        )`,
      )
      .run({
        ...task,
        strategyId: task.strategyId ?? null,
        strategyVersionId: task.strategyVersionId ?? null,
        signalId: task.signalId ?? null,
        triggerId: task.triggerId ?? null,
        orderId: task.orderId ?? null,
        failureStage: task.failureStage ?? null,
        failureReason: task.failureReason ?? null,
        waitingConfirmAt: task.waitingConfirmAt ?? null,
        startedAt: task.startedAt ?? null,
        submittedAt: task.submittedAt ?? null,
        completedAt: task.completedAt ?? null,
        cancelledAt: task.cancelledAt ?? null,
        payloadJson: task.payloadJson ?? null,
      })

    return task
  }

  update(task: ExecutionTask): ExecutionTask {
    this.db
      .prepare(
        `UPDATE execution_tasks
         SET strategy_id = @strategyId,
             strategy_version_id = @strategyVersionId,
             signal_id = @signalId,
             trigger_id = @triggerId,
             order_id = @orderId,
             exchange = @exchange,
             symbol = @symbol,
             mode = @mode,
             side = @side,
             order_type = @orderType,
             status = @status,
             source = @source,
             idempotency_key = @idempotencyKey,
             lock_key = @lockKey,
             failure_stage = @failureStage,
             failure_reason = @failureReason,
             waiting_confirm_at = @waitingConfirmAt,
             started_at = @startedAt,
             submitted_at = @submittedAt,
             completed_at = @completedAt,
             cancelled_at = @cancelledAt,
             payload_json = @payloadJson,
             updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run({
        ...task,
        strategyId: task.strategyId ?? null,
        strategyVersionId: task.strategyVersionId ?? null,
        signalId: task.signalId ?? null,
        triggerId: task.triggerId ?? null,
        orderId: task.orderId ?? null,
        failureStage: task.failureStage ?? null,
        failureReason: task.failureReason ?? null,
        waitingConfirmAt: task.waitingConfirmAt ?? null,
        startedAt: task.startedAt ?? null,
        submittedAt: task.submittedAt ?? null,
        completedAt: task.completedAt ?? null,
        cancelledAt: task.cancelledAt ?? null,
        payloadJson: task.payloadJson ?? null,
      })

    return task
  }

  runInTransaction<T>(callback: () => T): T {
    return this.db.transaction(callback)()
  }
}
