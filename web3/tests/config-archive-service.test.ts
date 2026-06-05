import test from 'node:test'
import assert from 'node:assert/strict'
import { ConfigArchiveService, type ConfigArchivePayload } from '../apps/server/src/services/config-archive.service.ts'
import { RiskConfigService, type UpdateRiskConfigInput } from '../apps/server/src/services/risk-config.service.ts'
import type { MonitorRule, RiskConfig } from '../apps/server/src/types/domain.js'

class InMemoryRuleRepository {
  private readonly rules = new Map<string, MonitorRule>()

  list() {
    return [...this.rules.values()]
  }

  findById(id: string) {
    return this.rules.get(id)
  }

  create(rule: MonitorRule) {
    this.rules.set(rule.id, rule)
    return rule
  }

  update(rule: MonitorRule) {
    this.rules.set(rule.id, rule)
    return rule
  }

  runInTransaction<T>(callback: () => T): T {
    return callback()
  }
}

class InMemoryRiskConfigRepository {
  private config?: RiskConfig

  get() {
    return this.config
  }

  save(config: RiskConfig) {
    this.config = config
    return config
  }
}

class StubTradingRuleService {
  readonly validatedRules: Array<Pick<MonitorRule, 'id' | 'symbol'>> = []

  async validateMonitorRule(rule: Pick<MonitorRule, 'id' | 'symbol'>) {
    this.validatedRules.push({ id: rule.id, symbol: rule.symbol })
  }
}

const defaultRiskConfig: UpdateRiskConfigInput = {
  maxQuoteAmount: '500',
  maxMarketAgeMs: 5_000,
  dailyMaxTriggerCount: 10,
  dailyMaxQuoteAmount: '2000',
  tradingMode: 'simulation_only',
}

