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

    CREATE INDEX IF NOT EXISTS idx_monitor_rules_enabled ON monitor_rules(enabled);
    CREATE INDEX IF NOT EXISTS idx_trigger_events_status ON trigger_events(status);
    CREATE INDEX IF NOT EXISTS idx_order_records_created_at ON order_records(created_at);
  `);

  migrateMonitorRules(db);

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
