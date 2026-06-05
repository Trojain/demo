import { nanoid } from 'nanoid';
import type { MonitorRule, TradingSignal, TriggerEvent } from '../types/domain.js';
import type { SignalRepository } from '../repositories/signal.repository.js';
import type { TriggerRepository } from '../repositories/trigger.repository.js';
import type { AuditLogService } from './audit-log.service.js';
import type { RiskService } from './risk.service.js';
import type { RuleRepository } from '../repositories/rule.repository.js';

interface CreateSignalInput {
  /** 命中的监控规则 */
  rule: MonitorRule;
  /** 命中时市场价 */
  marketPrice: string;
  /** 行情事件时间 */
  marketEventTime: string;
  /** 信号原因 */
  reason: string;
  /** 信号创建时间 */
  createdAt: string;
}

export interface CreateExternalSignalInput {
  /** 关联规则 ID，外部信号仍沿用现有规则的下单参数与风控配置。 */
  ruleId: string;
  /** 外部信号携带的市场价格。 */
  marketPrice: string;
  /** 行情事件时间，不传时回退为当前时间。 */
  marketEventTime?: string;
  /** 外部信号原因说明。 */
  reason: string;
  /** 外部信号的稳定来源键，用于排查和上游幂等。 */
  sourceKey?: string;
  /** 外部信号来源标签，例如 webhook、research、manual。 */
  sourceLabel?: string;
  /** 外部信号附加上下文。 */
  metadata?: Record<string, unknown>;
}

export class SignalService {
  constructor(
    private readonly signalRepository: SignalRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly triggerRepository: TriggerRepository,
    private readonly auditLogService: AuditLogService,
    private readonly riskService: RiskService
  ) {}

  list(limit?: number): TradingSignal[] {
    return this.signalRepository.list(limit);
  }

  createSignal(input: CreateSignalInput): TradingSignal | undefined {
    return this.createSignalInternal({
      rule: input.rule,
      marketPrice: input.marketPrice,
      marketEventTime: input.marketEventTime,
      reason: input.reason,
      createdAt: input.createdAt,
      sourceType: 'price_rule',
    });
  }

  createExternalSignal(input: CreateExternalSignalInput): { signal?: TradingSignal; trigger?: TriggerEvent } {
    const rule = this.ruleRepository.findById(input.ruleId);
    if (!rule) {
      throw new Error('外部信号关联规则不存在');
    }
    if (!rule.enabled) {
      throw new Error('外部信号关联规则未启用');
    }

    // 外部信号为用户主动输入，pending trigger/signal 时明确拒绝而非静默失败。
    const pendingTrigger = this.triggerRepository.findPendingByRuleId(rule.id);
    if (pendingTrigger) {
      throw new Error('当前规则已有待确认触发事件，外部信号暂不接受');
    }
    const pendingSignal = this.signalRepository.findPendingByRuleId(rule.id);
    if (pendingSignal) {
      throw new Error('当前规则已有待处理信号，外部信号暂不接受');
    }

    const nowIso = new Date().toISOString();
    const signal = this.createSignalInternal({
      rule,
      marketPrice: input.marketPrice,
      marketEventTime: input.marketEventTime ?? nowIso,
      reason: input.reason,
      createdAt: nowIso,
      sourceType: 'external_input',
      // 外部信号为用户主动输入，跳过风控拒绝后的冷却期过滤，避免用户意图被静默阻断。
      skipRejectedCooldown: true,
      sourceMetadataJson: JSON.stringify({
        sourceKey: input.sourceKey,
        sourceLabel: input.sourceLabel,
        ...(input.metadata ?? {}),
      }),
    });
    if (!signal) {
      return {};
    }

    const trigger = this.convertToTrigger(signal, rule);
    return {
      signal,
      trigger,
    };
  }

