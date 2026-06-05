import type Database from 'better-sqlite3'
import type { OrderRecord } from '../types/domain.js'

type OrderRow = {
  id: string
  trigger_id?: string | null
  rule_id?: string | null
  exchange: OrderRecord['exchange']
  symbol: string
  side: OrderRecord['side']
  order_type: OrderRecord['orderType']
  base_quantity?: string
  quote_amount?: string
  price?: string
  exchange_order_id: string
  status: OrderRecord['status']
  simulation_mode: number
  raw_message: string
  created_at: string
}

function mapOrder(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    triggerId: row.trigger_id ?? undefined,
    ruleId: row.rule_id ?? undefined,
    exchange: row.exchange,
    symbol: row.symbol,
    side: row.side,
    orderType: row.order_type,
    baseQuantity: row.base_quantity,
    quoteAmount: row.quote_amount,
    price: row.price,
    exchangeOrderId: row.exchange_order_id,
    status: row.status,
    simulationMode: Boolean(row.simulation_mode),
    rawMessage: row.raw_message,
    createdAt: row.created_at,
  }
}

export class OrderRepository {
  constructor(private readonly db: Database.Database) {}

  findById(id: string): OrderRecord | undefined {
    const row = this.db.prepare('SELECT * FROM order_records WHERE id = ? LIMIT 1').get(id) as OrderRow | undefined
    return row ? mapOrder(row) : undefined
  }

  list(limit = 100): OrderRecord[] {
    return this.db
      .prepare('SELECT * FROM order_records ORDER BY created_at DESC LIMIT ?')
      .all(limit)
      .map(row => mapOrder(row as OrderRow))
  }

  listByRuleId(ruleId: string, limit = 100): OrderRecord[] {
    return this.db
      .prepare('SELECT * FROM order_records WHERE rule_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(ruleId, limit)
      .map(row => mapOrder(row as OrderRow))
  }

  findByTriggerId(triggerId: string): OrderRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM order_records WHERE trigger_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(triggerId) as OrderRow | undefined
    return row ? mapOrder(row) : undefined
  }

