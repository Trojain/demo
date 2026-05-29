import { Decimal } from 'decimal.js'
import type { MonitorRule } from '../types/domain.js'
import type { RuleRepository } from '../repositories/rule.repository.js'
import type { MarketService } from './market.service.js'
import type { NotificationService } from './notification.service.js'
import type { AuditLogService } from './audit-log.service.js'
import type { SignalService } from './signal.service.js'

export class StrategyService {
  private timer?: NodeJS.Timeout
  private scanning = false

  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly marketService: MarketService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
    private readonly signalService: SignalService,
  ) {}

  start() {
    this.timer = setInterval(() => {
      void this.scanRules()
    }, 1000)
  }

  stop() {
    clearInterval(this.timer)
  }

  async scanRules() {
    if (this.scanning) {
      return
    }

    this.scanning = true
    const scanStartedAt = new Date().toISOString()
    let enabledRules: MonitorRule[] = []
    try {
      enabledRules = this.ruleRepository.listEnabled()
      try {
        // 总览快照只用于刷新服务端缓存，实时价格推送由交易所 WebSocket ticker 负责，避免缓存快照覆盖实时价格。
        await this.marketService.refreshOverviewSnapshots('okx')
      } catch (error) {
        const message = error instanceof Error ? error.message : '总览行情刷新失败'
        // 总览行情属于看板刷新，失败时只写审计日志，规则状态由单条规则检测结果决定。
        this.auditLogService.record({
          level: 'error',
          action: 'strategy.error',
          entityType: 'market',
          entityId: 'overview',
          message,
          dedupeKey: `strategy.error:overview:${message}`,
          dedupeMs: 60_000,
          payload: {
            exchange: 'okx',
            scope: 'overview',
            ruleCount: enabledRules.length,
          },
        })
      }

      this.marketService.refreshSubscriptions(enabledRules, ticker => {
        this.notificationService.broadcast('ticker.updated', ticker)
      })

      for (const rule of enabledRules) {
        await this.checkRule(rule)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '策略扫描失败'
      // 外层保护用于兜底未知错误，避免单次扫描异常导致服务进程退出。
      enabledRules.forEach(rule => {
        this.ruleRepository.updateRuntimeState(rule.id, {
          lastCheckedAt: scanStartedAt,
          runtimeStatus: 'error',
          lastErrorMessage: message,
        })
        this.auditLogService.record({
          level: 'error',
          action: 'strategy.error',
          entityType: 'rule',
          entityId: rule.id,
          ruleId: rule.id,
          message,
          dedupeKey: `strategy.error:scan:${rule.id}:${message}`,
          dedupeMs: 60_000,
          payload: {
            exchange: rule.exchange,
            symbol: rule.symbol,
            scope: 'scan',
          },
        })
      })
    } finally {
      this.scanning = false
    }
  }

  private async checkRule(rule: MonitorRule) {
    try {
      const now = Date.now()
      const lastChecked = rule.lastCheckedAt ? new Date(rule.lastCheckedAt).getTime() : 0
      if (now - lastChecked < rule.checkIntervalMs) {
        return
      }

      const ticker = await this.marketService.getLatestPrice(rule.exchange, rule.symbol)
      this.notificationService.broadcast('ticker.updated', ticker)

      if (rule.triggeredCount >= rule.maxTriggerCount) {
        this.ruleRepository.updateRuntimeState(rule.id, {
          lastCheckedAt: new Date(now).toISOString(),
          runtimeStatus: 'limit_reached',
          lastErrorMessage: null,
        })
        return
      }

      this.ruleRepository.updateRuntimeState(rule.id, {
        lastCheckedAt: new Date(now).toISOString(),
        runtimeStatus: 'running',
        lastErrorMessage: null,
      })

      const lastTriggered = rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt).getTime() : 0
      if (lastTriggered && now - lastTriggered < rule.cooldownMs) {
        return
      }

      const marketPrice = new Decimal(ticker.price)
      const targetPrice = new Decimal(rule.targetPrice)
      const matched = rule.operator === 'gte' ? marketPrice.greaterThanOrEqualTo(targetPrice) : marketPrice.lessThanOrEqualTo(targetPrice)

      if (!matched) {
        return
      }

      const signal = this.signalService.createSignal({
        rule,
        marketPrice: ticker.price,
        marketEventTime: ticker.eventTime,
        reason: `市场价 ${ticker.price} ${rule.operator === 'gte' ? '大于等于' : '小于等于'} 目标价 ${rule.targetPrice}`,
        createdAt: new Date(now).toISOString(),
      })

      if (!signal) {
        return
      }

      const event = this.signalService.convertToTrigger(signal, rule)
      if (!event) {
        return
      }

      this.ruleRepository.updateRuntimeState(rule.id, {
        lastTriggeredAt: event.createdAt,
        triggeredCount: rule.triggeredCount + 1,
        runtimeStatus: rule.triggeredCount + 1 >= rule.maxTriggerCount ? 'limit_reached' : 'running',
        lastErrorMessage: null,
      })
      this.notificationService.broadcast('trigger.created', event)
    } catch (error) {
      const message = error instanceof Error ? error.message : '策略检测失败'
      this.ruleRepository.updateRuntimeState(rule.id, {
        runtimeStatus: 'error',
        lastErrorMessage: message,
      })
      this.auditLogService.record({
        level: 'error',
        action: 'strategy.error',
        entityType: 'rule',
        entityId: rule.id,
        ruleId: rule.id,
        message,
        dedupeKey: `strategy.error:rule:${rule.id}:${message}`,
        dedupeMs: 60_000,
        payload: {
          exchange: rule.exchange,
          symbol: rule.symbol,
          scope: 'rule',
        },
      })
    }
  }
}