  private createSignalInternal(input: CreateSignalInput & {
    /** 信号来源类型，统一收口价格扫描与外部信号输入。 */
    sourceType: TradingSignal['sourceType'];
    /** 外部信号附加上下文，价格规则信号保持空值。 */
    sourceMetadataJson?: string;
    /** 外部信号跳过风控拒绝冷却期检查，避免用户主动输入被价格规则冷却期阻断。 */
    skipRejectedCooldown?: boolean;
  }): TradingSignal | undefined {
    const pendingEvent = this.triggerRepository.findPendingByRuleId(input.rule.id);
    if (pendingEvent) {
      this.auditLogService.record({
        level: 'warning',
        action: 'signal.duplicated',
        entityType: 'trigger',
        entityId: pendingEvent.id,
        ruleId: input.rule.id,
        triggerId: pendingEvent.id,
        message: `${input.rule.symbol} 已存在待确认触发，跳过重复信号`,
        payload: {
          exchange: input.rule.exchange,
          symbol: input.rule.symbol,
          marketPrice: input.marketPrice,
          targetPrice: input.rule.targetPrice
        },
        dedupeKey: `signal.duplicated.pending-trigger:${input.rule.id}`,
        dedupeMs: 60_000
      });
      return undefined;
    }

    const pendingSignal = this.signalRepository.findPendingByRuleId(input.rule.id);
    if (pendingSignal) {
      this.auditLogService.record({
        level: 'warning',
        action: 'signal.duplicated',
        entityType: 'signal',
        entityId: pendingSignal.id,
        ruleId: input.rule.id,
        message: `${input.rule.symbol} 已存在待处理信号，跳过重复生成`,
        payload: {
          exchange: input.rule.exchange,
          symbol: input.rule.symbol,
          marketPrice: input.marketPrice,
          targetPrice: input.rule.targetPrice
        },
        dedupeKey: `signal.duplicated.pending-signal:${input.rule.id}`,
        dedupeMs: 60_000
      });
      return undefined;
    }

    const latestSignal = this.signalRepository.findLatestByRuleId(input.rule.id);
    const latestSignalAt = latestSignal ? new Date(latestSignal.createdAt).getTime() : 0;
    if (
      !input.skipRejectedCooldown &&
      latestSignal?.status === 'rejected' &&
      Number.isFinite(latestSignalAt) &&
      Date.now() - latestSignalAt < input.rule.cooldownMs
    ) {
      this.auditLogService.record({
        level: 'warning',
        action: 'signal.duplicated',
        entityType: 'signal',
        entityId: latestSignal.id,
        ruleId: input.rule.id,
        message: `${input.rule.symbol} 最近信号已被风控拒绝，冷却期内跳过重复生成`,
        payload: {
          exchange: input.rule.exchange,
          symbol: input.rule.symbol,
          latestSignalId: latestSignal.id,
          cooldownMs: input.rule.cooldownMs
        },
        dedupeKey: `signal.duplicated.rejected-cooldown:${input.rule.id}`,
        dedupeMs: 60_000
      });
      return undefined;
    }

    const signal = this.signalRepository.create({
      id: nanoid(),
      ruleId: input.rule.id,
      exchange: input.rule.exchange,
      symbol: input.rule.symbol,
      marketPrice: input.marketPrice,
      marketEventTime: input.marketEventTime,
      sourceType: input.sourceType,
      targetPrice: input.rule.targetPrice,
      operator: input.rule.operator,
      side: input.rule.side,
      orderType: input.rule.orderType,
      baseQuantity: input.rule.baseQuantity,
      quoteAmount: input.rule.quoteAmount,
      limitPrice: input.rule.limitPrice,
      simulationMode: input.rule.simulationMode,
      status: 'pending',
      reason: input.reason,
      sourceMetadataJson: input.sourceMetadataJson,
      createdAt: input.createdAt
    });

    this.auditLogService.record({
      action: input.sourceType === 'external_input' ? 'signal.ingested' : 'signal.created',
      entityType: 'signal',
      entityId: signal.id,
      ruleId: signal.ruleId,
      message: input.sourceType === 'external_input' ? `${signal.symbol} 已接收外部信号` : `${signal.symbol} 已生成交易信号`,
      payload: {
        exchange: signal.exchange,
        symbol: signal.symbol,
        marketPrice: signal.marketPrice,
        targetPrice: signal.targetPrice,
        operator: signal.operator,
        sourceType: signal.sourceType,
        sourceMetadataJson: signal.sourceMetadataJson,
      }
    });

    return signal;
  }

  convertToTrigger(signal: TradingSignal, rule: MonitorRule): TriggerEvent | undefined {
    const pendingEvent = this.triggerRepository.findPendingByRuleId(signal.ruleId);
    const riskCheck = this.riskService.checkSignal({
      signal,
      rule,
      hasPendingTrigger: Boolean(pendingEvent)
    });

    if (riskCheck.status === 'rejected') {
      this.signalRepository.markRejected(signal.id);
      return undefined;
    }

    const event = this.triggerRepository.create({
      id: nanoid(),
      ruleId: signal.ruleId,
      exchange: signal.exchange,
      symbol: signal.symbol,
      marketPrice: signal.marketPrice,
      targetPrice: signal.targetPrice,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // 信号层当前会自动转成触发事件，仍保留 trigger.created 审计记录，方便按旧链路排查问题。
    this.auditLogService.record({
      action: 'trigger.created',
      entityType: 'trigger',
      entityId: event.id,
      ruleId: signal.ruleId,
      triggerId: event.id,
      message: `${signal.symbol} 已触发目标价`,
      payload: {
        exchange: signal.exchange,
        symbol: signal.symbol,
        operator: signal.operator,
        marketPrice: signal.marketPrice,
        targetPrice: signal.targetPrice,
        signalId: signal.id,
        sourceType: signal.sourceType,
      }
    });

    this.signalRepository.markConverted(signal.id);
    this.auditLogService.record({
      action: 'signal.converted',
      entityType: 'signal',
      entityId: signal.id,
      ruleId: signal.ruleId,
      triggerId: event.id,
      message: `${signal.symbol} 信号已转换为触发事件`,
      payload: {
        signalId: signal.id,
        triggerId: event.id,
        sourceType: signal.sourceType,
      }
    });

    return event;
  }
}