  findByExchangeOrderId(exchange: OrderRecord['exchange'], exchangeOrderId: string): OrderRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM order_records
         WHERE exchange = ?
           AND exchange_order_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(exchange, exchangeOrderId) as OrderRow | undefined
    return row ? mapOrder(row) : undefined
  }

  listPendingRealOrders(input: {
    /** 只同步该时间之后创建的真实订单，避免长尾历史订单持续占用查询配额。 */
    createdAfter: string
    /** 单次同步最多处理多少条记录。 */
    limit: number
  }): OrderRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM order_records
         WHERE simulation_mode = 0
           AND created_at >= ?
           AND status IN ('submitted', 'partially_filled')
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(input.createdAfter, input.limit)
      .map(row => mapOrder(row as OrderRow))
  }

  listPendingRealOrdersByExchange(input: {
    /** 只同步该时间之后创建的真实订单。 */
    createdAfter: string
    /** 交易所编码。 */
    exchange: OrderRecord['exchange']
    /** 单次同步最多处理多少条记录。 */
    limit: number
  }): OrderRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM order_records
         WHERE simulation_mode = 0
           AND exchange = ?
           AND created_at >= ?
           AND status IN ('submitted', 'partially_filled')
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(input.exchange, input.createdAfter, input.limit)
      .map(row => mapOrder(row as OrderRow))
  }

  countAll(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM order_records').get() as { count: number }
    return row.count
  }

  /**
   * 按本地日期维度聚合订单统计。
   * 使用 SQLite date(created_at, 'localtime') 与风控日期口径保持一致。
   */
  listDailySummary(input: {
    fromDate: string
    toDate: string
    exchange?: string
    mode?: 'simulation' | 'real'
  }): Array<{
    date: string
    orderCount: number
    filledOrderCount: number
    failedOrderCount: number
    cancelledOrderCount: number
  }> {
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
             COUNT(*) AS order_count,
             SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) AS filled_order_count,
             SUM(CASE WHEN status IN ('rejected','failed') THEN 1 ELSE 0 END) AS failed_order_count,
             SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_order_count
           FROM order_records
           ${where}
           GROUP BY date(created_at, 'localtime')
           ORDER BY date DESC`,
        )
        .all(...params) as Array<{
        date: string
        order_count: number
        filled_order_count: number
        failed_order_count: number
        cancelled_order_count: number
      }>
    ).map(row => ({
      date: row.date,
      orderCount: row.order_count,
      filledOrderCount: row.filled_order_count,
      failedOrderCount: row.failed_order_count,
      cancelledOrderCount: row.cancelled_order_count,
    }))
  }

  listAnalysisRecords(input: {
    fromDate: string
    toDate: string
    exchange?: string
    mode?: 'simulation' | 'real'
  }): Array<{
    id: string
    exchange: string
    symbol: string
    side: 'buy' | 'sell'
    status: string
    orderCreatedTime: string
    triggerCreatedTime: string | null
    triggerMarketPrice: string | null
    maxFillCreatedTime: string | null
    fillAvgPrice: number | null
  }> {
    const conditions = [
      `date(o.created_at, 'localtime') >= ?`,
      `date(o.created_at, 'localtime') <= ?`,
    ]
    const params: Array<string | number> = [input.fromDate, input.toDate]
    if (input.exchange) {
      conditions.push('o.exchange = ?')
      params.push(input.exchange)
    }
    if (input.mode !== undefined) {
      conditions.push('o.simulation_mode = ?')
      params.push(input.mode === 'simulation' ? 1 : 0)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    return (
      this.db
        .prepare(
          `SELECT
             o.id,
             o.exchange,
             o.symbol,
             o.side,
             o.status,
             o.created_at AS order_created_time,
             tr.created_at AS trigger_created_time,
             tr.market_price AS trigger_market_price,
             (SELECT MAX(created_at) FROM trade_fills WHERE order_id = o.id) AS max_fill_created_time,
             (SELECT SUM(CAST(quote_amount AS REAL)) / SUM(CAST(base_quantity AS REAL)) FROM trade_fills WHERE order_id = o.id) AS fill_avg_price
           FROM order_records o
           LEFT JOIN trigger_events tr ON o.trigger_id = tr.id
           ${where}
           ORDER BY o.created_at DESC`,
        )
        .all(...params) as Array<{
        id: string
        exchange: string
        symbol: string
        side: 'buy' | 'sell'
        status: string
        order_created_time: string
        trigger_created_time: string | null
        trigger_market_price: string | null
        max_fill_created_time: string | null
        fill_avg_price: number | null
      }>
    ).map(row => ({
      id: row.id,
      exchange: row.exchange,
      symbol: row.symbol,
      side: row.side,
      status: row.status,
      orderCreatedTime: row.order_created_time,
      triggerCreatedTime: row.trigger_created_time,
      triggerMarketPrice: row.trigger_market_price,
      maxFillCreatedTime: row.max_fill_created_time,
      fillAvgPrice: row.fill_avg_price,
    }))
  }

  create(order: OrderRecord): OrderRecord {
    this.db
      .prepare(
        `INSERT INTO order_records (
          id, trigger_id, rule_id, exchange, symbol, side, order_type, base_quantity,
          quote_amount, price, exchange_order_id, status, simulation_mode, raw_message, created_at
        ) VALUES (
          @id, @triggerId, @ruleId, @exchange, @symbol, @side, @orderType, @baseQuantity,
          @quoteAmount, @price, @exchangeOrderId, @status, @simulationMode, @rawMessage, @createdAt
        )`,
      )
      .run({
        ...order,
        triggerId: order.triggerId ?? null,
        ruleId: order.ruleId ?? null,
        baseQuantity: order.baseQuantity ?? null,
        quoteAmount: order.quoteAmount ?? null,
        price: order.price ?? null,
        simulationMode: order.simulationMode ? 1 : 0,
      })

    return order
  }

  updateSyncSnapshot(input: {
    id: string
    status: OrderRecord['status']
    baseQuantity?: string
    quoteAmount?: string
    price?: string
    rawMessage: string
  }): OrderRecord | undefined {
    const current = this.findById(input.id)
    if (!current) {
      return undefined
    }

    const nextOrder: OrderRecord = {
      ...current,
      status: input.status,
      baseQuantity: input.baseQuantity ?? current.baseQuantity,
      quoteAmount: input.quoteAmount ?? current.quoteAmount,
      price: input.price ?? current.price,
      rawMessage: input.rawMessage,
    }

    this.db
      .prepare(
        `UPDATE order_records
         SET status = @status,
             base_quantity = @baseQuantity,
             quote_amount = @quoteAmount,
             price = @price,
             raw_message = @rawMessage
         WHERE id = @id`,
      )
      .run({
        id: nextOrder.id,
        status: nextOrder.status,
        baseQuantity: nextOrder.baseQuantity ?? null,
        quoteAmount: nextOrder.quoteAmount ?? null,
        price: nextOrder.price ?? null,
        rawMessage: nextOrder.rawMessage,
      })

    return nextOrder
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM order_records WHERE id = ?').run(id)
    return result.changes > 0
  }
}
