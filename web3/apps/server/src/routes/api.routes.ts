import { nanoid } from 'nanoid'
import type { FastifyInstance } from 'fastify'
import type { ExchangeFactory } from '../exchange/exchange-factory.js'
import type { AuditLogService } from '../services/audit-log.service.js'
import type { MarketService } from '../services/market.service.js'
import type { OrderService } from '../services/order.service.js'
import { RuleValidationError, type TradingRuleService } from '../services/trading-rule.service.js'
import type { OrderRepository } from '../repositories/order.repository.js'
import type { RuleRepository } from '../repositories/rule.repository.js'
import type { TriggerRepository } from '../repositories/trigger.repository.js'
import { appConfig } from '../config/env.js'
import { createRuleSchema, updateRuleSchema, toggleRuleSchema, confirmOrderSchema, marketCandlesQuerySchema } from './dto.js'

const allowedCandleSymbols = new Set(['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT', 'OKB-USDT', 'BNB-USDT'])

export interface ApiRouteDeps {
  auditLogService: AuditLogService
  exchangeFactory: ExchangeFactory
  marketService: MarketService
  orderService: OrderService
  orderRepository: OrderRepository
  ruleRepository: RuleRepository
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

  app.get('/api/tickers', async () => deps.marketService.listLatestTickers())

  app.get('/api/market/overview', async () => {
    const cached = deps.marketService.listOverviewSnapshots()
    if (cached.length > 0) {
      return cached
    }

    return deps.marketService.refreshOverviewSnapshots('okx')
  })

  app.get('/api/market/candles', async (request, reply) => {
    const parsed = marketCandlesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ message: 'K 线查询参数不合法', issues: parsed.error.issues })
    }

    const symbol = parsed.data.symbol.trim().toUpperCase()
    const bar = parsed.data.bar

    if (!allowedCandleSymbols.has(symbol)) {
      return reply.status(400).send({ message: '暂不支持该交易对的 K 线查询' })
    }

    return deps.marketService.getRecentCandles('okx', symbol, bar)
  })

  app.get('/api/rules', async () => deps.ruleRepository.list())

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
    const params = request.params as { id: string }
    deps.ruleRepository.delete(params.id)
    return reply.status(204).send()
  })

  app.get('/api/triggers', async () => deps.triggerRepository.list())

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
