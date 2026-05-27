import { nanoid } from 'nanoid'
import type { FastifyInstance } from 'fastify'
import type { ExchangeFactory } from '../exchange/exchange-factory.js'
import type { AuditLogService } from '../services/audit-log.service.js'
import type { MarketService } from '../services/market.service.js'
import type { OrderPreviewService } from '../services/order-preview.service.js'
import type { OrderService } from '../services/order.service.js'
import type { RiskConfigService } from '../services/risk-config.service.js'
import type { SignalService } from '../services/signal.service.js'
import { RuleValidationError, type TradingRuleService } from '../services/trading-rule.service.js'
import type { OrderRepository } from '../repositories/order.repository.js'
import type { AuditLogRepository } from '../repositories/audit-log.repository.js'
import type { RiskCheckRepository } from '../repositories/risk-check.repository.js'
import type { RuleRepository } from '../repositories/rule.repository.js'
import type { SignalRepository } from '../repositories/signal.repository.js'
import type { TriggerRepository } from '../repositories/trigger.repository.js'
import { appConfig } from '../config/env.js'
import {
  createRuleSchema,
  updateRuleSchema,
  toggleRuleSchema,
  confirmOrderSchema,
  marketCandlesQuerySchema,
  listSignalsQuerySchema,
  previewOrderSchema,
  listRiskChecksQuerySchema,
  updateRiskConfigSchema,
  idParamSchema
} from './dto.js'
import { OVERVIEW_SYMBOLS_BY_EXCHANGE } from '../services/market.service.js'

export interface ApiRouteDeps {
  auditLogRepository: AuditLogRepository
  auditLogService: AuditLogService
  exchangeFactory: ExchangeFactory
  marketService: MarketService
  orderPreviewService: OrderPreviewService
  orderService: OrderService
  orderRepository: OrderRepository
  riskCheckRepository: RiskCheckRepository
  riskConfigService: RiskConfigService
  ruleRepository: RuleRepository
  signalRepository: SignalRepository
  signalService: SignalService
  tradingRuleService: TradingRuleService
  triggerRepository: TriggerRepository
}

