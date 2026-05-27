import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { appConfig } from '../config/env.js';
import { createDatabase } from '../database/database.js';
import { ExchangeFactory } from '../exchange/exchange-factory.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { OrderRepository } from '../repositories/order.repository.js';
import { RiskCheckRepository } from '../repositories/risk-check.repository.js';
import { RiskConfigRepository } from '../repositories/risk-config.repository.js';
import { RuleRepository } from '../repositories/rule.repository.js';
import { SignalRepository } from '../repositories/signal.repository.js';
import { TriggerRepository } from '../repositories/trigger.repository.js';
import { registerApiRoutes } from '../routes/api.routes.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { MarketCapService } from '../services/market-cap.service.js';
import { MarketService } from '../services/market.service.js';
import { NotificationService } from '../services/notification.service.js';
import { OrderPreviewService } from '../services/order-preview.service.js';
import { OrderService } from '../services/order.service.js';
import { RiskConfigService } from '../services/risk-config.service.js';
import { RiskService } from '../services/risk.service.js';
import { SignalService } from '../services/signal.service.js';
import { StrategyService } from '../services/strategy.service.js';
import { TradingRuleService } from '../services/trading-rule.service.js';

export interface ServerRuntime {
  app: FastifyInstance;
  services: {
    strategyService: StrategyService;
  };
  close: () => Promise<void>;
}

export async function createServerRuntime(): Promise<ServerRuntime> {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const app = Fastify({
    logger: isDevelopment
      ? {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
              ignore: 'pid,hostname'
            }
          }
        }
      : {
          level: 'info'
        }
  });

  await app.register(cors, {
    origin: true
  });

  const db = createDatabase(appConfig.databasePath);
  const exchangeFactory = new ExchangeFactory();
  const ruleRepository = new RuleRepository(db);
  const riskCheckRepository = new RiskCheckRepository(db);
  const riskConfigRepository = new RiskConfigRepository(db);
  const signalRepository = new SignalRepository(db);
  const triggerRepository = new TriggerRepository(db);
  const orderRepository = new OrderRepository(db);
  const auditLogRepository = new AuditLogRepository(db);
  const notificationService = new NotificationService();
  const auditLogService = new AuditLogService(auditLogRepository);
  const marketCapService = new MarketCapService();
  const marketService = new MarketService(exchangeFactory, marketCapService);
  const tradingRuleService = new TradingRuleService(exchangeFactory);
  const riskConfigService = new RiskConfigService(riskConfigRepository, {
    maxQuoteAmount: appConfig.risk.maxQuoteAmount,
    maxMarketAgeMs: appConfig.risk.maxMarketAgeMs,
    dailyMaxTriggerCount: appConfig.risk.dailyMaxTriggerCount,
    dailyMaxQuoteAmount: appConfig.risk.dailyMaxQuoteAmount,
    tradingMode: appConfig.risk.tradingMode
  });
  riskConfigService.ensureDefault();
  const riskService = new RiskService(riskCheckRepository, auditLogService, riskConfigService, {
    enableRealTrading: appConfig.enableRealTrading,
  });
  const signalService = new SignalService(signalRepository, triggerRepository, auditLogService, riskService);
  const orderPreviewService = new OrderPreviewService(ruleRepository, triggerRepository, riskCheckRepository, marketService, riskConfigService, tradingRuleService);
  const orderService = new OrderService(exchangeFactory, ruleRepository, triggerRepository, orderRepository, auditLogService);
  const strategyService = new StrategyService(ruleRepository, marketService, notificationService, auditLogService, signalService);

  await registerApiRoutes(app, {
    auditLogRepository,
    auditLogService,
    exchangeFactory,
    marketService,
    orderPreviewService,
    orderService,
    orderRepository,
    riskCheckRepository,
    riskConfigService,
    ruleRepository,
    signalRepository,
    signalService,
    tradingRuleService,
    triggerRepository
  });

  // WebSocket 依赖 Fastify 底层 http server，需要在路由注册后绑定到同一个服务实例。
  notificationService.bind(app.server);

  let closed = false;

  return {
    app,
    services: {
      strategyService
    },
    close: async () => {
      if (closed) {
        return;
      }

      closed = true;
      // 先停止策略扫描，再关闭 HTTP 服务和数据库，避免退出期间继续产生数据库写入。
      strategyService.stop();
      await app.close();
      db.close();
    }
  };
}
