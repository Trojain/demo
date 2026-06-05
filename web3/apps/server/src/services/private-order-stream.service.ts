import { appConfig } from '../config/env.js'
import type { ExchangeFactory } from '../exchange/exchange-factory.js'
import type { ExchangeCode, PrivateTradeStreamHealth } from '../types/domain.js'
import type { PrivateTradeStreamConnectionStatus } from '../types/exchange.js'
import { resolveTradingEnvironmentLabel } from '../utils/trading-environment.js'
import type { AuditLogService } from './audit-log.service.js'
import type { OrderRecoveryService } from './order-recovery.service.js'
import type { RealOrderSyncService } from './real-order-sync.service.js'

const SUPPORTED_PRIVATE_STREAM_EXCHANGES: ExchangeCode[] = ['okx', 'binance']

export class PrivateOrderStreamService {
  private readonly disconnectors = new Map<ExchangeCode, () => void>()
  private readonly healthByExchange = new Map<ExchangeCode, PrivateTradeStreamHealth>(
    SUPPORTED_PRIVATE_STREAM_EXCHANGES.map(exchange => [exchange, this.createInitialHealth(exchange)]),
  )

  constructor(
    private readonly exchangeFactory: ExchangeFactory,
    private readonly realOrderSyncService: RealOrderSyncService,
    private readonly auditLogService: AuditLogService,
    private readonly orderRecoveryService: OrderRecoveryService,
  ) {}

  start() {
    this.stop()

    SUPPORTED_PRIVATE_STREAM_EXCHANGES.forEach(exchange => {
      const adapter = this.exchangeFactory.getAdapter(exchange)
      if (!adapter.connectPrivateTradeStream) {
        return
      }

      if (!this.isExchangeConfigured(exchange)) {
        this.healthByExchange.set(exchange, this.createInitialHealth(exchange))
        return
      }

      this.updateStatus(exchange, 'connecting')

      const disconnect = adapter.connectPrivateTradeStream({
        onStatusChange: (status, message) => {
          this.handleStatusChange(exchange, status, message)
        },
        onOrderUpdate: update => {
          this.markOrderUpdate(exchange, update.updatedAt)
          void this.realOrderSyncService.handlePrivateOrderUpdate(update).catch(error => {
            this.orderRecoveryService.createOrRefresh({
              identityKey: `private_stream:order:${update.exchangeOrderId}`,
              exchangeOrderId: update.exchangeOrderId,
              exchange,
              source: 'system',
              mode: 'real',
              symbol: update.symbol,
              failureStage: 'private_stream',
              lastErrorMessage: error instanceof Error ? error.message : '私有订单推送消费失败',
              payload: {
                source: 'private_stream',
                updateType: 'order',
              },
            })
            this.auditLogService.record({
              level: 'warning',
              action: 'private_stream.error',
              entityType: 'private_stream',
              entityId: exchange,
              message: `${exchange.toUpperCase()} 私有订单推送消费失败：${error instanceof Error ? error.message : '未知错误'}`,
              dedupeKey: `private_stream:consume_order:${exchange}`,
              dedupeMs: 60_000,
              payload: {
                exchange,
                tradingEnvironment: this.resolveTradingEnvironmentLabel(exchange),
              },
            })
          })
        },
        onBalanceUpdate: update => {
          this.markBalanceUpdate(exchange, update.updatedAt)
          void this.realOrderSyncService.handlePrivateBalanceUpdate(update).catch(error => {
            this.orderRecoveryService.createOrRefresh({
              identityKey: `balance_refresh:${exchange}:${(update.balances[0]?.currency ?? appConfig.simulation.quoteCurrency).toUpperCase()}`,
              exchange,
              source: 'system',
              mode: 'real',
              failureStage: 'balance_refresh',
              lastErrorMessage: error instanceof Error ? error.message : '私有余额推送消费失败',
              payload: {
                source: 'private_stream',
                updateType: 'balance',
                currencies: update.balances.map(balance => balance.currency.toUpperCase()),
              },
            })
            this.auditLogService.record({
              level: 'warning',
              action: 'private_stream.error',
              entityType: 'private_stream',
              entityId: exchange,
              message: `${exchange.toUpperCase()} 私有余额推送消费失败：${error instanceof Error ? error.message : '未知错误'}`,
              dedupeKey: `private_stream:consume_balance:${exchange}`,
              dedupeMs: 60_000,
              payload: {
                exchange,
                tradingEnvironment: this.resolveTradingEnvironmentLabel(exchange),
              },
            })
          })
        },
        onError: error => {
          this.markError(exchange, error.message)
          this.orderRecoveryService.createOrRefresh({
            identityKey: `private_stream:exchange:${exchange}`,
            exchange,
            source: 'system',
            mode: 'real',
            failureStage: 'private_stream',
            lastErrorMessage: error.message,
            payload: {
              scope: 'exchange',
            },
          })
          this.auditLogService.record({
            level: 'warning',
            action: 'private_stream.error',
            entityType: 'private_stream',
            entityId: exchange,
            message: `${exchange.toUpperCase()} 私有推送异常：${error.message}`,
            dedupeKey: `private_stream:${exchange}:${error.message}`,
            dedupeMs: 60_000,
            payload: {
              exchange,
              tradingEnvironment: this.resolveTradingEnvironmentLabel(exchange),
            },
          })
        },
      })

      this.disconnectors.set(exchange, disconnect)
    })
  }

