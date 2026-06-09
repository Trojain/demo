import type { MonitorRule, RiskConfig, SignalSourceType } from '../types/domain.js'
import type { RuleRepository } from '../repositories/rule.repository.js'
import type { RiskConfigService, UpdateRiskConfigInput } from './risk-config.service.js'
import type { TradingRuleService } from './trading-rule.service.js'

export interface ConfigArchiveRule {
  /** 规则主键，导入时按该字段做幂等更新。 */
  id: string
  /** 交易所编码。 */
  exchange: MonitorRule['exchange']
  /** 统一交易对。 */
  symbol: string
  /** 触发方向。 */
  operator: MonitorRule['operator']
  /** 目标价格。 */
  targetPrice: string
  /** 检测频率，单位毫秒。 */
  checkIntervalMs: number
  /** 下单方向。 */
  side: MonitorRule['side']
  /** 订单类型。 */
  orderType: MonitorRule['orderType']
  /** 基础币数量。 */
  baseQuantity?: string
  /** 计价币金额。 */
  quoteAmount?: string
  /** 限价价格。 */
  limitPrice?: string
  /** 最大滑点百分比。 */
  maxSlippagePercent: string
  /** 冷却时间，单位毫秒。 */
  cooldownMs: number
  /** 最大触发次数。 */
  maxTriggerCount: number
  /** 是否模拟下单。 */
  simulationMode: boolean
  /** 是否启用。 */
  enabled: boolean
}

export interface ConfigArchivePayload {
  /** 归档类型，便于后续扩版本时快速识别。 */
  archiveType: 'web3-trading-config'
  /** 归档结构版本。 */
  schemaVersion: '1.0.0'
  /** 导出时间。 */
  exportedAt: string
  /** 归档元信息。 */
  meta: {
    /** 归档说明。 */
    description: string
    /** 当前支持的交易所。 */
    supportedExchanges: Array<MonitorRule['exchange']>
    /** 当前支持的信号来源类型。 */
    supportedSignalSources: SignalSourceType[]
  }
  /** 风控配置快照。 */
  riskConfig: UpdateRiskConfigInput
  /** 规则配置列表。 */
  rules: ConfigArchiveRule[]
}

export interface ImportConfigArchiveResult {
  /** 是否覆盖了风控配置。 */
  riskConfigUpdated: boolean
  /** 新增规则数量。 */
  createdRuleCount: number
  /** 更新规则数量。 */
  updatedRuleCount: number
  /** 导入后被暂停的规则数量。 */
  pausedRuleCount: number
}

export interface ImportConfigArchiveInput {
  /** 待导入的配置归档。 */
  archive: ConfigArchivePayload
  /** 是否默认暂停导入规则，防止导入后立刻开始执行。 */
  pauseImportedRules: boolean
  /** 是否覆盖现有风控配置。 */
  overwriteRiskConfig: boolean
}

/**
 * 配置归档服务。
 * 负责规则与风控配置的导出、导入以及归档结构校验后的幂等写入。
 */
