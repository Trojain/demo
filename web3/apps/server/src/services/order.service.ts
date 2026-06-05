import type { RuleRepository } from '../repositories/rule.repository.js'
import type { TriggerRepository } from '../repositories/trigger.repository.js'
import type { OrderPreview, OrderPreviewCheckItem, OrderRecord } from '../types/domain.js'
import { resolveTradingEnvironmentLabel } from '../utils/trading-environment.js'
import type { AuditLogService } from './audit-log.service.js'
import type { OrderPreviewService } from './order-preview.service.js'
import type { OrderRecoveryService } from './order-recovery.service.js'
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
    private readonly orderRecoveryService: OrderRecoveryService,
  ) {}

  async confirmTrigger(
    triggerId: string,
    options: {
      /** 执行来源，manual 表示人工触发，auto 表示策略命中后自动执行 */
      executionMode?: 'manual' | 'auto'
    } = {},
  ): Promise<OrderRecord> {
    const executionMode = options.executionMode ?? 'manual'
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

    if (executionMode === 'auto' && !rule.simulationMode) {
      // 真实策略计划在 v0.4.11 阶段仍要求人工确认，这里保留兜底保护，避免其他调用方绕过限制。
      throw new Error('真实策略计划当前仅支持人工确认执行')
    }

    try {
      const finalPreview = await this.validateBeforeSubmit(triggerId)
      const order = await this.tradeExecutionService.confirmRuleTrigger({
        triggerId,
        rule,
      })
      try {
        this.finalizeConfirmedTrigger({
          triggerId,
          rule,
          trigger,
          order,
          executionMode,
          previewedAt: finalPreview.previewedAt,
        })
      } catch (finalizeError) {
        // 订单已经存在时，不再把本次请求整体判定为失败，统一登记恢复任务补齐触发状态和审计收尾。
        try {
          this.registerRuleTriggerFinalizeRecovery({
            triggerId,
            rule,
            trigger,
            order,
            executionMode,
            previewedAt: finalPreview.previewedAt,
            error: finalizeError,
          })
        } catch {
          // 恢复任务登记失败时保留订单结果，后续由日志和人工排查介入。
        }
      }
      return order
    } catch (error) {
      this.handleTriggerFailure({
        trigger,
        rule,
        error,
        executionMode,
      })
      throw error
    }
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

  private handleTriggerFailure(input: {
    trigger: { id: string; marketPrice: string; targetPrice: string }
    rule: { id: string; exchange: string; symbol: string; side: string; orderType: string }
    error: unknown
    executionMode: 'manual' | 'auto'
  }) {
    const failedTrigger = this.triggerRepository.markFailed(input.trigger.id)
    const preview =
      input.error instanceof FinalOrderValidationError
        ? input.error.preview
        : input.error instanceof TradeExecutionError
          ? input.error.preview
          : undefined
    const previewFailedItems =
      preview && 'checkItems' in preview
        ? preview.checkItems.filter(item => !item.passed)
        : preview?.accountItems?.filter(item => !item.passed) ?? []
    const failedItems =
      input.error instanceof FinalOrderValidationError
        ? input.error.failedItems
        : previewFailedItems
    const message = input.error instanceof Error ? input.error.message : '确认下单失败'
    const tradeExecutionError = input.error instanceof TradeExecutionError ? input.error : undefined

    this.auditLogService.record({
      level: 'warning',
      action: 'trigger.failed',
      entityType: 'trigger',
      entityId: input.trigger.id,
      ruleId: input.rule.id,
      triggerId: input.trigger.id,
      message: input.executionMode === 'auto' ? `${input.rule.symbol} 自动执行失败：${message}` : `${input.rule.symbol} 确认执行失败：${message}`,
        payload: {
          exchange: input.rule.exchange,
          tradingEnvironment: this.resolveTradingEnvironmentLabel(input.rule.exchange),
          symbol: input.rule.symbol,
          side: input.rule.side,
          orderType: input.rule.orderType,
          triggerStatus: failedTrigger?.status ?? 'failed',
        marketPrice: input.trigger.marketPrice,
        targetPrice: input.trigger.targetPrice,
        executionMode: input.executionMode,
        failedItems,
        errorCode: tradeExecutionError?.errorCode,
        errorCategory: tradeExecutionError?.errorCategory,
      },
    })
    this.auditLogService.record({
      level: 'warning',
      action: 'order.failed',
      entityType: 'trigger',
      entityId: input.trigger.id,
      ruleId: input.rule.id,
      triggerId: input.trigger.id,
      message,
      payload: {
        source: 'rule',
        mode: preview && 'mode' in preview ? preview.mode : undefined,
        exchange: input.rule.exchange,
        tradingEnvironment: this.resolveTradingEnvironmentLabel(input.rule.exchange),
        symbol: input.rule.symbol,
        executionMode: input.executionMode,
        errorCode: tradeExecutionError?.errorCode,
        errorCategory: tradeExecutionError?.errorCategory,
        errorMessage: tradeExecutionError?.message,
        rawMessage: tradeExecutionError?.rawMessage,
        preview,
        failedItems,
      },
    })
  }

  /**
   * 规则确认成功后的收尾逻辑独立封装。
   * 这样一旦触发状态更新或审计补充失败，可以单独进入恢复模型，而不会误判为整笔交易失败。
   */
  private finalizeConfirmedTrigger(input: {
    triggerId: string
    rule: { id: string; exchange: string; symbol: string; side: string; orderType: string }
    trigger: { marketPrice: string; targetPrice: string }
    order: OrderRecord
    executionMode: 'manual' | 'auto'
    previewedAt: string
  }) {
    this.triggerRepository.markConfirmed(input.triggerId)
    this.auditLogService.record({
      action: 'trigger.confirmed',
      entityType: 'trigger',
      entityId: input.triggerId,
      ruleId: input.rule.id,
      triggerId: input.triggerId,
      orderId: input.order.id,
      message: input.executionMode === 'auto' ? `${input.rule.symbol} 触发后已自动执行` : `已确认 ${input.rule.symbol} 触发事件`,
      payload: {
        exchange: input.rule.exchange,
        tradingEnvironment: this.resolveTradingEnvironmentLabel(input.rule.exchange),
        symbol: input.rule.symbol,
        marketPrice: input.trigger.marketPrice,
        targetPrice: input.trigger.targetPrice,
        executionMode: input.executionMode,
        previewedAt: input.previewedAt,
      },
    })
    this.auditLogService.record({
      action: 'order.submitted',
      entityType: 'order',
      entityId: input.order.id,
      ruleId: input.rule.id,
      triggerId: input.triggerId,
      orderId: input.order.id,
      message: input.executionMode === 'auto' ? `${input.rule.symbol} 自动下单已提交` : `${input.rule.symbol} 订单已提交`,
      payload: {
        source: 'rule',
        exchange: input.rule.exchange,
        tradingEnvironment: this.resolveTradingEnvironmentLabel(input.rule.exchange),
        side: input.rule.side,
        orderType: input.rule.orderType,
        simulationMode: input.order.simulationMode,
        exchangeOrderId: input.order.exchangeOrderId,
        executionMode: input.executionMode,
      },
    })
  }

  /**
   * 规则确认成功后，如果触发状态更新或审计补充失败，登记收尾恢复任务。
   * 当前优先保证已存在的订单不被重复执行，再通过恢复任务补齐触发状态和审计记录。
   */
  private registerRuleTriggerFinalizeRecovery(input: {
    triggerId: string
    rule: { id: string; exchange: string; symbol: string; side: string; orderType: string }
    trigger: { marketPrice: string; targetPrice: string }
    order: OrderRecord
    executionMode: 'manual' | 'auto'
    previewedAt: string
    error: unknown
  }) {
    this.orderRecoveryService.createOrRefresh({
      identityKey: `rule_trigger_finalize:${input.order.exchange}:${input.order.exchangeOrderId}`,
      orderId: input.order.id,
      exchangeOrderId: input.order.exchangeOrderId,
      exchange: input.order.exchange,
      source: 'rule',
      mode: input.order.simulationMode ? 'simulation' : 'real',
      symbol: input.order.symbol,
      failureStage: 'rule_trigger_finalize',
      lastErrorCode: 'rule_finalize_failed',
      lastErrorMessage: input.error instanceof Error ? input.error.message : '规则确认收尾失败',
      payload: {
        triggerId: input.triggerId,
        ruleId: input.rule.id,
        orderId: input.order.id,
        executionMode: input.executionMode,
        marketPrice: input.trigger.marketPrice,
        targetPrice: input.trigger.targetPrice,
        previewedAt: input.previewedAt,
      },
    })
  }

  private resolveTradingEnvironmentLabel(exchange: string) {
    return resolveTradingEnvironmentLabel(exchange === 'binance' ? 'binance' : 'okx')
  }
}

export { TradeExecutionError }
