import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { appConfig } from '../config/env.js';
import { createDatabase } from '../database/database.js';
import { ExchangeFactory } from '../exchange/exchange-factory.js';
import { OrderRepository } from '../repositories/order.repository.js';
import { RuleRepository } from '../repositories/rule.repository.js';
import { TriggerRepository } from '../repositories/trigger.repository.js';
import { registerApiRoutes } from '../routes/api.routes.js';
import { MarketService } from '../services/market.service.js';
import { NotificationService } from '../services/notification.service.js';
import { OrderService } from '../services/order.service.js';
import { StrategyService } from '../services/strategy.service.js';

export interface ServerRuntime {
  app: FastifyInstance;
  services: {
    strategyService: StrategyService;
  };
  close: () => Promise<void>;
}

export async function createServerRuntime(): Promise<ServerRuntime> {
  const app = Fastify({
    logger: {
      level: 'info'
    }
  });

  await app.register(cors, {
    origin: true
  });

  const db = createDatabase(appConfig.databasePath);
  const exchangeFactory = new ExchangeFactory();
  const ruleRepository = new RuleRepository(db);
  const triggerRepository = new TriggerRepository(db);
  const orderRepository = new OrderRepository(db);
  const notificationService = new NotificationService();
  const marketService = new MarketService(exchangeFactory);
  const orderService = new OrderService(exchangeFactory, ruleRepository, triggerRepository, orderRepository);
  const strategyService = new StrategyService(ruleRepository, triggerRepository, marketService, notificationService);

  await registerApiRoutes(app, {
    exchangeFactory,
    marketService,
    orderService,
    orderRepository,
    ruleRepository,
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
