import { nanoid } from 'nanoid';
import type { AuditLog, AuditLogAction, AuditLogLevel } from '../types/domain.js';
import type { AuditLogRepository } from '../repositories/audit-log.repository.js';

export interface WriteAuditLogInput {
  /** 日志级别，默认 info */
  level?: AuditLogLevel;
  /** 操作动作 */
  action: AuditLogAction;
  /** 关联实体类型 */
  entityType: string;
  /** 关联实体 ID */
  entityId?: string;
  /** 关联规则 ID */
  ruleId?: string;
  /** 关联触发事件 ID */
  triggerId?: string;
  /** 关联订单 ID */
  orderId?: string;
  /** 审计摘要 */
  message: string;
  /** 结构化详情对象，会被序列化为 JSON */
  payload?: Record<string, unknown>;
  /** 去重键，相同键在去重窗口内只写入一次 */
  dedupeKey?: string;
  /** 去重窗口，单位毫秒 */
  dedupeMs?: number;
}

export class AuditLogService {
  private readonly recentLogAt = new Map<string, number>();

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  list(limit?: number): AuditLog[] {
    return this.auditLogRepository.list(limit);
  }

  record(input: WriteAuditLogInput): AuditLog | undefined {
    if (input.dedupeKey) {
      const now = Date.now();
      const lastLoggedAt = this.recentLogAt.get(input.dedupeKey) ?? 0;
      if (now - lastLoggedAt < (input.dedupeMs ?? 60_000)) {
        return undefined;
      }

      this.recentLogAt.set(input.dedupeKey, now);
    }

    return this.auditLogRepository.create({
      id: nanoid(),
      level: input.level ?? 'info',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ruleId: input.ruleId,
      triggerId: input.triggerId,
      orderId: input.orderId,
      message: input.message,
      payloadJson: input.payload ? JSON.stringify(input.payload) : undefined,
      createdAt: new Date().toISOString()
    });
  }
}
