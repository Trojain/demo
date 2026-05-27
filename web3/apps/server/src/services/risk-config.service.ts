import type { RiskConfig } from '../types/domain.js'
import type { RiskConfigRepository } from '../repositories/risk-config.repository.js'

export interface UpdateRiskConfigInput {
  /** 单笔最大计价金额 */
  maxQuoteAmount: string
  /** 行情最大允许延迟，单位毫秒 */
  maxMarketAgeMs: number
  /** 每日最大通过风控次数 */
  dailyMaxTriggerCount: number
  /** 每日最大通过风控计价金额 */
  dailyMaxQuoteAmount: string
  /** 交易模式 */
  tradingMode: RiskConfig['tradingMode']
}

export class RiskConfigService {
  constructor(
    private readonly riskConfigRepository: RiskConfigRepository,
    private readonly defaultConfig: UpdateRiskConfigInput,
  ) {}

  ensureDefault() {
    if (this.riskConfigRepository.get()) {
      return
    }

    this.update(this.defaultConfig)
  }

  getConfig(): RiskConfig {
    const config = this.riskConfigRepository.get()
    if (config) {
      return config
    }

    return this.update(this.defaultConfig)
  }

  update(input: UpdateRiskConfigInput): RiskConfig {
    return this.riskConfigRepository.save({
      ...input,
      updatedAt: new Date().toISOString(),
    })
  }
}
