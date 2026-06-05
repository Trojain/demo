import type Database from 'better-sqlite3'
import type {
  OrderRecoveryFailureStage,
  OrderRecoveryRecord,
  OrderRecoveryStatus,
} from '../types/domain.js'

type OrderRecoveryRow = {
  id: string
  identity_key: string
  order_id?: string | null
  exchange_order_id?: string | null
  exchange: OrderRecoveryRecord['exchange']
  source: OrderRecoveryRecord['source']
  mode: OrderRecoveryRecord['mode']
  symbol?: string | null
  failure_stage: OrderRecoveryFailureStage
  recovery_status: OrderRecoveryStatus
  retry_count: number
  max_retry_count: number
  last_error_code?: string | null
  last_error_message?: string | null
  next_retry_at?: string | null
  payload_json?: string | null
  created_at: string
  updated_at: string
  resolved_at?: string | null
}

function mapOrderRecovery(row: OrderRecoveryRow): OrderRecoveryRecord {
  return {
    id: row.id,
    identityKey: row.identity_key,
    orderId: row.order_id ?? undefined,
    exchangeOrderId: row.exchange_order_id ?? undefined,
    exchange: row.exchange,
    source: row.source,
    mode: row.mode,
    symbol: row.symbol ?? undefined,
    failureStage: row.failure_stage,
    recoveryStatus: row.recovery_status,
    retryCount: row.retry_count,
    maxRetryCount: row.max_retry_count,
    lastErrorCode: row.last_error_code ?? undefined,
    lastErrorMessage: row.last_error_message ?? undefined,
    nextRetryAt: row.next_retry_at ?? undefined,
    payloadJson: row.payload_json ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? undefined,
  }
}

export class OrderRecoveryRepository {
  constructor(private readonly db: Database.Database) {}

  create(record: OrderRecoveryRecord): OrderRecoveryRecord {
    this.db
      .prepare(
        `INSERT INTO order_recovery_records (
          id, identity_key, order_id, exchange_order_id, exchange, source, mode, symbol,
          failure_stage, recovery_status, retry_count, max_retry_count, last_error_code,
          last_error_message, next_retry_at, payload_json, created_at, updated_at, resolved_at
        ) VALUES (
          @id, @identityKey, @orderId, @exchangeOrderId, @exchange, @source, @mode, @symbol,
          @failureStage, @recoveryStatus, @retryCount, @maxRetryCount, @lastErrorCode,
          @lastErrorMessage, @nextRetryAt, @payloadJson, @createdAt, @updatedAt, @resolvedAt
        )`,
      )
      .run({
        ...record,
        orderId: record.orderId ?? null,
        exchangeOrderId: record.exchangeOrderId ?? null,
        symbol: record.symbol ?? null,
        lastErrorCode: record.lastErrorCode ?? null,
        lastErrorMessage: record.lastErrorMessage ?? null,
        nextRetryAt: record.nextRetryAt ?? null,
        payloadJson: record.payloadJson ?? null,
        resolvedAt: record.resolvedAt ?? null,
      })

    return record
  }

  findById(id: string): OrderRecoveryRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM order_recovery_records WHERE id = ? LIMIT 1')
      .get(id) as OrderRecoveryRow | undefined
    return row ? mapOrderRecovery(row) : undefined
  }

  findLatestActiveByIdentityKey(identityKey: string): OrderRecoveryRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM order_recovery_records
         WHERE identity_key = ?
           AND recovery_status IN ('pending_recovery', 'recovering', 'recovery_failed', 'manual_review_required')
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(identityKey) as OrderRecoveryRow | undefined
    return row ? mapOrderRecovery(row) : undefined
  }

  listPage(input: {
    page: number
    pageSize: number
    statuses?: OrderRecoveryStatus[]
    stages?: OrderRecoveryFailureStage[]
  }) {
    const safePage = Math.max(1, input.page)
    const safePageSize = Math.max(1, input.pageSize)
    const offset = (safePage - 1) * safePageSize
    const { whereSql, params } = this.buildFilterQuery(input.statuses, input.stages)
    const totalRow = this.db
      .prepare(`SELECT COUNT(1) as total FROM order_recovery_records ${whereSql}`)
      .get(...params) as { total: number } | undefined
    const items = this.db
      .prepare(`SELECT * FROM order_recovery_records ${whereSql} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
      .all(...params, safePageSize, offset)
      .map(row => mapOrderRecovery(row as OrderRecoveryRow))

    return {
      items,
      total: totalRow?.total ?? 0,
      page: safePage,
      pageSize: safePageSize,
    }
  }

  listDueForRetry(nowIso: string, limit: number): OrderRecoveryRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM order_recovery_records
         WHERE recovery_status IN ('pending_recovery', 'recovery_failed')
           AND (next_retry_at IS NULL OR next_retry_at <= ?)
         ORDER BY updated_at ASC
         LIMIT ?`,
      )
      .all(nowIso, limit)
      .map(row => mapOrderRecovery(row as OrderRecoveryRow))
  }

  update(record: OrderRecoveryRecord): OrderRecoveryRecord {
    this.db
      .prepare(
        `UPDATE order_recovery_records
         SET identity_key = @identityKey,
             order_id = @orderId,
             exchange_order_id = @exchangeOrderId,
             exchange = @exchange,
             source = @source,
             mode = @mode,
             symbol = @symbol,
             failure_stage = @failureStage,
             recovery_status = @recoveryStatus,
             retry_count = @retryCount,
             max_retry_count = @maxRetryCount,
             last_error_code = @lastErrorCode,
             last_error_message = @lastErrorMessage,
             next_retry_at = @nextRetryAt,
             payload_json = @payloadJson,
             updated_at = @updatedAt,
             resolved_at = @resolvedAt
         WHERE id = @id`,
      )
      .run({
        ...record,
        orderId: record.orderId ?? null,
        exchangeOrderId: record.exchangeOrderId ?? null,
        symbol: record.symbol ?? null,
        lastErrorCode: record.lastErrorCode ?? null,
        lastErrorMessage: record.lastErrorMessage ?? null,
        nextRetryAt: record.nextRetryAt ?? null,
        payloadJson: record.payloadJson ?? null,
        resolvedAt: record.resolvedAt ?? null,
      })

    return record
  }

  private buildFilterQuery(statuses?: OrderRecoveryStatus[], stages?: OrderRecoveryFailureStage[]) {
    const conditions: string[] = []
    const params: Array<string | number> = []
    if (statuses && statuses.length > 0) {
      conditions.push(`recovery_status IN (${statuses.map(() => '?').join(', ')})`)
      params.push(...statuses)
    }
    if (stages && stages.length > 0) {
      conditions.push(`failure_stage IN (${stages.map(() => '?').join(', ')})`)
      params.push(...stages)
    }
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    return { whereSql, params }
  }
}
