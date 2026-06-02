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
  /**
   * 记录去重键的过期时间戳。
   * 使用过期时间而不是最近写入时间，便于定期清理，避免服务长时间运行后内存持续增长。
   */
  private readonly recentLogExpiryAt = new Map<string, number>();
  /** 最近一次执行去重缓存清理的时间戳。 */
  private lastPrunedAt = 0;

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  list(limit?: number, actions?: AuditLogAction[], levels?: AuditLogLevel[]): AuditLog[] {
    return this.auditLogRepository.list(limit, actions, levels);
  }

  listPage(page: number, pageSize: number, actions?: AuditLogAction[], levels?: AuditLogLevel[]) {
    return this.auditLogRepository.listPage(page, pageSize, actions, levels);
  }

  record(input: WriteAuditLogInput): AuditLog | undefined {
    const now = Date.now();
    this.pruneExpiredDedupeKeys(now);

    if (input.dedupeKey) {
      const expiresAt = this.recentLogExpiryAt.get(input.dedupeKey) ?? 0;
      if (now < expiresAt) {
        return undefined;
      }

      this.recentLogExpiryAt.set(input.dedupeKey, now + (input.dedupeMs ?? 60_000));
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

  /**
   * 按时间窗口清理过期的去重键。
   * 这里使用按需清理，避免每次写日志都全量扫描，也避免常驻 Map 无界增长。
   */
  private pruneExpiredDedupeKeys(now: number) {
    if (now - this.lastPrunedAt < 60_000 && this.recentLogExpiryAt.size < 2_000) {
      return;
    }

    this.lastPrunedAt = now;
    for (const [dedupeKey, expiresAt] of this.recentLogExpiryAt.entries()) {
      if (expiresAt <= now) {
        this.recentLogExpiryAt.delete(dedupeKey);
      }
    }
  }
}
