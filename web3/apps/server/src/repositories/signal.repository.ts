import type Database from 'better-sqlite3';
import type { TradingSignal } from '../types/domain.js';

type SignalRow = {
  id: string;
  rule_id: string;
  exchange: TradingSignal['exchange'];
  symbol: string;
  market_price: string;
  market_event_time: string;
  target_price: string;
  operator: TradingSignal['operator'];
  side: TradingSignal['side'];
  order_type: TradingSignal['orderType'];
  base_quantity?: string | null;
  quote_amount?: string | null;
  limit_price?: string | null;
  simulation_mode: number;
  status: TradingSignal['status'];
  reason: string;
  created_at: string;
  converted_at?: string | null;
};

function mapSignal(row: SignalRow): TradingSignal {
  return {
    id: row.id,
    ruleId: row.rule_id,
    exchange: row.exchange,
    symbol: row.symbol,
    marketPrice: row.market_price,
    marketEventTime: row.market_event_time,
    targetPrice: row.target_price,
    operator: row.operator,
    side: row.side,
    orderType: row.order_type,
    baseQuantity: row.base_quantity ?? undefined,
    quoteAmount: row.quote_amount ?? undefined,
    limitPrice: row.limit_price ?? undefined,
    simulationMode: Boolean(row.simulation_mode),
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    convertedAt: row.converted_at ?? undefined
  };
}

export class SignalRepository {
  constructor(private readonly db: Database.Database) {}

  list(limit = 100): TradingSignal[] {
    return this.db
      .prepare('SELECT * FROM trading_signals ORDER BY created_at DESC LIMIT ?')
      .all(limit)
      .map((row) => mapSignal(row as SignalRow));
  }

  findPendingByRuleId(ruleId: string): TradingSignal | undefined {
    const row = this.db
      .prepare('SELECT * FROM trading_signals WHERE rule_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1')
      .get(ruleId, 'pending') as SignalRow | undefined;
    return row ? mapSignal(row) : undefined;
  }

  findLatestByRuleId(ruleId: string): TradingSignal | undefined {
    const row = this.db
      .prepare('SELECT * FROM trading_signals WHERE rule_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(ruleId) as SignalRow | undefined;
    return row ? mapSignal(row) : undefined;
  }

  create(signal: TradingSignal): TradingSignal {
    this.db
      .prepare(
        `INSERT INTO trading_signals (
          id, rule_id, exchange, symbol, market_price, target_price, operator,
          market_event_time, side, order_type, base_quantity, quote_amount, limit_price, simulation_mode,
          status, reason, created_at, converted_at
        ) VALUES (
          @id, @ruleId, @exchange, @symbol, @marketPrice, @targetPrice, @operator,
          @marketEventTime, @side, @orderType, @baseQuantity, @quoteAmount, @limitPrice, @simulationMode,
          @status, @reason, @createdAt, @convertedAt
        )`
      )
      .run({
        ...signal,
        baseQuantity: signal.baseQuantity ?? null,
        quoteAmount: signal.quoteAmount ?? null,
        limitPrice: signal.limitPrice ?? null,
        simulationMode: signal.simulationMode ? 1 : 0,
        convertedAt: signal.convertedAt ?? null
      });

    return signal;
  }

  markConverted(id: string): TradingSignal | undefined {
    this.db
      .prepare('UPDATE trading_signals SET status = ?, converted_at = ? WHERE id = ?')
      .run('converted', new Date().toISOString(), id);

    const row = this.db.prepare('SELECT * FROM trading_signals WHERE id = ?').get(id) as SignalRow | undefined;
    return row ? mapSignal(row) : undefined;
  }

  markRejected(id: string): TradingSignal | undefined {
    this.db
      .prepare('UPDATE trading_signals SET status = ? WHERE id = ?')
      .run('rejected', id);

    const row = this.db.prepare('SELECT * FROM trading_signals WHERE id = ?').get(id) as SignalRow | undefined;
    return row ? mapSignal(row) : undefined;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM trading_signals WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
