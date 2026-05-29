import type Database from 'better-sqlite3'
import type { ExchangeCode, TradeAccount, TradeAccountType, TradeEquitySnapshot, TradeFill, TradeOperationLog, TradePosition } from '../types/domain.js'

type TradeAccountRow = {
  id: string
  account_type: TradeAccountType
  exchange: ExchangeCode
  quote_currency: string
  initial_equity: string
  available_quote_balance: string
  locked_quote_balance: string
  created_at: string
  updated_at: string
}

type TradePositionRow = {
  id: string
  account_id: string
  account_type: TradeAccountType
  exchange: ExchangeCode
  symbol: string
  base_currency: string
  quote_currency: string
  quantity: string
  available_quantity: string
  locked_quantity: string
  avg_cost_price: string
  cost_amount: string
  realized_pnl: string
  fee_amount: string
  created_at: string
  updated_at: string
}

type TradeFillRow = {
  id: string
  account_id: string
  order_id?: string
  account_type: TradeAccountType
  exchange: ExchangeCode
  symbol: string
  side: TradeFill['side']
  price: string
  base_quantity: string
  quote_amount: string
  fee_amount: string
  fee_currency: string
  realized_pnl: string
  raw_message: string
  created_at: string
}

type TradeOperationLogRow = {
  id: string
  account_id: string
  account_type: TradeAccountType
  exchange: ExchangeCode
  level: TradeOperationLog['level']
  action: string
  message: string
  payload_json?: string
  created_at: string
}

type TradeEquitySnapshotRow = {
  id: string
  account_id: string
  account_type: TradeAccountType
  exchange: ExchangeCode
  quote_currency: string
  snapshot_date: string
  total_equity: string
  available_quote_balance: string
  locked_quote_balance: string
  position_market_value: string
  realized_pnl: string
  unrealized_pnl: string
  total_pnl: string
  total_pnl_percent: string
  created_at: string
  updated_at: string
}

