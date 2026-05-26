import { appConfig } from './config/env.js';
import { createServerRuntime } from './bootstrap/app.js';

const runtime = await createServerRuntime();

const shutdown = async (signal: NodeJS.Signals) => {
  runtime.app.log.info(`收到 ${signal} 退出信号，开始关闭 Web3 行情监控服务`);
  await runtime.close();
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

await runtime.app.listen({
  port: appConfig.port,
  host: '0.0.0.0'
});

runtime.services.strategyService.start();
runtime.app.log.info(`Web3 行情监控服务已启动，数据库位置：${appConfig.databasePath}`);
