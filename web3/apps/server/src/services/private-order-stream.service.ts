import type { ExchangeFactory } from '../exchange/exchange-factory.js'
import type { ExchangeCode } from '../types/domain.js'
import type { AuditLogService } from './audit-log.service.js'
import type { RealOrderSyncService } from './real-order-sync.service.js'

export class PrivateOrderStreamService {
  private readonly disconnectors = new Map<ExchangeCode, () => void>()

  constructor(
    private readonly exchangeFactory: ExchangeFactory,
    private readonly realOrderSyncService: RealOrderSyncService,
    private readonly auditLogService: AuditLogService,
  ) {}

  start() {
    this.stop()

    ;(['okx', 'binance'] as const).forEach(exchange => {
      const adapter = this.exchangeFactory.getAdapter(exchange)
      if (!adapter.connectPrivateTradeStream) {
        return
      }

      const disconnect = adapter.connectPrivateTradeStream({
        onOrderUpdate: update => {
          void this.realOrderSyncService.handlePrivateOrderUpdate(update).catch(error => {
            this.auditLogService.record({
              level: 'warning',
              action: 'strategy.error',
              entityType: 'private_stream',
              entityId: exchange,
              message: `${exchange.toUpperCase()} 私有订单推送消费失败：${error instanceof Error ? error.message : '未知错误'}`,
              dedupeKey: `private_stream:consume_order:${exchange}`,
              dedupeMs: 60_000,
              payload: {
                exchange,
              },
            })
          })
        },
        onBalanceUpdate: update => {
          void this.realOrderSyncService.handlePrivateBalanceUpdate(update).catch(error => {
            this.auditLogService.record({
              level: 'warning',
              action: 'strategy.error',
              entityType: 'private_stream',
              entityId: exchange,
              message: `${exchange.toUpperCase()} 私有余额推送消费失败：${error instanceof Error ? error.message : '未知错误'}`,
              dedupeKey: `private_stream:consume_balance:${exchange}`,
              dedupeMs: 60_000,
              payload: {
                exchange,
              },
            })
          })
        },
        onError: error => {
          this.auditLogService.record({
            level: 'warning',
            action: 'strategy.error',
            entityType: 'private_stream',
            entityId: exchange,
            message: `${exchange.toUpperCase()} 私有推送异常：${error.message}`,
            dedupeKey: `private_stream:${exchange}:${error.message}`,
            dedupeMs: 60_000,
            payload: {
              exchange,
            },
          })
        },
      })

      this.disconnectors.set(exchange, disconnect)
    })
  }

  stop() {
    this.disconnectors.forEach(disconnect => {
      disconnect()
    })
    this.disconnectors.clear()
  }
}
