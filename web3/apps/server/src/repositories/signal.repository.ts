import type Database from 'better-sqlite3';
import type { TradingSignal } from '../types/domain.js';

type SignalRow = {
  id: string;
  strategy_id?: string | null;
  strategy_version_id?: string | null;
  rule_id: string;
  exchange: TradingSignal['exchange'];
  symbol: string;
  market_price: string;
  market_event_time: string;
  source_type: TradingSignal['sourceType'];
  target_price: string;
  operator: TradingSignal['operator'];
  side: TradingSignal['side'];
  order_type: TradingSignal['orderType'];
  base_quantity?: string | null;
  quote_amount?: string | null;
  limit_price?: string | null;
  simulation_mode: number;
  status: TradingSignal['status'];
  dedupe_key?: string | null;
  expire_at?: string | null;
  rejected_reason?: string | null;
  reason: string;
  source_metadata_json?: string | null;
  created_at: string;
  converted_at?: string | null;
};

function mapSignal(row: SignalRow): TradingSignal {
  return {
    id: row.id,
    strategyId: row.strategy_id ?? undefined,
    strategyVersionId: row.strategy_version_id ?? undefined,
    ruleId: row.rule_id,
    exchange: row.exchange,
    symbol: row.symbol,
    marketPrice: row.market_price,
    marketEventTime: row.market_event_time,
    sourceType: row.source_type,
    targetPrice: row.target_price,
    operator: row.operator,
    side: row.side,
    orderType: row.order_type,
    baseQuantity: row.base_quantity ?? undefined,
    quoteAmount: row.quote_amount ?? undefined,
    limitPrice: row.limit_price ?? undefined,
    simulationMode: Boolean(row.simulation_mode),
    status: row.status,
    dedupeKey: row.dedupe_key ?? undefined,
    expireAt: row.expire_at ?? undefined,
    rejectedReason: row.rejected_reason ?? undefined,
    reason: row.reason,
    sourceMetadataJson: row.source_metadata_json ?? undefined,
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

  listByRuleId(ruleId: string, limit = 100): TradingSignal[] {
    return this.db
      .prepare('SELECT * FROM trading_signals WHERE rule_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(ruleId, limit)
      .map((row) => mapSignal(row as SignalRow));
  }

  findPendingByRuleId(ruleId: string): TradingSignal | undefined {
    const row = this.db
      .prepare("SELECT * FROM trading_signals WHERE rule_id = ? AND status IN ('pending','received','validated') ORDER BY created_at DESC LIMIT 1")
      .get(ruleId) as SignalRow | undefined;
    return row ? mapSignal(row) : undefined;
  }

  findByDedupeKey(dedupeKey: string): TradingSignal | undefined {
    const row = this.db
      .prepare('SELECT * FROM trading_signals WHERE dedupe_key = ? ORDER BY created_at DESC LIMIT 1')
      .get(dedupeKey) as SignalRow | undefined;
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
          id, strategy_id, strategy_version_id, rule_id, exchange, symbol, market_price, target_price, operator,
          market_event_time, source_type, side, order_type, base_quantity, quote_amount, limit_price, simulation_mode,
          status, dedupe_key, expire_at, rejected_reason, reason, source_metadata_json, created_at, converted_at
        ) VALUES (
          @id, @strategyId, @strategyVersionId, @ruleId, @exchange, @symbol, @marketPrice, @targetPrice, @operator,
          @marketEventTime, @sourceType, @side, @orderType, @baseQuantity, @quoteAmount, @limitPrice, @simulationMode,
          @status, @dedupeKey, @expireAt, @rejectedReason, @reason, @sourceMetadataJson, @createdAt, @convertedAt
        )`
      )
      .run({
        ...signal,
        strategyId: signal.strategyId ?? null,
        strategyVersionId: signal.strategyVersionId ?? null,
        baseQuantity: signal.baseQuantity ?? null,
        quoteAmount: signal.quoteAmount ?? null,
        limitPrice: signal.limitPrice ?? null,
        simulationMode: signal.simulationMode ? 1 : 0,
        dedupeKey: signal.dedupeKey ?? null,
        expireAt: signal.expireAt ?? null,
        rejectedReason: signal.rejectedReason ?? null,
        sourceMetadataJson: signal.sourceMetadataJson ?? null,
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

  markValidated(id: string): TradingSignal | undefined {
    this.db
      .prepare('UPDATE trading_signals SET status = ? WHERE id = ?')
      .run('validated', id);

    const row = this.db.prepare('SELECT * FROM trading_signals WHERE id = ?').get(id) as SignalRow | undefined;
    return row ? mapSignal(row) : undefined;
  }

  markRejected(id: string, rejectedReason?: string): TradingSignal | undefined {
    this.db
      .prepare('UPDATE trading_signals SET status = ?, rejected_reason = ? WHERE id = ?')
      .run('rejected', rejectedReason ?? null, id);

    const row = this.db.prepare('SELECT * FROM trading_signals WHERE id = ?').get(id) as SignalRow | undefined;
    return row ? mapSignal(row) : undefined;
  }

  /**
   * 按本地日期统计信号数量，与订单和成交统计日期口径保持一致。
   */
  listDailySignalCount(input: {
    fromDate: string
    toDate: string
    exchange?: string
    mode?: 'simulation' | 'real'
  }): Array<{ date: string; signalCount: number }> {
    const conditions = [
      `date(created_at, 'localtime') >= ?`,
      `date(created_at, 'localtime') <= ?`,
    ]
    const params: Array<string | number> = [input.fromDate, input.toDate]
    if (input.exchange) {
      conditions.push('exchange = ?')
      params.push(input.exchange)
    }
    if (input.mode !== undefined) {
      conditions.push('simulation_mode = ?')
      params.push(input.mode === 'simulation' ? 1 : 0)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    return (
      this.db
        .prepare(
          `SELECT
             date(created_at, 'localtime') AS date,
             COUNT(*) AS signal_count
           FROM trading_signals
           ${where}
           GROUP BY date(created_at, 'localtime')
           ORDER BY date DESC`,
        )
        .all(...params) as Array<{ date: string; signal_count: number }>
    ).map(row => ({ date: row.date, signalCount: row.signal_count }))
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM trading_signals WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