function mapTradeAccount(row: TradeAccountRow): TradeAccount {
  return {
    id: row.id,
    accountType: row.account_type,
    exchange: row.exchange,
    quoteCurrency: row.quote_currency,
    initialEquity: row.initial_equity,
    availableQuoteBalance: row.available_quote_balance,
    lockedQuoteBalance: row.locked_quote_balance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTradePosition(row: TradePositionRow): TradePosition {
  return {
    id: row.id,
    accountId: row.account_id,
    accountType: row.account_type,
    exchange: row.exchange,
    symbol: row.symbol,
    baseCurrency: row.base_currency,
    quoteCurrency: row.quote_currency,
    quantity: row.quantity,
    availableQuantity: row.available_quantity,
    lockedQuantity: row.locked_quantity,
    avgCostPrice: row.avg_cost_price,
    costAmount: row.cost_amount,
    realizedPnl: row.realized_pnl,
    feeAmount: row.fee_amount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTradeFill(row: TradeFillRow): TradeFill {
  return {
    id: row.id,
    accountId: row.account_id,
    orderId: row.order_id,
    accountType: row.account_type,
    exchange: row.exchange,
    symbol: row.symbol,
    side: row.side,
    price: row.price,
    baseQuantity: row.base_quantity,
    quoteAmount: row.quote_amount,
    feeAmount: row.fee_amount,
    feeCurrency: row.fee_currency,
    realizedPnl: row.realized_pnl,
    rawMessage: row.raw_message,
    createdAt: row.created_at,
  }
}

function mapTradeOperationLog(row: TradeOperationLogRow): TradeOperationLog {
  return {
    id: row.id,
    accountId: row.account_id,
    accountType: row.account_type,
    exchange: row.exchange,
    level: row.level,
    action: row.action,
    message: row.message,
    payloadJson: row.payload_json,
    createdAt: row.created_at,
  }
}

function mapTradeEquitySnapshot(row: TradeEquitySnapshotRow): TradeEquitySnapshot {
  return {
    id: row.id,
    accountId: row.account_id,
    mode: row.account_type,
    exchange: row.exchange,
    quoteCurrency: row.quote_currency,
    snapshotDate: row.snapshot_date,
    totalEquity: row.total_equity,
    availableQuoteBalance: row.available_quote_balance,
    lockedQuoteBalance: row.locked_quote_balance,
    positionMarketValue: row.position_market_value,
    realizedPnl: row.realized_pnl,
    unrealizedPnl: row.unrealized_pnl,
    totalPnl: row.total_pnl,
    totalPnlPercent: row.total_pnl_percent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class TradeAccountRepository {
  constructor(private readonly db: Database.Database) {}

  findAccount(accountType: TradeAccountType, exchange: ExchangeCode, quoteCurrency: string): TradeAccount | undefined {
    const row = this.db
      .prepare('SELECT * FROM trade_accounts WHERE account_type = ? AND exchange = ? AND quote_currency = ?')
      .get(accountType, exchange, quoteCurrency) as TradeAccountRow | undefined

    return row ? mapTradeAccount(row) : undefined
  }

  listAccounts(accountType?: TradeAccountType): TradeAccount[] {
    const sql = accountType
      ? 'SELECT * FROM trade_accounts WHERE account_type = ? ORDER BY account_type ASC, exchange ASC, quote_currency ASC'
      : 'SELECT * FROM trade_accounts ORDER BY account_type ASC, exchange ASC, quote_currency ASC'
    const params = accountType ? [accountType] : []

    return this.db
      .prepare(sql)
      .all(...params)
      .map(row => mapTradeAccount(row as TradeAccountRow))
  }

  createAccount(account: TradeAccount): TradeAccount {
    this.db
      .prepare(
        `INSERT INTO trade_accounts (
          id, account_type, exchange, quote_currency, initial_equity,
          available_quote_balance, locked_quote_balance, created_at, updated_at
        ) VALUES (
          @id, @accountType, @exchange, @quoteCurrency, @initialEquity,
          @availableQuoteBalance, @lockedQuoteBalance, @createdAt, @updatedAt
        )`,
      )
      .run(account)

    return account
  }

  updateAccountBalance(account: TradeAccount): TradeAccount {
    this.db
      .prepare(
        `UPDATE trade_accounts
         SET available_quote_balance = @availableQuoteBalance,
             locked_quote_balance = @lockedQuoteBalance,
             updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run(account)

    return account
  }

  findPosition(accountId: string, symbol: string): TradePosition | undefined {
    const row = this.db
      .prepare('SELECT * FROM trade_positions WHERE account_id = ? AND symbol = ?')
      .get(accountId, symbol) as TradePositionRow | undefined

    return row ? mapTradePosition(row) : undefined
  }

  upsertPosition(position: TradePosition): TradePosition {
    this.db
      .prepare(
        `INSERT INTO trade_positions (
          id, account_id, account_type, exchange, symbol, base_currency, quote_currency,
          quantity, available_quantity, locked_quantity, avg_cost_price, cost_amount,
          realized_pnl, fee_amount, created_at, updated_at
        ) VALUES (
          @id, @accountId, @accountType, @exchange, @symbol, @baseCurrency, @quoteCurrency,
          @quantity, @availableQuantity, @lockedQuantity, @avgCostPrice, @costAmount,
          @realizedPnl, @feeAmount, @createdAt, @updatedAt
        )
        ON CONFLICT(account_id, symbol) DO UPDATE SET
          quantity = excluded.quantity,
          available_quantity = excluded.available_quantity,
          locked_quantity = excluded.locked_quantity,
          avg_cost_price = excluded.avg_cost_price,
          cost_amount = excluded.cost_amount,
          realized_pnl = excluded.realized_pnl,
          fee_amount = excluded.fee_amount,
          updated_at = excluded.updated_at`,
      )
      .run(position)

    return position
  }

  listPositions(accountType?: TradeAccountType, exchange?: ExchangeCode): TradePosition[] {
    const conditions: string[] = []
    const params: string[] = []
    if (accountType) {
      conditions.push('account_type = ?')
      params.push(accountType)
    }
    if (exchange) {
      conditions.push('exchange = ?')
      params.push(exchange)
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    return this.db
      .prepare(`SELECT * FROM trade_positions ${whereSql} ORDER BY updated_at DESC`)
      .all(...params)
      .map(row => mapTradePosition(row as TradePositionRow))
  }

  listFills(accountType: TradeAccountType | undefined, exchange: ExchangeCode | undefined, limit: number): TradeFill[] {
    const conditions: string[] = []
    const params: Array<string | number> = []
    if (accountType) {
      conditions.push('account_type = ?')
      params.push(accountType)
    }
    if (exchange) {
      conditions.push('exchange = ?')
      params.push(exchange)
    }
    params.push(limit)

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    return this.db
      .prepare(`SELECT * FROM trade_fills ${whereSql} ORDER BY created_at DESC LIMIT ?`)
      .all(...params)
      .map(row => mapTradeFill(row as TradeFillRow))
  }

  listOperationLogs(accountType: TradeAccountType | undefined, exchange: ExchangeCode | undefined, limit: number): TradeOperationLog[] {
    const conditions: string[] = []
    const params: Array<string | number> = []
    if (accountType) {
      conditions.push('account_type = ?')
      params.push(accountType)
    }
    if (exchange) {
      conditions.push('exchange = ?')
      params.push(exchange)
    }
    params.push(limit)

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    return this.db
      .prepare(`SELECT * FROM trade_operation_logs ${whereSql} ORDER BY created_at DESC LIMIT ?`)
      .all(...params)
      .map(row => mapTradeOperationLog(row as TradeOperationLogRow))
  }

  createOperationLog(log: TradeOperationLog): TradeOperationLog {
    this.db
      .prepare(
        `INSERT INTO trade_operation_logs (
          id, account_id, account_type, exchange, level, action, message, payload_json, created_at
        ) VALUES (
          @id, @accountId, @accountType, @exchange, @level, @action, @message, @payloadJson, @createdAt
        )`,
      )
      .run({
        ...log,
        payloadJson: log.payloadJson ?? null,
      })

    return log
  }

  createFill(fill: TradeFill): TradeFill {
    this.db
      .prepare(
        `INSERT INTO trade_fills (
          id, account_id, order_id, account_type, exchange, symbol, side, price,
          base_quantity, quote_amount, fee_amount, fee_currency, realized_pnl, raw_message, created_at
        ) VALUES (
          @id, @accountId, @orderId, @accountType, @exchange, @symbol, @side, @price,
          @baseQuantity, @quoteAmount, @feeAmount, @feeCurrency, @realizedPnl, @rawMessage, @createdAt
        )`,
      )
      .run({
        ...fill,
        orderId: fill.orderId ?? null,
      })

    return fill
  }

  upsertEquitySnapshot(snapshot: TradeEquitySnapshot): TradeEquitySnapshot {
    this.db
      .prepare(
        `INSERT INTO trade_equity_snapshots (
          id, account_id, account_type, exchange, quote_currency, snapshot_date,
          total_equity, available_quote_balance, locked_quote_balance, position_market_value,
          realized_pnl, unrealized_pnl, total_pnl, total_pnl_percent, created_at, updated_at
        ) VALUES (
          @id, @accountId, @mode, @exchange, @quoteCurrency, @snapshotDate,
          @totalEquity, @availableQuoteBalance, @lockedQuoteBalance, @positionMarketValue,
          @realizedPnl, @unrealizedPnl, @totalPnl, @totalPnlPercent, @createdAt, @updatedAt
        )
        ON CONFLICT(account_id, snapshot_date) DO UPDATE SET
          account_type = excluded.account_type,
          exchange = excluded.exchange,
          quote_currency = excluded.quote_currency,
          total_equity = excluded.total_equity,
          available_quote_balance = excluded.available_quote_balance,
          locked_quote_balance = excluded.locked_quote_balance,
          position_market_value = excluded.position_market_value,
          realized_pnl = excluded.realized_pnl,
          unrealized_pnl = excluded.unrealized_pnl,
          total_pnl = excluded.total_pnl,
          total_pnl_percent = excluded.total_pnl_percent,
          updated_at = excluded.updated_at`,
      )
      .run(snapshot)

    return snapshot
  }

  listEquitySnapshots(accountId: string, fromDate: string, toDate: string): TradeEquitySnapshot[] {
    return this.db
      .prepare(
        `SELECT * FROM trade_equity_snapshots
         WHERE account_id = ? AND snapshot_date >= ? AND snapshot_date <= ?
         ORDER BY snapshot_date ASC`,
      )
      .all(accountId, fromDate, toDate)
      .map(row => mapTradeEquitySnapshot(row as TradeEquitySnapshotRow))
  }

  findLatestEquitySnapshotBefore(accountId: string, beforeDate: string): TradeEquitySnapshot | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM trade_equity_snapshots
         WHERE account_id = ? AND snapshot_date < ?
         ORDER BY snapshot_date DESC
         LIMIT 1`,
      )
      .get(accountId, beforeDate) as TradeEquitySnapshotRow | undefined

    return row ? mapTradeEquitySnapshot(row) : undefined
  }

  runInTransaction<T>(callback: () => T): T {
    return this.db.transaction(callback)()
  }
}
