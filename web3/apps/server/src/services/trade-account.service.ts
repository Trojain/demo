import { nanoid } from 'nanoid'
import type { ExchangeCode, TradeAccount, TradeAccountType, TradeFill, TradeOperationLog, TradePosition } from '../types/domain.js'
import type { TradeAccountRepository } from '../repositories/trade-account.repository.js'

interface TradeAccountDefaults {
  /** 默认模拟本金，当前按计价币种记账 */
  initialQuoteBalance: string
  /** 默认计价币种，当前建议保持 USDT */
  quoteCurrency: string
  /** 需要初始化模拟账户的交易所列表 */
  exchanges: ExchangeCode[]
}

export class TradeAccountService {
  constructor(
    private readonly tradeAccountRepository: TradeAccountRepository,
    private readonly defaults: TradeAccountDefaults,
  ) {}

  ensureDefaultSimulationAccounts(): TradeAccount[] {
    return this.defaults.exchanges.map(exchange => this.ensureDefaultSimulationAccount(exchange))
  }

  listAccounts(mode?: TradeAccountType): TradeAccount[] {
    return this.tradeAccountRepository.listAccounts(mode)
  }

  listPositions(mode?: TradeAccountType, exchange?: ExchangeCode): TradePosition[] {
    return this.tradeAccountRepository.listPositions(mode, exchange)
  }

  listFills(mode: TradeAccountType | undefined, exchange: ExchangeCode | undefined, limit: number): TradeFill[] {
    return this.tradeAccountRepository.listFills(mode, exchange, limit)
  }

  listOperationLogs(mode: TradeAccountType | undefined, exchange: ExchangeCode | undefined, limit: number): TradeOperationLog[] {
    return this.tradeAccountRepository.listOperationLogs(mode, exchange, limit)
  }

  private ensureDefaultSimulationAccount(exchange: ExchangeCode): TradeAccount {
    const quoteCurrency = this.defaults.quoteCurrency.toUpperCase()
    const current = this.tradeAccountRepository.findAccount('simulation', exchange, quoteCurrency)
    if (current) {
      return current
    }

    const now = new Date().toISOString()
    const account = this.tradeAccountRepository.createAccount({
      id: `simulation-${exchange}-${quoteCurrency.toLowerCase()}`,
      accountType: 'simulation',
      exchange,
      quoteCurrency,
      initialEquity: this.defaults.initialQuoteBalance,
      availableQuoteBalance: this.defaults.initialQuoteBalance,
      lockedQuoteBalance: '0',
      createdAt: now,
      updatedAt: now,
    })

    // 首次初始化写入模拟账户日志，后续买入、卖出和真实账户同步也复用同一日志表。
    this.tradeAccountRepository.createOperationLog({
      id: nanoid(),
      accountId: account.id,
      accountType: account.accountType,
      exchange: account.exchange,
      level: 'info',
      action: 'account.initialized',
      message: `${account.exchange.toUpperCase()} 模拟账户已初始化，初始本金 ${account.initialEquity} ${account.quoteCurrency}`,
      payloadJson: JSON.stringify({
        quoteCurrency: account.quoteCurrency,
        initialEquity: account.initialEquity,
      }),
      createdAt: now,
    })

    return account
  }
}
