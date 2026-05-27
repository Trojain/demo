import type Database from 'better-sqlite3';
import type { RiskCheck } from '../types/domain.js';

type RiskCheckRow = {
  id: string;
  signal_id: string;
  rule_id: string;
  exchange: RiskCheck['exchange'];
  symbol: string;
  status: RiskCheck['status'];
  reason: string;
  quote_exposure: string;
  market_price: string;
  items_json: string;
  created_at: string;
};

function mapRiskCheck(row: RiskCheckRow): RiskCheck {
  return {
    id: row.id,
    signalId: row.signal_id,
    ruleId: row.rule_id,
    exchange: row.exchange,
    symbol: row.symbol,
    status: row.status,
    reason: row.reason,
    quoteExposure: row.quote_exposure,
    marketPrice: row.market_price,
    itemsJson: row.items_json,
    createdAt: row.created_at
  };
}

export class RiskCheckRepository {
  constructor(private readonly db: Database.Database) {}

  create(check: RiskCheck): RiskCheck {
    this.db
      .prepare(
        `INSERT INTO risk_checks (
          id, signal_id, rule_id, exchange, symbol, status, reason,
          quote_exposure, market_price, items_json, created_at
        ) VALUES (
          @id, @signalId, @ruleId, @exchange, @symbol, @status, @reason,
          @quoteExposure, @marketPrice, @itemsJson, @createdAt
        )`
      )
      .run(check);

    return check;
  }

  list(limit = 100): RiskCheck[] {
    return this.db
      .prepare('SELECT * FROM risk_checks ORDER BY created_at DESC LIMIT ?')
      .all(limit)
      .map((row) => mapRiskCheck(row as RiskCheckRow));
  }

  getPassedStatsSince(since: string): { count: number; quoteAmount: string } {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(CAST(quote_exposure AS REAL)), 0) AS quote_amount
         FROM risk_checks
         WHERE status = ? AND created_at >= ?`
      )
      .get('passed', since) as { count: number; quote_amount: number };

    return {
      count: row.count,
      quoteAmount: String(row.quote_amount),
    };
  }
}
