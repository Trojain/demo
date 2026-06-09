import type Database from 'better-sqlite3'
import type { MonitorRule, RuleRuntimeStatus } from '../types/domain.js'

type RuleRow = {
  id: string
  strategy_id?: string | null
  strategy_version_id?: string | null
  exchange: MonitorRule['exchange']
  symbol: string
  operator: MonitorRule['operator']
  target_price: string
  check_interval_ms: number
  side: MonitorRule['side']
  order_type: MonitorRule['orderType']
  base_quantity?: string
  quote_amount?: string
  limit_price?: string
  max_slippage_percent: string
  cooldown_ms: number
  max_trigger_count: number
  triggered_count: number
  simulation_mode: number
  enabled: number
  runtime_status: RuleRuntimeStatus
  last_error_message?: string
  last_checked_at?: string
  last_triggered_at?: string
  created_at: string
  updated_at: string
}

function mapRule(row: RuleRow): MonitorRule {
  return {
    id: row.id,
    strategyId: row.strategy_id ?? undefined,
    strategyVersionId: row.strategy_version_id ?? undefined,
    exchange: row.exchange,
    symbol: row.symbol,
    operator: row.operator,
    targetPrice: row.target_price,
    checkIntervalMs: row.check_interval_ms,
    side: row.side,
    orderType: row.order_type,
    baseQuantity: row.base_quantity,
    quoteAmount: row.quote_amount,
    limitPrice: row.limit_price,
    maxSlippagePercent: row.max_slippage_percent,
    cooldownMs: row.cooldown_ms,
    maxTriggerCount: row.max_trigger_count,
    triggeredCount: row.triggered_count,
    simulationMode: Boolean(row.simulation_mode),
    enabled: Boolean(row.enabled),
    runtimeStatus: row.runtime_status,
    lastErrorMessage: row.last_error_message,
    lastCheckedAt: row.last_checked_at,
    lastTriggeredAt: row.last_triggered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuleRepository {
  constructor(private readonly db: Database.Database) {}

  list(): MonitorRule[] {
    return this.db
      .prepare('SELECT * FROM monitor_rules ORDER BY created_at DESC')
      .all()
      .map(row => mapRule(row as RuleRow))
  }

  listEnabled(): MonitorRule[] {
    return this.db
      .prepare('SELECT * FROM monitor_rules WHERE enabled = 1 ORDER BY created_at DESC')
      .all()
      .map(row => mapRule(row as RuleRow))
  }

  countAll(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM monitor_rules').get() as { count: number }
    return row.count
  }

  countEnabled(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM monitor_rules WHERE enabled = 1').get() as { count: number }
    return row.count
  }

  findById(id: string): MonitorRule | undefined {
    const row = this.db.prepare('SELECT * FROM monitor_rules WHERE id = ?').get(id) as RuleRow | undefined
    return row ? mapRule(row) : undefined
  }

  create(rule: MonitorRule): MonitorRule {
    this.db
      .prepare(
        `INSERT INTO monitor_rules (
          id, strategy_id, strategy_version_id, exchange, symbol, operator, target_price, check_interval_ms, side, order_type,
          base_quantity, quote_amount, limit_price, max_slippage_percent, cooldown_ms,
          max_trigger_count, triggered_count, simulation_mode, enabled, runtime_status,
          last_error_message, last_checked_at, last_triggered_at, created_at, updated_at
        ) VALUES (
          @id, @strategyId, @strategyVersionId, @exchange, @symbol, @operator, @targetPrice, @checkIntervalMs, @side, @orderType,
          @baseQuantity, @quoteAmount, @limitPrice, @maxSlippagePercent, @cooldownMs,
          @maxTriggerCount, @triggeredCount, @simulationMode, @enabled, @runtimeStatus,
          @lastErrorMessage, @lastCheckedAt, @lastTriggeredAt, @createdAt, @updatedAt
        )`,
      )
      .run({
        ...rule,
        strategyId: rule.strategyId ?? null,
        strategyVersionId: rule.strategyVersionId ?? null,
        baseQuantity: rule.baseQuantity ?? null,
        quoteAmount: rule.quoteAmount ?? null,
        limitPrice: rule.limitPrice ?? null,
        simulationMode: rule.simulationMode ? 1 : 0,
        enabled: rule.enabled ? 1 : 0,
        runtimeStatus: rule.runtimeStatus,
        lastErrorMessage: rule.lastErrorMessage ?? null,
        lastCheckedAt: rule.lastCheckedAt ?? null,
        lastTriggeredAt: rule.lastTriggeredAt ?? null,
      })

    return rule
  }

  update(rule: MonitorRule): MonitorRule | undefined {
    this.db
      .prepare(
        `UPDATE monitor_rules
         SET exchange = @exchange,
             strategy_id = @strategyId,
             strategy_version_id = @strategyVersionId,
             symbol = @symbol,
             operator = @operator,
             target_price = @targetPrice,
             check_interval_ms = @checkIntervalMs,
             side = @side,
             order_type = @orderType,
             base_quantity = @baseQuantity,
             quote_amount = @quoteAmount,
             limit_price = @limitPrice,
             max_slippage_percent = @maxSlippagePercent,
             cooldown_ms = @cooldownMs,
             max_trigger_count = @maxTriggerCount,
             simulation_mode = @simulationMode,
             enabled = @enabled,
             runtime_status = @runtimeStatus,
             last_error_message = @lastErrorMessage,
             updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run({
        ...rule,
        strategyId: rule.strategyId ?? null,
        strategyVersionId: rule.strategyVersionId ?? null,
        baseQuantity: rule.baseQuantity ?? null,
        quoteAmount: rule.quoteAmount ?? null,
        limitPrice: rule.limitPrice ?? null,
        simulationMode: rule.simulationMode ? 1 : 0,
        enabled: rule.enabled ? 1 : 0,
        runtimeStatus: rule.enabled ? 'idle' : 'paused',
        lastErrorMessage: null,
        updatedAt: new Date().toISOString(),
      })

    return this.findById(rule.id)
  }

  updateRuntimeState(
    id: string,
    updates: {
      lastCheckedAt?: string
      lastTriggeredAt?: string
      triggeredCount?: number
      runtimeStatus?: RuleRuntimeStatus
      lastErrorMessage?: string | null
    },
  ) {
    const current = this.findById(id)
    if (!current) {
      return
    }

    this.db
      .prepare(
        `UPDATE monitor_rules
         SET last_checked_at = @lastCheckedAt,
             last_triggered_at = @lastTriggeredAt,
             triggered_count = @triggeredCount,
             runtime_status = @runtimeStatus,
             last_error_message = @lastErrorMessage,
             updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run({
        id,
        lastCheckedAt: updates.lastCheckedAt ?? current.lastCheckedAt ?? null,
        lastTriggeredAt: updates.lastTriggeredAt ?? current.lastTriggeredAt ?? null,
        triggeredCount: updates.triggeredCount ?? current.triggeredCount,
        runtimeStatus: updates.runtimeStatus ?? current.runtimeStatus,
        lastErrorMessage: updates.lastErrorMessage === undefined ? (current.lastErrorMessage ?? null) : updates.lastErrorMessage,
        updatedAt: new Date().toISOString(),
      })
  }

  setEnabled(id: string, enabled: boolean): MonitorRule | undefined {
    this.db
      .prepare('UPDATE monitor_rules SET enabled = ?, runtime_status = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, enabled ? 'idle' : 'paused', new Date().toISOString(), id)
    return this.findById(id)
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM monitor_rules WHERE id = ?').run(id)
  }

  runInTransaction<T>(callback: () => T): T {
    return this.db.transaction(callback)()
  }
}
