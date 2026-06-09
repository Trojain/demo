import { nanoid } from 'nanoid'
import type { MonitorRule, StrategyInstance, StrategyVersion } from '../types/domain.js'
import type { StrategyInstanceRepository } from '../repositories/strategy-instance.repository.js'

export class StrategyInstanceService {
  constructor(private readonly strategyInstanceRepository: StrategyInstanceRepository) {}

  ensureForRule(rule: MonitorRule, changeReason: 'create' | 'update' | 'migration' = 'create') {
    const current = this.strategyInstanceRepository.findByRuleId(rule.id)
    if (current) {
      const version = this.createNextVersion(current, rule, changeReason)
      return {
        strategy: current,
        version,
      }
    }

    const now = new Date().toISOString()
    const strategyId = rule.strategyId ?? nanoid()
    const versionId = rule.strategyVersionId ?? nanoid()
    const paramsJson = this.strategyInstanceRepository.buildRuleParamsJson(rule)
    const strategy: StrategyInstance = {
      id: strategyId,
      name: `${rule.symbol} 价格规则策略`,
      sourceType: 'price_rule',
      ruleId: rule.id,
      status: rule.enabled ? 'active' : 'paused',
      currentVersionId: versionId,
      paramsJson,
      createdAt: now,
      updatedAt: now,
    }
    const version: StrategyVersion = {
      id: versionId,
      strategyId,
      version: 1,
      paramsJson,
      changeReason,
      createdAt: now,
    }

    return this.strategyInstanceRepository.runInTransaction(() => {
      this.strategyInstanceRepository.createWithVersion({ strategy, version })
      return {
        strategy,
        version,
      }
    })
  }

  updateStatusForRule(rule: MonitorRule) {
    if (!rule.strategyId) {
      return undefined
    }

    return this.strategyInstanceRepository.updateStatus(rule.strategyId, rule.enabled ? 'active' : 'paused')
  }

  private createNextVersion(strategy: StrategyInstance, rule: MonitorRule, changeReason: 'create' | 'update' | 'migration') {
    const currentVersion = this.strategyInstanceRepository.findCurrentVersion(strategy.id)
    const nextVersionNumber = (currentVersion?.version ?? 0) + 1
    const now = new Date().toISOString()
    const version: StrategyVersion = {
      id: nanoid(),
      strategyId: strategy.id,
      version: nextVersionNumber,
      paramsJson: this.strategyInstanceRepository.buildRuleParamsJson(rule),
      changeReason,
      createdAt: now,
    }

    this.strategyInstanceRepository.createVersion(version)
    this.strategyInstanceRepository.updateStatus(strategy.id, rule.enabled ? 'active' : 'paused')
    return version
  }
}
