import type Database from 'better-sqlite3';
import type { DailyRiskStats, RiskCheck } from '../types/domain.js';

type RiskCheckRow = {
  id: string;
  signal_id: string;
  strategy_id?: string | null;
  strategy_version_id?: string | null;
  rule_id: string;
  exchange: RiskCheck['exchange'];
  symbol: string;
  status: RiskCheck['status'];
  reason: string;
  quote_exposure: string;
  market_price: string;
  items_json: string;
  stat_date: string;
  created_at: string;
};

function mapRiskCheck(row: RiskCheckRow): RiskCheck {
  return {
    id: row.id,
    signalId: row.signal_id,
    strategyId: row.strategy_id ?? undefined,
    strategyVersionId: row.strategy_version_id ?? undefined,
    ruleId: row.rule_id,
    exchange: row.exchange,
    symbol: row.symbol,
    status: row.status,
    reason: row.reason,
    quoteExposure: row.quote_exposure,
    marketPrice: row.market_price,
    itemsJson: row.items_json,
    statDate: row.stat_date,
    createdAt: row.created_at
  };
}

export class RiskCheckRepository {
  constructor(private readonly db: Database.Database) {}

  create(check: RiskCheck): RiskCheck {
    this.db
      .prepare(
        `INSERT INTO risk_checks (
          id, signal_id, strategy_id, strategy_version_id, rule_id, exchange, symbol, status, reason,
          quote_exposure, market_price, items_json, stat_date, created_at
        ) VALUES (
          @id, @signalId, @strategyId, @strategyVersionId, @ruleId, @exchange, @symbol, @status, @reason,
          @quoteExposure, @marketPrice, @itemsJson, @statDate, @createdAt
        )`
      )
      .run({
        ...check,
        strategyId: check.strategyId ?? null,
        strategyVersionId: check.strategyVersionId ?? null,
      });

    return check;
  }

  list(limit = 100): RiskCheck[] {
    return this.db
      .prepare('SELECT * FROM risk_checks ORDER BY created_at DESC LIMIT ?')
      .all(limit)
      .map((row) => mapRiskCheck(row as RiskCheckRow));
  }

  listByRuleId(ruleId: string, limit = 100): RiskCheck[] {
    return this.db
      .prepare('SELECT * FROM risk_checks WHERE rule_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(ruleId, limit)
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

  getPassedStatsByDate(statDate: string): { count: number; quoteAmount: string } {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(CAST(quote_exposure AS REAL)), 0) AS quote_amount
         FROM risk_checks
         WHERE status = ? AND stat_date = ?`
      )
      .get('passed', statDate) as { count: number; quote_amount: number };

    return {
      count: row.count,
      quoteAmount: String(row.quote_amount),
    };
  }

  listDailyStats(input: {
    fromDate: string
    toDate: string
    exchange?: string
    mode?: 'simulation' | 'real'
  }): DailyRiskStats[] {
    const conditions = [
      `r.stat_date >= ?`,
      `r.stat_date <= ?`,
    ]
    const params: Array<string | number> = [input.fromDate, input.toDate]

    if (input.exchange) {
      conditions.push('r.exchange = ?')
      params.push(input.exchange)
    }

    if (input.mode !== undefined) {
      conditions.push('s.simulation_mode = ?')
      params.push(input.mode === 'simulation' ? 1 : 0)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    return this.db
      .prepare(
        `SELECT
           r.stat_date,
           SUM(CASE WHEN r.status = 'passed' THEN 1 ELSE 0 END) AS passed_count,
           COALESCE(SUM(CASE WHEN r.status = 'passed' THEN CAST(r.quote_exposure AS REAL) ELSE 0 END), 0) AS passed_quote_amount,
           SUM(CASE WHEN r.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
           COALESCE(SUM(CASE WHEN r.status = 'rejected' THEN CAST(r.quote_exposure AS REAL) ELSE 0 END), 0) AS rejected_quote_amount,
           COUNT(*) AS total_count,
           COALESCE(SUM(CAST(r.quote_exposure AS REAL)), 0) AS total_quote_amount
         FROM risk_checks r
         LEFT JOIN trading_signals s ON r.signal_id = s.id
         ${where}
         GROUP BY r.stat_date
         ORDER BY r.stat_date DESC`
      )
      .all(...params)
      .map((row) => {
        const statsRow = row as {
          stat_date: string;
          passed_count: number;
          passed_quote_amount: number;
          rejected_count: number;
          rejected_quote_amount: number;
          total_count: number;
          total_quote_amount: number;
        };
        return {
          statDate: statsRow.stat_date,
          passedCount: statsRow.passed_count,
          passedQuoteAmount: String(statsRow.passed_quote_amount),
          rejectedCount: statsRow.rejected_count,
          rejectedQuoteAmount: String(statsRow.rejected_quote_amount),
          totalCount: statsRow.total_count,
          totalQuoteAmount: String(statsRow.total_quote_amount),
        };
      });
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM risk_checks WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
