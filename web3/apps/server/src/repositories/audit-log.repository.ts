import type Database from 'better-sqlite3'
import type { AuditLog } from '../types/domain.js'

type AuditLogRow = {
  id: string
  level: AuditLog['level']
  action: AuditLog['action']
  entity_type: string
  entity_id?: string
  rule_id?: string
  trigger_id?: string
  order_id?: string
  message: string
  payload_json?: string
  created_at: string
}

function mapAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    level: row.level,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    ruleId: row.rule_id,
    triggerId: row.trigger_id,
    orderId: row.order_id,
    message: row.message,
    payloadJson: row.payload_json,
    createdAt: row.created_at,
  }
}

export class AuditLogRepository {
  constructor(private readonly db: Database.Database) {}

  list(limit = 100, actions?: AuditLog['action'][], levels?: AuditLog['level'][]): AuditLog[] {
    const { whereSql, params } = this.buildFilterQuery(actions, levels)
    params.push(limit)

    return this.db
      .prepare(`SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ?`)
      .all(...params)
      .map(row => mapAuditLog(row as AuditLogRow))
  }

  listPage(page = 1, pageSize = 20, actions?: AuditLog['action'][], levels?: AuditLog['level'][]) {
    const safePage = Math.max(1, page)
    const safePageSize = Math.max(1, pageSize)
    const offset = (safePage - 1) * safePageSize
    const { whereSql, params } = this.buildFilterQuery(actions, levels)
    const totalRow = this.db
      .prepare(`SELECT COUNT(1) as total FROM audit_logs ${whereSql}`)
      .get(...params) as { total: number } | undefined
    const items = this.db
      .prepare(`SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, safePageSize, offset)
      .map(row => mapAuditLog(row as AuditLogRow))

    return {
      items,
      total: totalRow?.total ?? 0,
      page: safePage,
      pageSize: safePageSize,
    }
  }

  listByRuleId(ruleId: string, limit = 100): AuditLog[] {
    return this.db
      .prepare('SELECT * FROM audit_logs WHERE rule_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(ruleId, limit)
      .map(row => mapAuditLog(row as AuditLogRow))
  }

  existsByActionAndEntity(input: {
    action: AuditLog['action']
    entityType: string
    entityId?: string
    orderId?: string
    triggerId?: string
  }) {
    const conditions = ['action = ?', 'entity_type = ?']
    const params: Array<string> = [input.action, input.entityType]

    if (input.entityId) {
      conditions.push('entity_id = ?')
      params.push(input.entityId)
    }
    if (input.orderId) {
      conditions.push('order_id = ?')
      params.push(input.orderId)
    }
    if (input.triggerId) {
      conditions.push('trigger_id = ?')
      params.push(input.triggerId)
    }

    const row = this.db
      .prepare(`SELECT 1 AS exists_flag FROM audit_logs WHERE ${conditions.join(' AND ')} LIMIT 1`)
      .get(...params) as { exists_flag: number } | undefined

    return Boolean(row)
  }

  create(log: AuditLog): AuditLog {
    this.db
      .prepare(
        `INSERT INTO audit_logs (
          id, level, action, entity_type, entity_id, rule_id, trigger_id,
          order_id, message, payload_json, created_at
        ) VALUES (
          @id, @level, @action, @entityType, @entityId, @ruleId, @triggerId,
          @orderId, @message, @payloadJson, @createdAt
        )`,
      )
      .run({
        ...log,
        entityId: log.entityId ?? null,
        ruleId: log.ruleId ?? null,
        triggerId: log.triggerId ?? null,
        orderId: log.orderId ?? null,
        payloadJson: log.payloadJson ?? null,
      })

    return log
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM audit_logs WHERE id = ?').run(id)
    return result.changes > 0
  }

  listAuditsForAnalysis(input: {
    fromDate: string
    toDate: string
    action?: string
  }): AuditLog[] {
    const conditions = [
      `date(created_at, 'localtime') >= ?`,
      `date(created_at, 'localtime') <= ?`,
    ]
    const params: Array<string | number> = [input.fromDate, input.toDate]
    if (input.action) {
      conditions.push('action = ?')
      params.push(input.action)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    return this.db
      .prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC`)
      .all(...params)
      .map(row => mapAuditLog(row as AuditLogRow))
  }

  /**
   * 统一拼装审计日志筛选条件，避免列表和分页查询各写一套 SQL 条件。
   */
  private buildFilterQuery(actions?: AuditLog['action'][], levels?: AuditLog['level'][]) {
    const conditions: string[] = []
    const params: Array<string | number> = []
    if (actions && actions.length > 0) {
      conditions.push(`action IN (${actions.map(() => '?').join(', ')})`)
      params.push(...actions)
    }
    if (levels && levels.length > 0) {
      conditions.push(`level IN (${levels.map(() => '?').join(', ')})`)
      params.push(...levels)
    }
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    return {
      whereSql,
      params,
    }
  }
}