function createRule(overrides?: Partial<MonitorRule>): MonitorRule {
  const now = '2026-06-05T08:00:00.000Z'
  return {
    id: 'rule-1',
    exchange: 'okx',
    symbol: 'BTC-USDT',
    operator: 'gte',
    targetPrice: '70000',
    checkIntervalMs: 3000,
    side: 'buy',
    orderType: 'market',
    baseQuantity: undefined,
    quoteAmount: '50',
    limitPrice: undefined,
    maxSlippagePercent: '0.5',
    cooldownMs: 60_000,
    maxTriggerCount: 1,
    triggeredCount: 3,
    simulationMode: true,
    enabled: true,
    runtimeStatus: 'running',
    lastErrorMessage: 'old error',
    lastCheckedAt: now,
    lastTriggeredAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function createArchive(overrides?: Partial<ConfigArchivePayload>): ConfigArchivePayload {
  return {
    archiveType: 'web3-trading-config',
    schemaVersion: '1.0.0',
    exportedAt: '2026-06-05T08:30:00.000Z',
    meta: {
      description: '测试配置归档',
      supportedExchanges: ['okx', 'binance'],
      supportedSignalSources: ['price_rule', 'external_input'],
    },
    riskConfig: {
      maxQuoteAmount: '1000',
      maxMarketAgeMs: 8_000,
      dailyMaxTriggerCount: 15,
      dailyMaxQuoteAmount: '5000',
      tradingMode: 'allow_real',
    },
    rules: [
      {
        id: 'rule-1',
        exchange: 'okx',
        symbol: 'eth-usdt',
        operator: 'lte',
        targetPrice: '3500',
        checkIntervalMs: 5000,
        side: 'sell',
        orderType: 'limit',
        baseQuantity: '0.2',
        quoteAmount: undefined,
        limitPrice: '3499',
        maxSlippagePercent: '0.3',
        cooldownMs: 120_000,
        maxTriggerCount: 2,
        simulationMode: false,
        enabled: true,
      },
    ],
    ...overrides,
  }
}

function createService() {
  const ruleRepository = new InMemoryRuleRepository()
  const riskConfigRepository = new InMemoryRiskConfigRepository()
  const riskConfigService = new RiskConfigService(riskConfigRepository as never, defaultRiskConfig)
  const tradingRuleService = new StubTradingRuleService()
  const service = new ConfigArchiveService(
    ruleRepository as never,
    riskConfigService,
    tradingRuleService as never,
  )

  return {
    service,
    ruleRepository,
    riskConfigService,
    tradingRuleService,
  }
}

test('ConfigArchiveService.exportArchive 会导出规则与风控配置快照', () => {
  const { service, ruleRepository, riskConfigService } = createService()
  ruleRepository.create(createRule())
  riskConfigService.update({
    maxQuoteAmount: '800',
    maxMarketAgeMs: 6000,
    dailyMaxTriggerCount: 12,
    dailyMaxQuoteAmount: '3200',
    tradingMode: 'allow_real',
  })

  const archive = service.exportArchive()

  assert.equal(archive.archiveType, 'web3-trading-config')
  assert.equal(archive.rules.length, 1)
  assert.equal(archive.rules[0]?.id, 'rule-1')
  assert.equal(archive.riskConfig.maxQuoteAmount, '800')
  assert.deepEqual(archive.meta.supportedSignalSources, ['price_rule', 'external_input'])
})

test('ConfigArchiveService.importArchive 会按规则 ID 幂等更新并默认暂停导入规则', async () => {
  const { service, ruleRepository, riskConfigService, tradingRuleService } = createService()
  ruleRepository.create(createRule())

  const result = await service.importArchive({
    archive: createArchive(),
    pauseImportedRules: true,
    overwriteRiskConfig: true,
  })

  const importedRule = ruleRepository.findById('rule-1')
  assert.ok(importedRule)
  assert.equal(result.createdRuleCount, 0)
  assert.equal(result.updatedRuleCount, 1)
  assert.equal(result.pausedRuleCount, 1)
  assert.equal(importedRule?.symbol, 'ETH-USDT')
  assert.equal(importedRule?.enabled, false)
  assert.equal(importedRule?.runtimeStatus, 'paused')
  assert.equal(importedRule?.triggeredCount, 0)
  assert.equal(importedRule?.lastErrorMessage, undefined)
  assert.equal(riskConfigService.getConfig().tradingMode, 'allow_real')
  assert.equal(tradingRuleService.validatedRules.length, 1)
})

test('ConfigArchiveService.importArchive 在不覆盖风控时保留现有配置并创建新规则', async () => {
  const { service, ruleRepository, riskConfigService } = createService()
  riskConfigService.update({
    maxQuoteAmount: '600',
    maxMarketAgeMs: 4_000,
    dailyMaxTriggerCount: 8,
    dailyMaxQuoteAmount: '1600',
    tradingMode: 'simulation_only',
  })

  const result = await service.importArchive({
    archive: createArchive({
      rules: [
        {
          id: 'rule-2',
          exchange: 'binance',
          symbol: 'SOL-USDT',
          operator: 'gte',
          targetPrice: '180',
          checkIntervalMs: 3000,
          side: 'buy',
          orderType: 'market',
          baseQuantity: undefined,
          quoteAmount: '120',
          limitPrice: undefined,
          maxSlippagePercent: '0.8',
          cooldownMs: 45_000,
          maxTriggerCount: 3,
          simulationMode: true,
          enabled: true,
        },
      ],
    }),
    pauseImportedRules: false,
    overwriteRiskConfig: false,
  })

  const importedRule = ruleRepository.findById('rule-2')
  assert.ok(importedRule)
  assert.equal(result.riskConfigUpdated, false)
  assert.equal(result.createdRuleCount, 1)
  assert.equal(importedRule?.enabled, true)
  assert.equal(importedRule?.runtimeStatus, 'idle')
  assert.equal(riskConfigService.getConfig().maxQuoteAmount, '600')
})

test('ConfigArchiveService.importArchive 遇到重复规则 ID 时拒绝写入', async () => {
  const { service, ruleRepository } = createService()

  await assert.rejects(
    () =>
      service.importArchive({
        archive: createArchive({
          rules: [
            createArchive().rules[0]!,
            { ...createArchive().rules[0]! },
          ],
        }),
        pauseImportedRules: true,
        overwriteRiskConfig: true,
      }),
    /重复规则 ID/,
  )

  assert.equal(ruleRepository.list().length, 0)
})
