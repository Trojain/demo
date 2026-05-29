import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function createDatabase(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS monitor_rules (
      id TEXT PRIMARY KEY,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      operator TEXT NOT NULL,
      target_price TEXT NOT NULL,
      check_interval_ms INTEGER NOT NULL,
      side TEXT NOT NULL,
      order_type TEXT NOT NULL,
      base_quantity TEXT,
      quote_amount TEXT,
      limit_price TEXT,
      max_slippage_percent TEXT NOT NULL,
      cooldown_ms INTEGER NOT NULL,
      max_trigger_count INTEGER NOT NULL,
      triggered_count INTEGER NOT NULL DEFAULT 0,
      simulation_mode INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      runtime_status TEXT NOT NULL DEFAULT 'idle',
      last_error_message TEXT,
      last_checked_at TEXT,
      last_triggered_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trigger_events (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      market_price TEXT NOT NULL,
      target_price TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      FOREIGN KEY (rule_id) REFERENCES monitor_rules(id)
    );

    CREATE TABLE IF NOT EXISTS trading_signals (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      market_price TEXT NOT NULL,
      market_event_time TEXT NOT NULL DEFAULT '',
      target_price TEXT NOT NULL,
      operator TEXT NOT NULL,
      side TEXT NOT NULL,
      order_type TEXT NOT NULL,
      base_quantity TEXT,
      quote_amount TEXT,
      limit_price TEXT,
      simulation_mode INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      converted_at TEXT,
      FOREIGN KEY (rule_id) REFERENCES monitor_rules(id)
    );

    CREATE TABLE IF NOT EXISTS risk_checks (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      quote_exposure TEXT NOT NULL,
      market_price TEXT NOT NULL,
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (signal_id) REFERENCES trading_signals(id),
      FOREIGN KEY (rule_id) REFERENCES monitor_rules(id)
    );

    CREATE TABLE IF NOT EXISTS risk_config (
      id TEXT PRIMARY KEY,
      max_quote_amount TEXT NOT NULL,
      max_market_age_ms INTEGER NOT NULL,
      daily_max_trigger_count INTEGER NOT NULL,
      daily_max_quote_amount TEXT NOT NULL,
      trading_mode TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_records (
      id TEXT PRIMARY KEY,
      trigger_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      order_type TEXT NOT NULL,
      base_quantity TEXT,
      quote_amount TEXT,
      price TEXT,
      exchange_order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      simulation_mode INTEGER NOT NULL,
      raw_message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (trigger_id) REFERENCES trigger_events(id),
      FOREIGN KEY (rule_id) REFERENCES monitor_rules(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      rule_id TEXT,
      trigger_id TEXT,
      order_id TEXT,
      message TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trade_accounts (
      id TEXT PRIMARY KEY,
      account_type TEXT NOT NULL,
      exchange TEXT NOT NULL,
      quote_currency TEXT NOT NULL,
      initial_equity TEXT NOT NULL,
      available_quote_balance TEXT NOT NULL,
      locked_quote_balance TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trade_positions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      account_type TEXT NOT NULL,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      base_currency TEXT NOT NULL,
      quote_currency TEXT NOT NULL,
      quantity TEXT NOT NULL,
      available_quantity TEXT NOT NULL,
      locked_quantity TEXT NOT NULL,
      avg_cost_price TEXT NOT NULL,
      cost_amount TEXT NOT NULL,
      realized_pnl TEXT NOT NULL,
      fee_amount TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES trade_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS trade_fills (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      order_id TEXT,
      account_type TEXT NOT NULL,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      price TEXT NOT NULL,
      base_quantity TEXT NOT NULL,
      quote_amount TEXT NOT NULL,
      fee_amount TEXT NOT NULL,
      fee_currency TEXT NOT NULL,
      realized_pnl TEXT NOT NULL,
      raw_message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES trade_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS trade_operation_logs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      account_type TEXT NOT NULL,
      exchange TEXT NOT NULL,
      level TEXT NOT NULL,
      action TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES trade_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS trade_equity_snapshots (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      account_type TEXT NOT NULL,
      exchange TEXT NOT NULL,
      quote_currency TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      total_equity TEXT NOT NULL,
      available_quote_balance TEXT NOT NULL,
      locked_quote_balance TEXT NOT NULL,
      position_market_value TEXT NOT NULL,
      realized_pnl TEXT NOT NULL,
      unrealized_pnl TEXT NOT NULL,
      total_pnl TEXT NOT NULL,
      total_pnl_percent TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES trade_accounts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_monitor_rules_enabled ON monitor_rules(enabled);
    CREATE INDEX IF NOT EXISTS idx_trigger_events_status ON trigger_events(status);
    CREATE INDEX IF NOT EXISTS idx_trading_signals_status ON trading_signals(status);
    CREATE INDEX IF NOT EXISTS idx_trading_signals_rule_id ON trading_signals(rule_id);
    CREATE INDEX IF NOT EXISTS idx_risk_checks_signal_id ON risk_checks(signal_id);
    CREATE INDEX IF NOT EXISTS idx_risk_checks_status ON risk_checks(status);
    CREATE INDEX IF NOT EXISTS idx_order_records_created_at ON order_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_accounts_identity ON trade_accounts(account_type, exchange, quote_currency);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_positions_account_symbol ON trade_positions(account_id, symbol);
    CREATE INDEX IF NOT EXISTS idx_trade_fills_account_created_at ON trade_fills(account_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_trade_operation_logs_account_created_at ON trade_operation_logs(account_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_equity_snapshots_account_date ON trade_equity_snapshots(account_id, snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_trade_equity_snapshots_query ON trade_equity_snapshots(account_type, exchange, snapshot_date);
  `);

  migrateMonitorRules(db);
  migrateTradingSignals(db);

  return db;
}

function migrateMonitorRules(db: Database.Database) {
  const columns = db.prepare('PRAGMA table_info(monitor_rules)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  // 兼容已经存在的第一版 SQLite 文件，启动时补齐第二版运行状态字段。
  if (!columnNames.has('runtime_status')) {
    db.prepare("ALTER TABLE monitor_rules ADD COLUMN runtime_status TEXT NOT NULL DEFAULT 'idle'").run();
  }

  if (!columnNames.has('last_error_message')) {
    db.prepare('ALTER TABLE monitor_rules ADD COLUMN last_error_message TEXT').run();
  }
}

function migrateTradingSignals(db: Database.Database) {
  const columns = db.prepare('PRAGMA table_info(trading_signals)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  // 兼容 v0.2.23 已创建的信号表，风控需要知道信号是否来自模拟规则。
  if (!columnNames.has('simulation_mode')) {
    db.prepare('ALTER TABLE trading_signals ADD COLUMN simulation_mode INTEGER NOT NULL DEFAULT 1').run();
  }

  if (!columnNames.has('market_event_time')) {
    db.prepare("ALTER TABLE trading_signals ADD COLUMN market_event_time TEXT NOT NULL DEFAULT ''").run();
    db.prepare("UPDATE trading_signals SET market_event_time = created_at WHERE market_event_time = ''").run();
  }
}
