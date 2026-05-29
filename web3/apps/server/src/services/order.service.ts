import type { RuleRepository } from '../repositories/rule.repository.js'
import type { TriggerRepository } from '../repositories/trigger.repository.js'
import type { OrderPreview, OrderPreviewCheckItem, OrderRecord } from '../types/domain.js'
import type { AuditLogService } from './audit-log.service.js'
import type { OrderPreviewService } from './order-preview.service.js'
import { TradeExecutionError, type TradeExecutionService } from './trade-execution.service.js'

export class FinalOrderValidationError extends Error {
  constructor(
    message: string,
    /** 最终确认时重新生成的下单预览，便于接口层返回可排查信息 */
    readonly preview: OrderPreview,
    /** 未通过的最终校验项 */
    readonly failedItems: OrderPreviewCheckItem[],
  ) {
    super(message)
    this.name = 'FinalOrderValidationError'
  }
}

export class OrderService {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly triggerRepository: TriggerRepository,
    private readonly orderPreviewService: OrderPreviewService,
    private readonly tradeExecutionService: TradeExecutionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async confirmTrigger(triggerId: string): Promise<OrderRecord> {
    const trigger = this.triggerRepository.findById(triggerId)
    if (!trigger) {
      throw new Error('触发事件不存在')
    }

    if (trigger.status !== 'pending') {
      throw new Error('触发事件已经处理，不能重复确认')
    }

    const rule = this.ruleRepository.findById(trigger.ruleId)
    if (!rule) {
      throw new Error('关联监控规则不存在')
    }

    const finalPreview = await this.validateBeforeSubmit(triggerId)
    const order = await this.tradeExecutionService.confirmRuleTrigger({
      triggerId,
      rule,
    })

    this.triggerRepository.markConfirmed(triggerId)
    this.auditLogService.record({
      action: 'trigger.confirmed',
      entityType: 'trigger',
      entityId: triggerId,
      ruleId: rule.id,
      triggerId,
      orderId: order.id,
      message: `已确认 ${rule.symbol} 触发事件`,
      payload: {
        exchange: rule.exchange,
        symbol: rule.symbol,
        marketPrice: trigger.marketPrice,
        targetPrice: trigger.targetPrice,
      },
    })
    this.auditLogService.record({
      action: 'order.submitted',
      entityType: 'order',
      entityId: order.id,
      ruleId: rule.id,
      triggerId,
      orderId: order.id,
      message: `${rule.symbol} 订单已提交`,
      payload: {
        exchange: rule.exchange,
        side: rule.side,
        orderType: rule.orderType,
        simulationMode: order.simulationMode,
        exchangeOrderId: order.exchangeOrderId,
      },
    })
    return order
  }

  private async validateBeforeSubmit(triggerId: string): Promise<OrderPreview> {
    const preview = await this.orderPreviewService.preview(triggerId)
    const failedItems = [...preview.tradingRuleItems, ...preview.riskItems, ...(preview.accountItems ?? [])].filter(item => !item.passed)

    if (preview.tradingRulePassed && preview.riskPassed && preview.accountPassed !== false && failedItems.length === 0) {
      return preview
    }

    const reason = failedItems.map(item => item.message).join('；') || '最终校验未通过'
    // 最终确认前重新走交易规则和风控预览，防止用户打开预览后行情或配置变化导致绕过校验。
    this.auditLogService.record({
      level: 'warning',
      action: 'order.final_validation_failed',
      entityType: 'trigger',
      entityId: triggerId,
      ruleId: preview.ruleId,
      triggerId,
      message: `${preview.symbol} 下单最终校验未通过：${reason}`,
      payload: {
        exchange: preview.exchange,
        symbol: preview.symbol,
        side: preview.side,
        orderType: preview.orderType,
        executionPrice: preview.executionPrice,
        estimatedQuoteAmount: preview.estimatedQuoteAmount,
        simulationMode: preview.simulationMode,
        failedItems,
        tradingRuleItems: preview.tradingRuleItems,
        riskItems: preview.riskItems,
        accountItems: preview.accountItems,
        previewedAt: preview.previewedAt,
      },
    })

    throw new FinalOrderValidationError(`下单最终校验未通过：${reason}`, preview, failedItems)
  }
}

export { TradeExecutionError }
