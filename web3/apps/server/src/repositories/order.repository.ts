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

  countAll(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM order_records').get() as { count: number }
    return row.count
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
