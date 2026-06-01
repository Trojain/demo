import { Decimal } from 'decimal.js'
import type { CreateRuleInput } from '../routes/dto.js'
import type { ExchangeCode } from '../types/domain.js'
import type { InstrumentRule } from '../types/exchange.js'
import type { ExchangeFactory } from '../exchange/exchange-factory.js'

const INSTRUMENT_RULE_CACHE_TTL_MS = 10 * 60 * 1000

export class RuleValidationError extends Error {
  constructor(public readonly issues: Array<{ path: string; message: string }>) {
    super('交易规则校验失败')
  }
}

interface InstrumentRuleCacheItem {
  /** 缓存写入时间，用于控制交易规则刷新频率 */
  cachedAt: number
  /** 交易所返回的现货交易规则 */
  rules: InstrumentRule[]
}

export class TradingRuleService {
  private readonly cache = new Map<ExchangeCode, InstrumentRuleCacheItem>()

  constructor(private readonly exchangeFactory: ExchangeFactory) {}

  async listInstrumentRules(exchange: ExchangeCode) {
    return this.getInstrumentRules(exchange)
  }

  async validateMonitorRule(input: CreateRuleInput) {
    const normalizedSymbol = input.symbol.trim().toUpperCase()
    const rules = await this.getInstrumentRules(input.exchange)
    const instrumentRule = rules.find(rule => rule.symbol === normalizedSymbol)
    const issues: Array<{ path: string; message: string }> = []

    if (!instrumentRule) {
      throw new RuleValidationError([{ path: 'symbol', message: '交易对不存在或暂不支持' }])
    }

    if (instrumentRule.state !== 'live') {
      issues.push({ path: 'symbol', message: `交易对当前状态为 ${instrumentRule.state}，暂不可交易` })
    }

    this.validatePositiveDecimal(input.targetPrice, 'targetPrice', '目标价格', issues)
    this.validateStep(input.targetPrice, instrumentRule.tickSize, 'targetPrice', '目标价格', issues)

    if (input.orderType === 'limit' && input.limitPrice) {
      this.validatePositiveDecimal(input.limitPrice, 'limitPrice', '限价价格', issues)
      this.validateStep(input.limitPrice, instrumentRule.tickSize, 'limitPrice', '限价价格', issues)
    }

    if (input.baseQuantity) {
      const quantityStep = this.resolveQuantityStep(input.exchange, input.orderType, instrumentRule)
      const minQuantity = this.resolveMinQuantity(input.exchange, input.orderType, instrumentRule)
      this.validatePositiveDecimal(input.baseQuantity, 'baseQuantity', '基础币数量', issues)
      this.validateStep(input.baseQuantity, quantityStep, 'baseQuantity', '基础币数量', issues)
      if (new Decimal(input.baseQuantity).lessThan(minQuantity)) {
        issues.push({ path: 'baseQuantity', message: `基础币数量不能小于最小下单数量 ${minQuantity}` })
      }
    }

    if (input.quoteAmount) {
      this.validatePositiveDecimal(input.quoteAmount, 'quoteAmount', '计价币金额', issues)
      if (!this.usesQuoteOrderSizing(input.orderType, input.baseQuantity, input.quoteAmount)) {
        const minQuantity = this.resolveMinQuantity(input.exchange, input.orderType, instrumentRule)
        try {
          const estimatedBaseQuantity = new Decimal(input.quoteAmount).div(input.targetPrice)
          if (estimatedBaseQuantity.lessThan(minQuantity)) {
            issues.push({
              path: 'quoteAmount',
              message: `按目标价估算的基础币数量不能小于最小下单数量 ${minQuantity}`,
            })
          }
        } catch {
          issues.push({ path: 'quoteAmount', message: '计价币金额估算失败，请检查目标价格和计价币金额' })
        }
      }
    }

    if (instrumentRule.minNotional) {
      const estimatedNotional = this.estimateNotional(input.targetPrice, input.baseQuantity, input.quoteAmount)
      if (estimatedNotional && estimatedNotional.lessThan(instrumentRule.minNotional)) {
        issues.push({ path: 'quoteAmount', message: `预估成交额不能小于最小成交额 ${instrumentRule.minNotional}` })
      }
    }

    this.validatePositiveDecimal(input.maxSlippagePercent, 'maxSlippagePercent', '最大滑点百分比', issues)

    if (issues.length > 0) {
      throw new RuleValidationError(issues)
    }

    return instrumentRule
  }

  private async getInstrumentRules(exchange: ExchangeCode) {
    const cached = this.cache.get(exchange)
    if (cached && Date.now() - cached.cachedAt < INSTRUMENT_RULE_CACHE_TTL_MS) {
      return cached.rules
    }

    const adapter = this.exchangeFactory.getAdapter(exchange)
    if (!adapter.getInstrumentRules) {
      throw new RuleValidationError([{ path: 'exchange', message: '当前交易所交易规则校验尚未接入' }])
    }

    const rules = await adapter.getInstrumentRules()
    this.cache.set(exchange, {
      cachedAt: Date.now(),
      rules,
    })

    return rules
  }

  private validatePositiveDecimal(value: string, path: string, label: string, issues: Array<{ path: string; message: string }>) {
    try {
      if (!new Decimal(value).isFinite() || new Decimal(value).lessThanOrEqualTo(0)) {
        issues.push({ path, message: `${label}必须大于 0` })
      }
    } catch {
      issues.push({ path, message: `${label}格式不合法` })
    }
  }

  private validateStep(value: string, step: string, path: string, label: string, issues: Array<{ path: string; message: string }>) {
    try {
      const decimalValue = new Decimal(value)
      const decimalStep = new Decimal(step)
      if (decimalStep.greaterThan(0) && !decimalValue.mod(decimalStep).isZero()) {
        issues.push({ path, message: `${label}必须符合步长 ${step}` })
      }
    } catch {
      issues.push({ path, message: `${label}步长校验失败` })
    }
  }

  private estimateNotional(targetPrice: string, baseQuantity?: string, quoteAmount?: string) {
    try {
      if (quoteAmount) {
        return new Decimal(quoteAmount)
      }

      if (baseQuantity) {
        return new Decimal(baseQuantity).mul(targetPrice)
      }
    } catch {
      return undefined
    }

    return undefined
  }

  private resolveQuantityStep(exchange: ExchangeCode, orderType: CreateRuleInput['orderType'], instrumentRule: InstrumentRule) {
    if (exchange === 'binance' && orderType === 'market') {
      return instrumentRule.marketLotSize ?? instrumentRule.lotSize
    }

    return instrumentRule.lotSize
  }

  private resolveMinQuantity(exchange: ExchangeCode, orderType: CreateRuleInput['orderType'], instrumentRule: InstrumentRule) {
    if (exchange === 'binance' && orderType === 'market') {
      return instrumentRule.marketMinSize ?? instrumentRule.minSize
    }

    return instrumentRule.minSize
  }

  private usesQuoteOrderSizing(orderType: CreateRuleInput['orderType'], baseQuantity?: string, quoteAmount?: string) {
    // 市价单按计价币金额下单时，交易所最终成交的基础币数量由撮合结果决定，不能再用估算值反推数量步长做硬校验。
    return orderType === 'market' && !baseQuantity && Boolean(quoteAmount)
  }
}
