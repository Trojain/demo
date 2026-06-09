import type Database from 'better-sqlite3'
import type { TriggerEvent } from '../types/domain.js'

type TriggerRow = {
  id: string
  strategy_id?: string | null
  signal_id?: string | null
  rule_id: string
  exchange: TriggerEvent['exchange']
  symbol: string
  market_price: string
  target_price: string
  status: TriggerEvent['status']
  created_at: string
  confirmed_at?: string
}

function mapTrigger(row: TriggerRow): TriggerEvent {
  return {
    id: row.id,
    strategyId: row.strategy_id ?? undefined,
    signalId: row.signal_id ?? undefined,
    ruleId: row.rule_id,
    exchange: row.exchange,
    symbol: row.symbol,
    marketPrice: row.market_price,
    targetPrice: row.target_price,
    status: row.status,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  }
}

export class TriggerRepository {
  constructor(private readonly db: Database.Database) {}

  list(limit = 100): TriggerEvent[] {
    return this.db
      .prepare('SELECT * FROM trigger_events ORDER BY created_at DESC LIMIT ?')
      .all(limit)
      .map(row => mapTrigger(row as TriggerRow))
  }

  listByRuleId(ruleId: string, limit = 100): TriggerEvent[] {
    return this.db
      .prepare('SELECT * FROM trigger_events WHERE rule_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(ruleId, limit)
      .map(row => mapTrigger(row as TriggerRow))
  }

  countPending(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM trigger_events WHERE status = 'pending'").get() as { count: number }
    return row.count
  }

  findById(id: string): TriggerEvent | undefined {
    const row = this.db.prepare('SELECT * FROM trigger_events WHERE id = ?').get(id) as TriggerRow | undefined
    return row ? mapTrigger(row) : undefined
  }

  findPendingByRuleId(ruleId: string): TriggerEvent | undefined {
    const row = this.db.prepare('SELECT * FROM trigger_events WHERE rule_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1').get(ruleId, 'pending') as
      | TriggerRow
      | undefined
    return row ? mapTrigger(row) : undefined
  }

  create(event: TriggerEvent): TriggerEvent {
    this.db
      .prepare(
        `INSERT INTO trigger_events (
          id, strategy_id, signal_id, rule_id, exchange, symbol, market_price, target_price, status, created_at, confirmed_at
        ) VALUES (
          @id, @strategyId, @signalId, @ruleId, @exchange, @symbol, @marketPrice, @targetPrice, @status, @createdAt, @confirmedAt
        )`,
      )
      .run({
        ...event,
        strategyId: event.strategyId ?? null,
        signalId: event.signalId ?? null,
        confirmedAt: event.confirmedAt ?? null,
      })
    return event
  }

  markConfirmed(id: string): TriggerEvent | undefined {
    this.db.prepare('UPDATE trigger_events SET status = ?, confirmed_at = ? WHERE id = ?').run('confirmed', new Date().toISOString(), id)
    return this.findById(id)
  }

  markIgnored(id: string): TriggerEvent | undefined {
    this.db.prepare('UPDATE trigger_events SET status = ?, confirmed_at = ? WHERE id = ?').run('ignored', new Date().toISOString(), id)
    return this.findById(id)
  }

  markFailed(id: string): TriggerEvent | undefined {
    this.db.prepare('UPDATE trigger_events SET status = ?, confirmed_at = ? WHERE id = ?').run('failed', new Date().toISOString(), id)
    return this.findById(id)
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM trigger_events WHERE id = ?').run(id)
    return result.changes > 0
  }
}
