import { nanoid } from 'nanoid';
import type { ExchangeFactory } from '../exchange/exchange-factory.js';
import type { OrderRepository } from '../repositories/order.repository.js';
import type { RuleRepository } from '../repositories/rule.repository.js';
import type { TriggerRepository } from '../repositories/trigger.repository.js';
import type { OrderRecord } from '../types/domain.js';
import { appConfig } from '../config/env.js';

export class OrderService {
  constructor(
    private readonly exchangeFactory: ExchangeFactory,
    private readonly ruleRepository: RuleRepository,
    private readonly triggerRepository: TriggerRepository,
    private readonly orderRepository: OrderRepository
  ) {}

  async confirmTrigger(triggerId: string): Promise<OrderRecord> {
    const trigger = this.triggerRepository.findById(triggerId);
    if (!trigger) {
      throw new Error('触发事件不存在');
    }

    if (trigger.status !== 'pending') {
      throw new Error('触发事件已经处理，不能重复确认');
    }

    const rule = this.ruleRepository.findById(trigger.ruleId);
    if (!rule) {
      throw new Error('关联监控规则不存在');
    }

    const simulationMode = rule.simulationMode || !appConfig.enableRealTrading;
    const adapter = this.exchangeFactory.getAdapter(rule.exchange);
    const result = await adapter.placeOrder({
      symbol: rule.symbol,
      side: rule.side,
      type: rule.orderType,
      baseQuantity: rule.baseQuantity,
      quoteAmount: rule.quoteAmount,
      price: rule.limitPrice,
      clientOrderId: `web3-${nanoid(18)}`,
      simulationMode
    });

    const order = this.orderRepository.create({
      id: nanoid(),
      triggerId,
      ruleId: rule.id,
      exchange: rule.exchange,
      symbol: rule.symbol,
      side: rule.side,
      orderType: rule.orderType,
      baseQuantity: rule.baseQuantity,
      quoteAmount: rule.quoteAmount,
      price: rule.limitPrice,
      exchangeOrderId: result.exchangeOrderId,
      status: result.status,
      simulationMode,
      rawMessage: result.rawMessage,
      createdAt: new Date().toISOString()
    });

    this.triggerRepository.markConfirmed(triggerId);
    return order;
  }
}