  stop() {
    this.disconnectors.forEach((disconnect, exchange) => {
      this.updateStatus(exchange, 'stopped')
      disconnect()
    })
    this.disconnectors.clear()
  }

  getHealth(exchange: ExchangeCode): PrivateTradeStreamHealth {
    return this.healthByExchange.get(exchange) ?? this.createInitialHealth(exchange)
  }

  private createInitialHealth(exchange: ExchangeCode): PrivateTradeStreamHealth {
    return {
      exchange,
      enabled: this.isExchangeConfigured(exchange),
      status: 'idle',
      reconnectCount: 0,
    }
  }

  private isExchangeConfigured(exchange: ExchangeCode) {
    if (exchange === 'okx') {
      return Boolean(appConfig.okx.apiKey && appConfig.okx.apiSecret && appConfig.okx.passphrase)
    }

    return Boolean(appConfig.binance.apiKey && appConfig.binance.apiSecret)
  }

  private handleStatusChange(exchange: ExchangeCode, status: PrivateTradeStreamConnectionStatus, message?: string) {
    const now = new Date().toISOString()
    const current = this.getHealth(exchange)
    const nextReconnectCount = status === 'reconnecting' ? current.reconnectCount + 1 : current.reconnectCount

    this.healthByExchange.set(exchange, {
      ...current,
      enabled: this.isExchangeConfigured(exchange),
      status,
      reconnectCount: nextReconnectCount,
      lastStatusChangedAt: now,
      lastConnectedAt: status === 'connected' ? now : current.lastConnectedAt,
      lastDisconnectedAt: status === 'disconnected' || status === 'stopped' ? now : current.lastDisconnectedAt,
      lastErrorAt: status === 'error' ? now : current.lastErrorAt,
      lastErrorMessage: status === 'error' ? message : current.lastErrorMessage,
    })
    if (status === 'connected') {
      this.orderRecoveryService.markRecoveredByIdentityKey(
        `private_stream:exchange:${exchange}`,
        `${exchange.toUpperCase()} 私有推送连接已恢复`,
      )
    }
  }

  private updateStatus(exchange: ExchangeCode, status: PrivateTradeStreamConnectionStatus) {
    this.handleStatusChange(exchange, status)
  }

  private markOrderUpdate(exchange: ExchangeCode, updatedAt?: string) {
    const current = this.getHealth(exchange)
    this.healthByExchange.set(exchange, {
      ...current,
      lastOrderUpdateAt: updatedAt ?? new Date().toISOString(),
    })
  }

  private markBalanceUpdate(exchange: ExchangeCode, updatedAt?: string) {
    const current = this.getHealth(exchange)
    this.healthByExchange.set(exchange, {
      ...current,
      lastBalanceUpdateAt: updatedAt ?? new Date().toISOString(),
    })
  }

  private markError(exchange: ExchangeCode, message: string) {
    const now = new Date().toISOString()
    const current = this.getHealth(exchange)
    this.healthByExchange.set(exchange, {
      ...current,
      status: 'error',
      lastStatusChangedAt: now,
      lastErrorAt: now,
      lastErrorMessage: message,
    })
  }

  /** 统一包装交易环境标签解析，保留当前服务内部调用方式，降低本轮重构改动面。 */
  private resolveTradingEnvironmentLabel(exchange: ExchangeCode) {
    return resolveTradingEnvironmentLabel(exchange)
  }
}
