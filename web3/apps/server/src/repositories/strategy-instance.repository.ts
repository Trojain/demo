import type Database from 'better-sqlite3'
import type { MonitorRule, StrategyInstance, StrategyVersion } from '../types/domain.js'

type StrategyInstanceRow = {
  id: string
  name: string
  source_type: StrategyInstance['sourceType']
  rule_id?: string | null
  status: StrategyInstance['status']
  current_version_id?: string | null
  params_json: string
  created_at: string
  updated_at: string
}

type StrategyVersionRow = {
  id: string
  strategy_id: string
  version: number
  params_json: string
  change_reason: string
  created_at: string
}

function mapStrategy(row: StrategyInstanceRow): StrategyInstance {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    ruleId: row.rule_id ?? undefined,
    status: row.status,
    currentVersionId: row.current_version_id ?? undefined,
    paramsJson: row.params_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapVersion(row: StrategyVersionRow): StrategyVersion {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    version: row.version,
    paramsJson: row.params_json,
    changeReason: row.change_reason,
    createdAt: row.created_at,
  }
}

export class StrategyInstanceRepository {
  constructor(private readonly db: Database.Database) {}

  findById(id: string): StrategyInstance | undefined {
    const row = this.db.prepare('SELECT * FROM strategy_instances WHERE id = ? LIMIT 1').get(id) as StrategyInstanceRow | undefined
    return row ? mapStrategy(row) : undefined
  }

  findByRuleId(ruleId: string): StrategyInstance | undefined {
    const row = this.db.prepare('SELECT * FROM strategy_instances WHERE rule_id = ? LIMIT 1').get(ruleId) as StrategyInstanceRow | undefined
    return row ? mapStrategy(row) : undefined
  }

  findCurrentVersion(strategyId: string): StrategyVersion | undefined {
    const row = this.db
      .prepare(
        `SELECT v.*
         FROM strategy_versions v
         JOIN strategy_instances s ON s.current_version_id = v.id
         WHERE s.id = ?
         LIMIT 1`,
      )
      .get(strategyId) as StrategyVersionRow | undefined
    return row ? mapVersion(row) : undefined
  }

  createWithVersion(input: {
    strategy: StrategyInstance
    version: StrategyVersion
  }) {
    this.db
      .prepare(
        `INSERT INTO strategy_instances (
          id, name, source_type, rule_id, status, current_version_id, params_json, created_at, updated_at
        ) VALUES (
          @id, @name, @sourceType, @ruleId, @status, @currentVersionId, @paramsJson, @createdAt, @updatedAt
        )`,
      )
      .run({
        ...input.strategy,
        ruleId: input.strategy.ruleId ?? null,
        currentVersionId: input.strategy.currentVersionId ?? null,
      })

    this.createVersion(input.version)
    return input.strategy
  }

  createVersion(version: StrategyVersion): StrategyVersion {
    this.db
      .prepare(
        `INSERT INTO strategy_versions (
          id, strategy_id, version, params_json, change_reason, created_at
        ) VALUES (
          @id, @strategyId, @version, @paramsJson, @changeReason, @createdAt
        )`,
      )
      .run(version)

    this.db
      .prepare('UPDATE strategy_instances SET current_version_id = ?, params_json = ?, updated_at = ? WHERE id = ?')
      .run(version.id, version.paramsJson, version.createdAt, version.strategyId)

    return version
  }

  updateStatus(id: string, status: StrategyInstance['status']): StrategyInstance | undefined {
    this.db.prepare('UPDATE strategy_instances SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), id)
    return this.findById(id)
  }

  /**
   * 价格规则对应的策略参数快照只保存业务必要字段，避免把交易所密钥等敏感配置写入策略版本。
   */
  buildRuleParamsJson(rule: MonitorRule) {
    return JSON.stringify({
      ruleId: rule.id,
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
    })
  }

  runInTransaction<T>(callback: () => T): T {
    return this.db.transaction(callback)()
  }
}
