import { Decimal } from 'decimal.js';
import { nanoid } from 'nanoid';
import type { MonitorRule } from '../types/domain.js';
import type { RuleRepository } from '../repositories/rule.repository.js';
import type { TriggerRepository } from '../repositories/trigger.repository.js';
import type { MarketService } from './market.service.js';
import type { NotificationService } from './notification.service.js';

export class StrategyService {
  private timer?: NodeJS.Timeout;
  private scanning = false;

  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly triggerRepository: TriggerRepository,
    private readonly marketService: MarketService,
    private readonly notificationService: NotificationService
  ) {}

  start() {
    this.timer = setInterval(() => {
      void this.scanRules();
    }, 1000);
  }

  stop() {
    clearInterval(this.timer);
  }

  async scanRules() {
    if (this.scanning) {
      return;
    }

    this.scanning = true;
    const scanStartedAt = new Date().toISOString();
    let enabledRules: MonitorRule[] = [];
    try {
      enabledRules = this.ruleRepository.listEnabled();
      try {
        const overviewSnapshots = await this.marketService.refreshOverviewSnapshots('okx');
        overviewSnapshots.forEach((ticker) => {
          this.notificationService.broadcast('ticker.updated', ticker);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '总览行情刷新失败';
        // 总览行情刷新失败不阻断单条规则检测，规则详情中保留最近公共行情错误。
        enabledRules.forEach((rule) => {
          this.ruleRepository.updateRuntimeState(rule.id, {
            lastCheckedAt: scanStartedAt,
            runtimeStatus: 'error',
            lastErrorMessage: message
          });
        });
      }

      this.marketService.refreshSubscriptions(enabledRules, (ticker) => {
        this.notificationService.broadcast('ticker.updated', ticker);
      });

      for (const rule of enabledRules) {
        await this.checkRule(rule);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '策略扫描失败';
      // 外层保护用于兜底未知错误，避免单次扫描异常导致服务进程退出。
      enabledRules.forEach((rule) => {
        this.ruleRepository.updateRuntimeState(rule.id, {
          lastCheckedAt: scanStartedAt,
          runtimeStatus: 'error',
          lastErrorMessage: message
        });
      });
    } finally {
      this.scanning = false;
    }
  }

  private async checkRule(rule: MonitorRule) {
    try {
      const now = Date.now();
      const lastChecked = rule.lastCheckedAt ? new Date(rule.lastCheckedAt).getTime() : 0;
      if (now - lastChecked < rule.checkIntervalMs) {
        return;
      }

      const ticker = await this.marketService.refreshLatestPrice(rule.exchange, rule.symbol);
      this.notificationService.broadcast('ticker.updated', ticker);

      if (rule.triggeredCount >= rule.maxTriggerCount) {
        this.ruleRepository.updateRuntimeState(rule.id, {
          lastCheckedAt: new Date(now).toISOString(),
          runtimeStatus: 'limit_reached',
          lastErrorMessage: null
        });
        return;
      }

      this.ruleRepository.updateRuntimeState(rule.id, {
        lastCheckedAt: new Date(now).toISOString(),
        runtimeStatus: 'running',
        lastErrorMessage: null
      });

      const lastTriggered = rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt).getTime() : 0;
      if (lastTriggered && now - lastTriggered < rule.cooldownMs) {
        return;
      }

      const marketPrice = new Decimal(ticker.price);
      const targetPrice = new Decimal(rule.targetPrice);
      const matched = rule.operator === 'gte' ? marketPrice.greaterThanOrEqualTo(targetPrice) : marketPrice.lessThanOrEqualTo(targetPrice);

      if (!matched) {
        return;
      }

      const pendingEvent = this.triggerRepository.findPendingByRuleId(rule.id);
      if (pendingEvent) {
        this.ruleRepository.updateRuntimeState(rule.id, {
          lastTriggeredAt: pendingEvent.createdAt,
          runtimeStatus: 'running',
          lastErrorMessage: null
        });
        return;
      }

      const event = this.triggerRepository.create({
        id: nanoid(),
        ruleId: rule.id,
        exchange: rule.exchange,
        symbol: rule.symbol,
        marketPrice: ticker.price,
        targetPrice: rule.targetPrice,
        status: 'pending',
        createdAt: new Date(now).toISOString()
      });

      this.ruleRepository.updateRuntimeState(rule.id, {
        lastTriggeredAt: event.createdAt,
        triggeredCount: rule.triggeredCount + 1,
        runtimeStatus: rule.triggeredCount + 1 >= rule.maxTriggerCount ? 'limit_reached' : 'running',
        lastErrorMessage: null
      });
      this.notificationService.broadcast('trigger.created', event);
    } catch (error) {
      this.ruleRepository.updateRuntimeState(rule.id, {
        runtimeStatus: 'error',
        lastErrorMessage: error instanceof Error ? error.message : '策略检测失败'
      });
    }
  }
}
