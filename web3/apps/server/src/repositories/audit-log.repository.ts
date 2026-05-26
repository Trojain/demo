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

  list(limit = 100): AuditLog[] {
    return this.db
      .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?')
      .all(limit)
      .map(row => mapAuditLog(row as AuditLogRow))
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
}
