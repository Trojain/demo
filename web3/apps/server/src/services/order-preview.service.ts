import { Decimal } from 'decimal.js'
import type { MonitorRule, OrderPreview, OrderPreviewCheckItem, TriggerEvent } from '../types/domain.js'
import type { RiskCheckRepository } from '../repositories/risk-check.repository.js'
import type { RuleRepository } from '../repositories/rule.repository.js'
import type { TriggerRepository } from '../repositories/trigger.repository.js'
import { appConfig } from '../config/env.js'
import type { MarketService } from './market.service.js'
import type { RiskConfigService } from './risk-config.service.js'
import type { TradeExecutionService } from './trade-execution.service.js'
import { RuleValidationError, type TradingRuleService } from './trading-rule.service.js'
import { formatLocalDate } from '../utils/local-date.js'

interface PreviewContext {
  /** 待预览的触发事件 */
  trigger: TriggerEvent
  /** 触发事件关联的监控规则 */
  rule: MonitorRule
  /** 执行参考价 */
  executionPrice: Decimal
  /** 执行参考行情时间 */
  executionEventTime: string
  /** 预估计价金额 */
  estimatedQuoteAmount: Decimal
}

export class OrderPreviewService {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly triggerRepository: TriggerRepository,
    private readonly riskCheckRepository: RiskCheckRepository,
    private readonly marketService: MarketService,
    private readonly riskConfigService: RiskConfigService,
    private readonly tradingRuleService: TradingRuleService,
    private readonly tradeExecutionService: TradeExecutionService,
  ) {}

  async preview(triggerId: string): Promise<OrderPreview> {
    const trigger = this.triggerRepository.findById(triggerId)
    if (!trigger) {
      throw new Error('触发事件不存在')
    }

    const rule = this.ruleRepository.findById(trigger.ruleId)
    if (!rule) {
      throw new Error('关联监控规则不存在')
    }

    const latestTicker = await this.marketService.getLatestPrice(rule.exchange, rule.symbol)
    const executionPrice = this.resolveExecutionPrice(trigger, rule, latestTicker.price)
    const estimatedQuoteAmount = this.calculateEstimatedQuoteAmount(rule, executionPrice)
    const context: PreviewContext = {
      trigger,
      rule,
      executionPrice,
      executionEventTime: latestTicker.eventTime,
      estimatedQuoteAmount,
    }

    const tradingRuleItems = await this.buildTradingRuleItems(rule)
    const riskItems = this.buildRiskItems(context)
    const tradePreview = await this.tradeExecutionService.preview({
      mode: rule.simulationMode || !appConfig.enableRealTrading ? 'simulation' : 'real',
      exchange: rule.exchange,
      symbol: rule.symbol,
      side: rule.side,
      orderType: rule.orderType,
      baseQuantity: rule.baseQuantity,
      quoteAmount: rule.quoteAmount,
      limitPrice: rule.limitPrice,
    })

    return {
      triggerId: trigger.id,
      ruleId: rule.id,
      exchange: rule.exchange,
      symbol: rule.symbol,
      side: rule.side,
      orderType: rule.orderType,
      targetPrice: trigger.targetPrice,
      triggerPrice: trigger.marketPrice,
      executionPrice: executionPrice.toFixed(),
      baseQuantity: rule.baseQuantity,
      quoteAmount: rule.quoteAmount,
      estimatedQuoteAmount: estimatedQuoteAmount.toFixed(),
      maxSlippagePercent: rule.maxSlippagePercent,
      simulationMode: rule.simulationMode || !appConfig.enableRealTrading,
      tradingRulePassed: tradingRuleItems.every(item => item.passed),
      tradingRuleItems,
      riskPassed: riskItems.every(item => item.passed),
      riskItems,
      accountPassed: tradePreview.passed,
      accountItems: tradePreview.checkItems,
      nextAvailableQuoteBalance: tradePreview.nextAvailableQuoteBalance,
      nextAvailableBaseQuantity: tradePreview.nextAvailableBaseQuantity,
      estimatedRealizedPnl: tradePreview.estimatedRealizedPnl,
      previewedAt: new Date().toISOString(),
    }
  }

  private resolveExecutionPrice(trigger: TriggerEvent, rule: MonitorRule, latestPrice: string) {
    const referencePrice = rule.orderType === 'limit' && rule.limitPrice ? rule.limitPrice : latestPrice || trigger.marketPrice
    return new Decimal(referencePrice)
  }

  private calculateEstimatedQuoteAmount(rule: MonitorRule, executionPrice: Decimal) {
    if (rule.quoteAmount) {
      return new Decimal(rule.quoteAmount)
    }

    if (rule.baseQuantity) {
      return new Decimal(rule.baseQuantity).mul(executionPrice)
    }

    return new Decimal(0)
  }

  private async buildTradingRuleItems(rule: MonitorRule): Promise<OrderPreviewCheckItem[]> {
    try {
      const instrumentRule = await this.tradingRuleService.validateMonitorRule({
        exchange: rule.exchange,
        symbol: rule.symbol,
        operator: rule.operator,
        targetPrice: rule.targetPrice,
        checkIntervalMs: rule.checkIntervalMs,
        side: rule.side,
        orderType: rule.orderType,
        baseQuantity: rule.baseQuantity,
        quoteAmount: rule.quoteAmount,
        limitPrice: rule.limitPrice,
        maxSlippagePercent: rule.maxSlippagePercent,
        cooldownMs: rule.cooldownMs,
        maxTriggerCount: rule.maxTriggerCount,
        simulationMode: rule.simulationMode,
        enabled: rule.enabled,
      })

      return [
        {
          code: 'instrument_rule',
          passed: true,
          message: `交易规则通过，tickSize=${instrumentRule.tickSize}，lotSize=${instrumentRule.lotSize}，minSize=${instrumentRule.minSize}`,
        },
      ]
    } catch (error) {
      if (error instanceof RuleValidationError) {
        return error.issues.map(issue => ({
          code: `instrument_rule.${issue.path}`,
          passed: false,
          message: issue.message,
        }))
      }

      return [
        {
          code: 'instrument_rule.error',
          passed: false,
          message: error instanceof Error ? error.message : '交易规则校验失败',
        },
      ]
    }
  }

  private buildRiskItems(context: PreviewContext): OrderPreviewCheckItem[] {
    const riskConfig = this.riskConfigService.getConfig()
    const maxQuoteAmount = new Decimal(riskConfig.maxQuoteAmount)
    const marketAgeMs = Date.now() - new Date(context.executionEventTime).getTime()
    const marketAgeValid = Number.isFinite(marketAgeMs) && marketAgeMs >= 0
    const dailyStats = this.riskCheckRepository.getPassedStatsByDate(formatLocalDate(new Date()))
    const nextDailyQuoteAmount = new Decimal(dailyStats.quoteAmount).plus(context.estimatedQuoteAmount)

    return [
      {
        code: 'trigger_status',
        passed: context.trigger.status === 'pending',
        message: context.trigger.status === 'pending' ? '触发事件待确认' : '触发事件已经处理',
      },
      {
        code: 'quote_amount_limit',
        passed: context.estimatedQuoteAmount.lessThanOrEqualTo(maxQuoteAmount),
        message: `预估计价金额 ${context.estimatedQuoteAmount.toFixed()}，上限 ${maxQuoteAmount.toFixed()}`,
      },
      {
        code: 'market_freshness',
        passed: marketAgeValid && marketAgeMs <= riskConfig.maxMarketAgeMs,
        message: marketAgeValid ? `执行参考行情延迟 ${marketAgeMs}ms，上限 ${riskConfig.maxMarketAgeMs}ms` : '执行参考行情时间无效',
      },
      {
        code: 'real_trading_switch',
        passed: context.rule.simulationMode || (appConfig.enableRealTrading && riskConfig.tradingMode === 'allow_real'),
        message: context.rule.simulationMode ? '模拟交易允许通过' : `交易模式为 ${riskConfig.tradingMode}`,
      },
      {
        code: 'trigger_limit',
        passed: context.rule.triggeredCount <= context.rule.maxTriggerCount,
        message: `规则已触发 ${context.rule.triggeredCount}/${context.rule.maxTriggerCount}`,
      },
      {
        code: 'daily_trigger_count',
        passed: dailyStats.count + 1 <= riskConfig.dailyMaxTriggerCount,
        message: `今日风控通过次数 ${dailyStats.count + 1}/${riskConfig.dailyMaxTriggerCount}`,
      },
      {
        code: 'daily_quote_amount',
        passed: nextDailyQuoteAmount.lessThanOrEqualTo(riskConfig.dailyMaxQuoteAmount),
        message: `今日累计计价金额 ${nextDailyQuoteAmount.toFixed()}，上限 ${riskConfig.dailyMaxQuoteAmount}`,
      },
    ]
  }
}