export class ConfigArchiveService {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly riskConfigService: RiskConfigService,
    private readonly tradingRuleService: TradingRuleService,
  ) {}

  exportArchive(): ConfigArchivePayload {
    const riskConfig = this.riskConfigService.getConfig()
    const rules = this.ruleRepository.list().map(rule => this.toArchiveRule(rule))

    return {
      archiveType: 'web3-trading-config',
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      meta: {
        description: '监控规则与风控配置归档，不包含交易所私钥和运行态数据',
        supportedExchanges: ['okx', 'binance'],
        supportedSignalSources: ['price_rule', 'external_input', 'polymarket_lag'],
      },
      riskConfig: this.toRiskConfigInput(riskConfig),
      rules,
    }
  }

  async importArchive(input: ImportConfigArchiveInput): Promise<ImportConfigArchiveResult> {
    const normalizedRules = input.archive.rules.map(rule => this.normalizeRule(rule))
    this.assertUniqueRuleIds(normalizedRules)

    for (const rule of normalizedRules) {
      await this.tradingRuleService.validateMonitorRule(rule)
    }

    const now = new Date().toISOString()

    return this.ruleRepository.runInTransaction(() => {
      let createdRuleCount = 0
      let updatedRuleCount = 0
      let pausedRuleCount = 0

      if (input.overwriteRiskConfig) {
        this.riskConfigService.update(input.archive.riskConfig)
      }

      for (const rule of normalizedRules) {
        const nextEnabled = input.pauseImportedRules ? false : rule.enabled
        if (rule.enabled && !nextEnabled) {
          pausedRuleCount += 1
        }

        const persistedRule: MonitorRule = {
          id: rule.id,
          exchange: rule.exchange,
          symbol: rule.symbol,
          operator: rule.operator,
          targetPrice: rule.targetPrice,
          checkIntervalMs: rule.checkIntervalMs,
          side: rule.side,
          orderType: rule.orderType,
          baseQuantity: rule.baseQuantity,
          quoteAmount: rule.quoteAmount,
          limitPrice: rule.limitPrice,
          maxSlippagePercent: rule.maxSlippagePercent,
          cooldownMs: rule.cooldownMs,
          maxTriggerCount: rule.maxTriggerCount,
          triggeredCount: 0,
          simulationMode: rule.simulationMode,
          enabled: nextEnabled,
          runtimeStatus: nextEnabled ? 'idle' : 'paused',
          lastErrorMessage: undefined,
          lastCheckedAt: undefined,
          lastTriggeredAt: undefined,
          createdAt: now,
          updatedAt: now,
        }

        const current = this.ruleRepository.findById(rule.id)
        if (current) {
          this.ruleRepository.update({
            ...current,
            ...persistedRule,
            createdAt: current.createdAt,
          })
          updatedRuleCount += 1
          continue
        }

        this.ruleRepository.create(persistedRule)
        createdRuleCount += 1
      }

      return {
        riskConfigUpdated: input.overwriteRiskConfig,
        createdRuleCount,
        updatedRuleCount,
        pausedRuleCount,
      }
    })
  }

  private toArchiveRule(rule: MonitorRule): ConfigArchiveRule {
    return {
      id: rule.id,
      exchange: rule.exchange,
      symbol: rule.symbol,
      operator: rule.operator,
      targetPrice: rule.targetPrice,
      checkIntervalMs: rule.checkIntervalMs,
      side: rule.side,
      orderType: rule.orderType,
      baseQuantity: rule.baseQuantity,
      quoteAmount: rule.quoteAmount,
      limitPrice: rule.limitPrice,
      maxSlippagePercent: rule.maxSlippagePercent,
      cooldownMs: rule.cooldownMs,
      maxTriggerCount: rule.maxTriggerCount,
      simulationMode: rule.simulationMode,
      enabled: rule.enabled,
    }
  }

  private toRiskConfigInput(config: RiskConfig): UpdateRiskConfigInput {
    return {
      maxQuoteAmount: config.maxQuoteAmount,
      maxMarketAgeMs: config.maxMarketAgeMs,
      dailyMaxTriggerCount: config.dailyMaxTriggerCount,
      dailyMaxQuoteAmount: config.dailyMaxQuoteAmount,
      tradingMode: config.tradingMode,
    }
  }

  private normalizeRule(rule: ConfigArchiveRule): ConfigArchiveRule {
    return {
      ...rule,
      symbol: rule.symbol.trim().toUpperCase(),
      targetPrice: rule.targetPrice.trim(),
      baseQuantity: rule.baseQuantity?.trim() || undefined,
      quoteAmount: rule.quoteAmount?.trim() || undefined,
      limitPrice: rule.limitPrice?.trim() || undefined,
      maxSlippagePercent: rule.maxSlippagePercent.trim(),
    }
  }

  private assertUniqueRuleIds(rules: ConfigArchiveRule[]) {
    const seen = new Set<string>()
    for (const rule of rules) {
      if (seen.has(rule.id)) {
        throw new Error(`导入归档存在重复规则 ID: ${rule.id}`)
      }
      seen.add(rule.id)
    }
  }
}
