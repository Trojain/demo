import { Decimal } from 'decimal.js';
import { nanoid } from 'nanoid';
import type { MonitorRule, RiskCheck, TradingSignal } from '../types/domain.js';
import type { RiskCheckRepository } from '../repositories/risk-check.repository.js';
import type { AuditLogService } from './audit-log.service.js';
import type { RiskConfigService } from './risk-config.service.js';

interface RiskServiceOptions {
  /** 是否允许真实交易，关闭时真实交易信号会被拒绝 */
  enableRealTrading: boolean;
}

interface CheckSignalInput {
  /** 待风控的交易信号 */
  signal: TradingSignal;
  /** 信号对应的监控规则 */
  rule: MonitorRule;
  /** 同规则是否已有待确认触发事件 */
  hasPendingTrigger: boolean;
}

interface RiskItem {
  /** 风控项编码，方便后续前端筛选 */
  code: string;
  /** 该风控项是否通过 */
  passed: boolean;
  /** 风控项说明 */
  message: string;
}

export class RiskService {
  constructor(
    private readonly riskCheckRepository: RiskCheckRepository,
    private readonly auditLogService: AuditLogService,
    private readonly riskConfigService: RiskConfigService,
    private readonly options: RiskServiceOptions
  ) {}

  checkSignal(input: CheckSignalInput): RiskCheck {
    const config = this.riskConfigService.getConfig();
    const quoteExposure = this.calculateQuoteExposure(input.signal);
    const marketAgeMs = Date.now() - new Date(input.signal.marketEventTime).getTime();
    const marketAgeValid = Number.isFinite(marketAgeMs) && marketAgeMs >= 0;
    const maxQuoteAmount = new Decimal(config.maxQuoteAmount);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dailyStats = this.riskCheckRepository.getPassedStatsSince(todayStart.toISOString());
    const nextDailyQuoteAmount = new Decimal(dailyStats.quoteAmount).plus(quoteExposure);

    const items: RiskItem[] = [
      {
        code: 'quote_amount_limit',
        passed: quoteExposure.lessThanOrEqualTo(maxQuoteAmount),
        message: `单笔计价金额 ${quoteExposure.toFixed()}，上限 ${maxQuoteAmount.toFixed()}`
      },
      {
        code: 'market_freshness',
        passed: marketAgeValid && marketAgeMs <= config.maxMarketAgeMs,
        message: marketAgeValid
          ? `行情延迟 ${marketAgeMs}ms，上限 ${config.maxMarketAgeMs}ms`
          : '行情时间无效'
      },
      {
        code: 'real_trading_switch',
        passed: input.signal.simulationMode || (this.options.enableRealTrading && config.tradingMode === 'allow_real'),
        message: input.signal.simulationMode ? '模拟交易允许通过' : `交易模式为 ${config.tradingMode}`
      },
      {
        code: 'trigger_limit',
        passed: input.rule.triggeredCount < input.rule.maxTriggerCount,
        message: `规则已触发 ${input.rule.triggeredCount}/${input.rule.maxTriggerCount}`
      },
      {
        code: 'pending_trigger',
        passed: !input.hasPendingTrigger,
        message: input.hasPendingTrigger ? '同规则已有待确认触发事件' : '同规则没有待确认触发事件'
      },
      {
        code: 'daily_trigger_count',
        passed: dailyStats.count + 1 <= config.dailyMaxTriggerCount,
        message: `今日风控通过次数 ${dailyStats.count + 1}/${config.dailyMaxTriggerCount}`
      },
      {
        code: 'daily_quote_amount',
        passed: nextDailyQuoteAmount.lessThanOrEqualTo(config.dailyMaxQuoteAmount),
        message: `今日累计计价金额 ${nextDailyQuoteAmount.toFixed()}，上限 ${config.dailyMaxQuoteAmount}`
      }
    ];

    const rejectedItems = items.filter((item) => !item.passed);
    const status = rejectedItems.length > 0 ? 'rejected' : 'passed';
    const reason = rejectedItems.length > 0 ? rejectedItems.map((item) => item.message).join('；') : '风控通过';

    const check = this.riskCheckRepository.create({
      id: nanoid(),
      signalId: input.signal.id,
      ruleId: input.signal.ruleId,
      exchange: input.signal.exchange,
      symbol: input.signal.symbol,
      status,
      reason,
      quoteExposure: quoteExposure.toFixed(),
      marketPrice: input.signal.marketPrice,
      itemsJson: JSON.stringify(items),
      createdAt: new Date().toISOString()
    });

    this.auditLogService.record({
      level: status === 'passed' ? 'info' : 'warning',
      action: status === 'passed' ? 'risk.passed' : 'risk.rejected',
      entityType: 'risk_check',
      entityId: check.id,
      ruleId: check.ruleId,
      message: `${check.symbol} ${status === 'passed' ? '风控通过' : `风控拒绝：${reason}`}`,
      payload: {
        signalId: check.signalId,
        quoteExposure: check.quoteExposure,
        marketPrice: check.marketPrice,
        riskConfig: config,
        items
      }
    });

    return check;
  }

  private calculateQuoteExposure(signal: TradingSignal) {
    if (signal.quoteAmount) {
      return new Decimal(signal.quoteAmount);
    }

    if (!signal.baseQuantity) {
      return new Decimal(0);
    }

    const price = signal.orderType === 'limit' && signal.limitPrice ? signal.limitPrice : signal.marketPrice;
    return new Decimal(signal.baseQuantity).mul(price);
  }
}
