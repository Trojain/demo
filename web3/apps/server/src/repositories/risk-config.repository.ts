import type Database from 'better-sqlite3'
import type { RiskConfig } from '../types/domain.js'

const CONFIG_ID = 'default'

type RiskConfigRow = {
  max_quote_amount: string
  max_market_age_ms: number
  daily_max_trigger_count: number
  daily_max_quote_amount: string
  trading_mode: RiskConfig['tradingMode']
  updated_at: string
}

function mapRiskConfig(row: RiskConfigRow): RiskConfig {
  return {
    maxQuoteAmount: row.max_quote_amount,
    maxMarketAgeMs: row.max_market_age_ms,
    dailyMaxTriggerCount: row.daily_max_trigger_count,
    dailyMaxQuoteAmount: row.daily_max_quote_amount,
    tradingMode: row.trading_mode,
    updatedAt: row.updated_at,
  }
}

export class RiskConfigRepository {
  constructor(private readonly db: Database.Database) {}

  get(): RiskConfig | undefined {
    const row = this.db.prepare('SELECT * FROM risk_config WHERE id = ?').get(CONFIG_ID) as RiskConfigRow | undefined
    return row ? mapRiskConfig(row) : undefined
  }

  save(config: RiskConfig): RiskConfig {
    this.db
      .prepare(
        `INSERT INTO risk_config (
          id, max_quote_amount, max_market_age_ms, daily_max_trigger_count,
          daily_max_quote_amount, trading_mode, updated_at
        ) VALUES (
          @id, @maxQuoteAmount, @maxMarketAgeMs, @dailyMaxTriggerCount,
          @dailyMaxQuoteAmount, @tradingMode, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          max_quote_amount = excluded.max_quote_amount,
          max_market_age_ms = excluded.max_market_age_ms,
          daily_max_trigger_count = excluded.daily_max_trigger_count,
          daily_max_quote_amount = excluded.daily_max_quote_amount,
          trading_mode = excluded.trading_mode,
          updated_at = excluded.updated_at`
      )
      .run({
        id: CONFIG_ID,
        ...config,
      })

    return config
  }
}