export async function registerApiRoutes(app: FastifyInstance, deps: ApiRouteDeps) {
  app.get('/api/health', async () => ({
    status: 'ok',
    time: new Date().toISOString(),
    realTradingEnabled: appConfig.enableRealTrading,
  }))

  app.get('/api/exchanges', async () => deps.exchangeFactory.listExchanges())

  app.get('/api/trading-rules', async (request, reply) => {
    const query = request.query as { exchange?: string; symbol?: string }
    const exchange = query.exchange === 'binance' ? 'binance' : 'okx'

    try {
      const rules = await deps.tradingRuleService.listInstrumentRules(exchange)
      const symbol = query.symbol?.trim().toUpperCase()
      return symbol ? rules.filter(rule => rule.symbol === symbol) : rules
    } catch (error) {
      if (error instanceof RuleValidationError) {
        return reply.status(400).send({ message: error.message, issues: error.issues })
      }

      throw error
    }
  })

  app.get('/api/audit-logs', async request => {
    const query = request.query as { limit?: string }
    const requestedLimit = Number(query.limit ?? 100)
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100
    return deps.auditLogService.list(limit)
  })

  app.delete('/api/audit-logs/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ message: '审计日志 ID 不合法', issues: parsed.error.issues })
    }

    const deleted = deps.auditLogRepository.delete(parsed.data.id)
    return deleted ? reply.status(204).send() : reply.status(404).send({ message: '审计日志不存在' })
  })

  app.get('/api/tickers', async () => deps.marketService.listLatestTickers())

  app.get('/api/market/overview', async request => {
    const query = request.query as { exchange?: string }
    const exchange = query.exchange === 'binance' ? 'binance' : 'okx'
    const cached = deps.marketService.listOverviewSnapshots().filter(snapshot => snapshot.exchange === exchange)
    if (cached.length > 0) {
      return cached
    }

    return deps.marketService.refreshOverviewSnapshots(exchange)
  })

  app.get('/api/market/health', async request => {
    const query = request.query as { exchange?: string }
    const exchange = query.exchange === 'binance' ? 'binance' : 'okx'
    return deps.marketService.getHealth(exchange)
  })

  app.get('/api/market/candles', async (request, reply) => {
    const parsed = marketCandlesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ message: 'K 线查询参数不合法', issues: parsed.error.issues })
    }

    const symbol = parsed.data.symbol.trim().toUpperCase()
    const bar = parsed.data.bar
    const exchange = parsed.data.exchange

    if (!OVERVIEW_SYMBOLS_BY_EXCHANGE[exchange].includes(symbol)) {
      return reply.status(400).send({ message: '暂不支持该交易对的 K 线查询' })
    }

    return deps.marketService.getRecentCandles(exchange, symbol, bar)
  })

  app.get('/api/rules', async () => deps.ruleRepository.list())

  app.get('/api/signals', async (request, reply) => {
    const parsed = listSignalsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ message: '交易信号查询参数不合法', issues: parsed.error.issues })
    }

    return deps.signalService.list(parsed.data.limit)
  })

  app.delete('/api/signals/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ message: '交易信号 ID 不合法', issues: parsed.error.issues })
    }

    const deleted = deps.signalRepository.delete(parsed.data.id)
    return deleted ? reply.status(204).send() : reply.status(404).send({ message: '交易信号不存在' })
  })

  app.get('/api/risk-checks', async (request, reply) => {
    const parsed = listRiskChecksQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ message: '风控检查查询参数不合法', issues: parsed.error.issues })
    }

    return deps.riskCheckRepository.list(parsed.data.limit)
  })

  app.delete('/api/risk-checks/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ message: '风控检查 ID 不合法', issues: parsed.error.issues })
    }

    const deleted = deps.riskCheckRepository.delete(parsed.data.id)
    return deleted ? reply.status(204).send() : reply.status(404).send({ message: '风控检查不存在' })
  })

  app.get('/api/risk-config', async () => deps.riskConfigService.getConfig())

  app.put('/api/risk-config', async (request, reply) => {
    const parsed = updateRiskConfigSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ message: '风控配置参数不合法', issues: parsed.error.issues })
    }

    return deps.riskConfigService.update(parsed.data)
  })

  app.post('/api/rules', async (request, reply) => {
    const parsed = createRuleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ message: '监控规则参数不合法', issues: parsed.error.issues })
    }

    try {
      await deps.tradingRuleService.validateMonitorRule(parsed.data)
    } catch (error) {
      if (error instanceof RuleValidationError) {
        return reply.status(400).send({ message: error.message, issues: error.issues })
      }

      throw error
    }

    const now = new Date().toISOString()
    const rule = deps.ruleRepository.create({
      id: nanoid(),
      exchange: parsed.data.exchange,
      symbol: parsed.data.symbol.trim().toUpperCase(),
      operator: parsed.data.operator,
      targetPrice: parsed.data.targetPrice,
      checkIntervalMs: parsed.data.checkIntervalMs,
      side: parsed.data.side,
      orderType: parsed.data.orderType,
      baseQuantity: parsed.data.baseQuantity,
      quoteAmount: parsed.data.quoteAmount,
      limitPrice: parsed.data.limitPrice,
      maxSlippagePercent: parsed.data.maxSlippagePercent,
      cooldownMs: parsed.data.cooldownMs,
      maxTriggerCount: parsed.data.maxTriggerCount,
      triggeredCount: 0,
      simulationMode: parsed.data.simulationMode,
      enabled: parsed.data.enabled,
      runtimeStatus: parsed.data.enabled ? 'idle' : 'paused',
      createdAt: now,
      updatedAt: now,
    })

    return reply.status(201).send(rule)
  })

  app.put('/api/rules/:id', async (request, reply) => {
    const params = request.params as { id: string }
    const current = deps.ruleRepository.findById(params.id)
    if (!current) {
      return reply.status(404).send({ message: '监控规则不存在' })
    }

    const parsed = updateRuleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ message: '监控规则参数不合法', issues: parsed.error.issues })
    }

    try {
      await deps.tradingRuleService.validateMonitorRule(parsed.data)
    } catch (error) {
      if (error instanceof RuleValidationError) {
        return reply.status(400).send({ message: error.message, issues: error.issues })
      }

      throw error
    }

    const rule = deps.ruleRepository.update({
      ...current,
      exchange: parsed.data.exchange,
      symbol: parsed.data.symbol.trim().toUpperCase(),
      operator: parsed.data.operator,
      targetPrice: parsed.data.targetPrice,
      checkIntervalMs: parsed.data.checkIntervalMs,
      side: parsed.data.side,
      orderType: parsed.data.orderType,
      baseQuantity: parsed.data.baseQuantity,
      quoteAmount: parsed.data.quoteAmount,
      limitPrice: parsed.data.limitPrice,
      maxSlippagePercent: parsed.data.maxSlippagePercent,
      cooldownMs: parsed.data.cooldownMs,
      maxTriggerCount: parsed.data.maxTriggerCount,
      simulationMode: parsed.data.simulationMode,
      enabled: parsed.data.enabled,
    })

    return rule
  })

  app.patch('/api/rules/:id/toggle', async (request, reply) => {
    const params = request.params as { id: string }
    const parsed = toggleRuleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ message: '规则启停参数不合法', issues: parsed.error.issues })
    }

    const rule = deps.ruleRepository.setEnabled(params.id, parsed.data.enabled)
    if (!rule) {
      return reply.status(404).send({ message: '监控规则不存在' })
    }

    return rule
  })

  app.delete('/api/rules/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ message: '监控规则 ID 不合法', issues: parsed.error.issues })
    }

    deps.ruleRepository.delete(parsed.data.id)
    return reply.status(204).send()
  })

  app.get('/api/triggers', async () => deps.triggerRepository.list())

  app.delete('/api/triggers/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ message: '触发事件 ID 不合法', issues: parsed.error.issues })
    }

    const deleted = deps.triggerRepository.delete(parsed.data.id)
    return deleted ? reply.status(204).send() : reply.status(404).send({ message: '触发事件不存在' })
  })

  app.patch('/api/triggers/:id/ignore', async (request, reply) => {
    const params = request.params as { id: string }
    const trigger = deps.triggerRepository.findById(params.id)
    if (!trigger) {
      return reply.status(404).send({ message: '触发事件不存在' })
    }

    if (trigger.status !== 'pending') {
      return reply.status(400).send({ message: '触发事件已经处理，不能重复忽略' })
    }

    const ignoredTrigger = deps.triggerRepository.markIgnored(params.id)
    deps.auditLogService.record({
      action: 'trigger.ignored',
      entityType: 'trigger',
      entityId: params.id,
      ruleId: trigger.ruleId,
      triggerId: params.id,
      message: `已忽略 ${trigger.symbol} 触发事件`,
      payload: {
        exchange: trigger.exchange,
        symbol: trigger.symbol,
        marketPrice: trigger.marketPrice,
        targetPrice: trigger.targetPrice,
      },
    })

    return ignoredTrigger
  })

  app.get('/api/orders', async () => deps.orderRepository.list())

  app.delete('/api/orders/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ message: '订单记录 ID 不合法', issues: parsed.error.issues })
    }

    const deleted = deps.orderRepository.delete(parsed.data.id)
    return deleted ? reply.status(204).send() : reply.status(404).send({ message: '订单记录不存在' })
  })

  app.post('/api/orders/preview', async (request, reply) => {
    const parsed = previewOrderSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ message: '下单预览参数不合法', issues: parsed.error.issues })
    }

    try {
      return await deps.orderPreviewService.preview(parsed.data.triggerId)
    } catch (error) {
      return reply.status(400).send({
        message: error instanceof Error ? error.message : '下单预览失败',
      })
    }
  })

  app.post('/api/orders/confirm', async (request, reply) => {
    const parsed = confirmOrderSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ message: '确认下单参数不合法', issues: parsed.error.issues })
    }

    try {
      const order = await deps.orderService.confirmTrigger(parsed.data.triggerId)
      return reply.status(201).send(order)
    } catch (error) {
      deps.auditLogService.record({
        level: 'error',
        action: 'order.failed',
        entityType: 'trigger',
        entityId: parsed.data.triggerId,
        triggerId: parsed.data.triggerId,
        message: error instanceof Error ? error.message : '确认下单失败',
        payload: {
          triggerId: parsed.data.triggerId,
        },
      })
      return reply.status(400).send({
        message: error instanceof Error ? error.message : '确认下单失败',
      })
    }
  })
}
