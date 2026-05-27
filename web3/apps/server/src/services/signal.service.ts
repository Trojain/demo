import { nanoid } from 'nanoid';
import type { MonitorRule, TradingSignal, TriggerEvent } from '../types/domain.js';
import type { SignalRepository } from '../repositories/signal.repository.js';
import type { TriggerRepository } from '../repositories/trigger.repository.js';
import type { AuditLogService } from './audit-log.service.js';
import type { RiskService } from './risk.service.js';

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

export class SignalService {
  constructor(
    private readonly signalRepository: SignalRepository,
    private readonly triggerRepository: TriggerRepository,
    private readonly auditLogService: AuditLogService,
    private readonly riskService: RiskService
  ) {}

  list(limit?: number): TradingSignal[] {
    return this.signalRepository.list(limit);
  }

  createSignal(input: CreateSignalInput): TradingSignal | undefined {
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
    if (latestSignal?.status === 'rejected' && Number.isFinite(latestSignalAt) && Date.now() - latestSignalAt < input.rule.cooldownMs) {
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
      createdAt: input.createdAt
    });

    this.auditLogService.record({
      action: 'signal.created',
      entityType: 'signal',
      entityId: signal.id,
      ruleId: signal.ruleId,
      message: `${signal.symbol} 已生成交易信号`,
      payload: {
        exchange: signal.exchange,
        symbol: signal.symbol,
        marketPrice: signal.marketPrice,
        targetPrice: signal.targetPrice,
        operator: signal.operator
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
        signalId: signal.id
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
        triggerId: event.id
      }
    });

    return event;
  }
}
