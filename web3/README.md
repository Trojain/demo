# Web3 行情监控与半自动下单工具

本项目是一个本地运行的 Web3 量化交易执行工具，当前聚焦 OKX、Binance 两个交易所的行情接入、规则监控、信号归档、风控校验、模拟交易、真实交易前置能力、恢复任务和审计闭环。前端负责规则配置、总览、交易操作、恢复中心和日志展示，后端负责行情接入、规则扫描、执行编排、SQLite 持久化与交易所适配。

## 1. 项目概览

| 项目项 | 当前状态 |
| --- | --- |
| Monorepo 结构 | `pnpm workspace`，应用位于 `apps/web` 与 `apps/server` |
| 默认运行方式 | 本地运行，默认模拟交易 |
| 前端开发端口 | `3102` |
| 后端服务端口 | `3101` |
| 数据库 | SQLite，本地文件默认位于 `apps/server/data/web3-trading-tool.db` |
| 公共行情来源 | OKX、Binance 官方公共接口与 WebSocket |
| 私有交易能力 | 已有真实下单、余额同步、订单同步、私有推送基础链路，默认总开关关闭 |
| 风控能力 | 单笔金额、每日次数、每日金额、行情新鲜度、真实交易模式控制 |
| 执行体能力 | 策略实例、统一信号、执行任务、恢复任务、审计日志 |

## 2. 技术栈总览

### 2.1 前端技术栈

| 类别 | 技术 | 版本 | 作用 |
| --- | --- | --- | --- |
| 核心框架 | `react` | `19.1.1` | 前端 UI 框架 |
| DOM 渲染 | `react-dom` | `19.1.1` | React 浏览器渲染入口 |
| 路由 | `react-router-dom` | `7.7.1` | 页面路由、重定向、懒加载路由挂载 |
| UI 组件库 | `antd` | `5.26.7` | 基础组件、表单、消息、布局 |
| 图标 | `@ant-design/icons` | `6.0.0` | Ant Design 图标集 |
| Pro 组件 | `@ant-design/pro-components` | `2.8.10` | ProTable、ProDescriptions、ProForm 等业务组件 |
| 图表 | `echarts` | `5.6.0` | K 线、曲线、统计图等图表能力 |
| React 图表封装 | `echarts-for-react` | `3.0.2` | ECharts 的 React 包装组件 |
| 统计图表 | `@ant-design/plots` | `2.6.5` | 统计分析图表补充能力 |
| HTTP 客户端 | `axios` | `1.11.0` | REST API 调用 |
| 状态管理 | `zustand` | `5.0.6` | 前端轻量全局状态管理 |
| 数值精度 | `decimal.js` | `10.6.0` | 金额、数量、收益等高精度计算 |
| 样式预处理 | `sass` | `1.89.2` | SCSS 样式组织 |
| 构建工具 | `vite` | `7.0.6` | 本地开发服务器与前端构建基础设施 |
| React 构建插件 | `@vitejs/plugin-react` | `4.7.0` | React Fast Refresh 与 JSX 支持 |
| 类型系统 | `typescript` | `5.8.3` | 严格类型检查 |

### 2.2 后端技术栈

| 类别 | 技术 | 版本 | 作用 |
| --- | --- | --- | --- |
| 运行框架 | `fastify` | `5.4.0` | HTTP API 服务 |
| CORS | `@fastify/cors` | `11.0.1` | 跨域支持 |
| 数据库驱动 | `better-sqlite3` | `12.2.0` | SQLite 同步驱动 |
| 环境变量 | `dotenv` | `17.2.1` | `.env` 配置加载 |
| HTTP 请求 | `undici` | `8.3.0` | 调用交易所 REST 接口 |
| WebSocket | `ws` | `8.18.3` | 交易所 WebSocket 与本地推送基础能力 |
| 代理支持 | `https-proxy-agent` | `9.0.0` | 交易所接口代理访问 |
| 参数校验 | `zod` | `4.0.14` | 环境变量、DTO、接口参数校验 |
| 数值精度 | `decimal.js` | `10.6.0` | 金额、数量、成交、收益精度计算 |
| ID 生成 | `nanoid` | `5.1.5` | 信号、订单、执行任务、恢复任务等主键生成 |
| 时间处理 | `dayjs` | `1.11.21` | 启动日志与日期展示 |
| 开发运行器 | `tsx` | `4.20.3` | 本地直接运行 TypeScript 后端 |
| 日志美化 | `pino-pretty` | `13.1.3` | 开发环境日志美化输出 |
| 类型系统 | `typescript` | `5.8.3` | 严格类型检查 |

### 2.3 工程与包管理

| 类别 | 技术 | 版本 | 作用 |
| --- | --- | --- | --- |
| 包管理器 | `pnpm` | `10.13.1` | Workspace 包管理 |
| Monorepo | `pnpm-workspace.yaml` | 当前仓库配置 | 管理 `apps/*` 子应用 |
| 基础 TS 配置 | `tsconfig.base.json` | 当前仓库配置 | 统一 `ES2022`、严格模式、模块解析规则 |

## 3. 前端架构说明

### 3.1 前端入口与运行方式

- 入口文件：`apps/web/src/main.tsx`
- React 挂载方式：`ReactDOM.createRoot`
- 路由容器：`BrowserRouter`
- 主题配置：`ConfigProvider`
- 语言环境：`antd/locale/zh_CN`
- 全局样式：`antd/dist/reset.css` + `apps/web/src/styles/global.scss`

### 3.2 前端页面与路由

当前实际启用或重定向的路由定义位于 `apps/web/src/router/routes.tsx`：

| 路由 | 页面 |
| --- | --- |
| `/overview` | `OverviewPage` |
| `/rules` | `RulesPage` |
| `/trade-logs` | `TradeLogsPage` |
| `/recovery-center` | `RecoveryCenterPage` |
| `/risk-config` | `RiskConfigPage` |
| `/` | 重定向到 `/overview` |
| `/triggers` | 重定向到 `/rules` |
| `/trade-positions` | 重定向到 `/overview` |
| `/signals` | 重定向到 `/rules` |
| `/market-health` | 重定向到 `/rules` |
| `/audit-logs` | 重定向到 `/rules` |

页面采用 `React.lazy` + `Suspense` 懒加载，路由错误由 `ErrorBoundary` 兜底。

### 3.3 前端数据流

| 模块 | 技术 | 说明 |
| --- | --- | --- |
| REST 调用 | `axios` | `apps/web/src/api/client.ts` 中统一创建 `apiClient`，默认 `baseURL=/api` |
| 实时推送 | 浏览器原生 `WebSocket` | `apps/web/src/api/realtime.ts` 中维护自动重连逻辑 |
| 全局状态 | `zustand` | `apps/web/src/stores/tradingStore.ts` 维护规则、触发、订单、行情缓存等状态 |
| 实时接入钩子 | 自定义 Hook | `useRealtimeTrading` 负责接收 `ticker.updated` 与 `trigger.created` 推送 |
| 数值处理 | `decimal.js` | 交易金额、数量、收益、滑点等前端展示精度控制 |

### 3.4 前端 UI 能力

- `antd` 负责基础页面、表格、按钮、表单、消息、抽屉、弹窗等。
- `@ant-design/pro-components` 负责业务表格和描述组件。
- `echarts` 与 `echarts-for-react` 负责行情曲线、资产曲线、统计图。
- `@ant-design/plots` 负责部分分析图表展示。
- `sass` 负责模块化样式与全局样式组织。

## 4. 后端架构说明

### 4.1 后端入口与启动流程

| 项目 | 说明 |
| --- | --- |
| 启动入口 | `apps/server/src/main.ts` |
| 运行时装配 | `apps/server/src/bootstrap/app.ts` |
| HTTP 服务 | Fastify |
| 日志 | Fastify 内置 logger，开发环境通过 `pino-pretty` 美化 |
| 关闭流程 | 监听 `SIGINT`、`SIGTERM`，按顺序关闭策略扫描、私有推送、订单同步、恢复任务、HTTP 服务和数据库 |

后端启动后会自动启动以下后台任务：

- `strategyService.start()`：规则扫描与信号触发
- `realOrderSyncService.start()`：真实订单状态同步
- `privateOrderStreamService.start()`：私有订单与余额推送订阅
- `orderRecoveryService.start()`：恢复任务扫描与自动恢复

### 4.2 后端分层

| 分层 | 目录 | 说明 |
| --- | --- | --- |
| 配置层 | `apps/server/src/config` | 环境变量解析与配置收敛 |
| 数据库层 | `apps/server/src/database` | SQLite 初始化、建表、迁移 |
| 交易所适配层 | `apps/server/src/exchange` | OKX、Binance REST/WebSocket 适配 |
| 仓储层 | `apps/server/src/repositories` | 直接读写 SQLite，无 ORM |
| 路由层 | `apps/server/src/routes` | REST API 与 DTO 校验 |
| 服务层 | `apps/server/src/services` | 规则扫描、风控、执行编排、恢复、推送、分析等业务逻辑 |
| 类型层 | `apps/server/src/types` | 领域模型与外部接口类型 |
| 工具层 | `apps/server/src/utils` | 日期、环境、交易环境等辅助函数 |

### 4.3 后端核心业务服务

当前后端 `services` 目录包含以下关键服务：

| 服务 | 作用 |
| --- | --- |
| `market.service.ts` | 公共行情接入、K 线订阅、市场健康状态 |
| `strategy.service.ts` | 规则扫描、触发编排 |
| `signal.service.ts` | 统一信号协议、去重、过期、状态流转 |
| `risk.service.ts` | 风控检查、日维度统计 |
| `execution-task.service.ts` | 执行任务、互斥锁、幂等、状态流转 |
| `trade-execution.service.ts` | 快捷交易、规则交易、预览、确认、真实与模拟执行 |
| `order.service.ts` | 规则触发确认、最终校验、收尾恢复 |
| `real-order-sync.service.ts` | 真实订单 REST 同步、成交补全、真实账本更新 |
| `private-order-stream.service.ts` | 私有订单与余额推送接入 |
| `order-recovery.service.ts` | 恢复任务创建、自动恢复、人工重试、批量重试 |
| `audit-log.service.ts` | 审计日志归档 |
| `trade-account.service.ts` | 模拟账户、真实账户、持仓、成交和日志管理 |
| `config-archive.service.ts` | 配置导出与导入 |
| `daily-report.service.ts` | 日报统计 |
| `quality-analysis.service.ts` | 执行质量分析 |
| `recovery-analysis.service.ts` | 恢复质量分析 |

## 5. 数据库与持久化

### 5.1 数据库技术

| 项目 | 说明 |
| --- | --- |
| 数据库类型 | SQLite |
| 驱动 | `better-sqlite3@12.2.0` |
| 默认库文件 | `apps/server/data/web3-trading-tool.db` |
| 访问方式 | 仓储层直连 SQLite |
| ORM | 当前未使用 ORM |
| 迁移方式 | 在 `createDatabase()` 启动阶段执行建表与增量迁移 |

### 5.2 当前主要持久化对象

- 监控规则 `monitor_rules`
- 交易信号 `trading_signals`
- 触发事件 `trigger_events`
- 风控记录 `risk_checks`
- 风控配置 `risk_config`
- 订单记录 `order_records`
- 审计日志 `audit_logs`
- 交易账户、持仓、成交、操作日志、权益快照
- 恢复任务 `order_recovery_records`
- 策略实例 `strategy_instances`
- 策略版本 `strategy_versions`
- 执行任务 `execution_tasks`

### 5.3 数据精度策略

- 金额、价格、数量在前后端都广泛使用字符串存储和 `decimal.js` 计算。
- 后端避免把浮点结果直接作为成交、持仓、收益的归档值。
- 风控、订单、恢复、审计链路已归档 `strategyId`、`signalId`、`executionTaskId` 等执行体上下文字段。

## 6. 前后端通信方式

### 6.1 REST API

- 前端通过 `axios` 请求 `/api/*`
- Vite 开发代理把 `/api` 转发到 `http://localhost:3101`
- 后端使用 Fastify 注册 REST 路由
- DTO 与查询参数通过 `zod` 做严格校验

### 6.2 WebSocket 实时推送

| 方向 | 技术 | 说明 |
| --- | --- | --- |
| 前端 <- 后端 | 浏览器原生 `WebSocket` | 默认连接 `ws://localhost:3101/ws` |
| 后端内部推送 | `NotificationService` | 基于 Fastify 底层 `http server` 绑定 |
| 交易所 <- 后端 | `ws` | 连接 OKX、Binance 公共与私有流 |

当前前端接收的主要推送消息包括：

- `ticker.updated`
- `market.candle.updated`
- `trigger.created`
- `connected`

## 7. 工程化与开发规范

### 7.1 TypeScript 配置

| 位置 | 关键配置 |
| --- | --- |
| 根 `tsconfig.base.json` | `target=ES2022`、`strict=true`、`module=ESNext`、`moduleResolution=Bundler` |
| 前端 `apps/web/tsconfig.json` | `jsx=react-jsx`、DOM 类型、`noEmit=true` |
| 后端 `apps/server/tsconfig.json` | `module=NodeNext`、`rootDir=src`、`outDir=dist` |

### 7.2 脚本

#### 根目录脚本

| 脚本 | 说明 |
| --- | --- |
| `pnpm dev` | 并行启动前后端 |
| `pnpm dev:web` | 仅启动前端 |
| `pnpm dev:server` | 仅启动后端 |
| `pnpm typecheck` | 前后端 TypeScript 检查 |
| `pnpm lint` | 当前等同于前后端 TypeScript 检查 |

#### 子应用脚本

| 应用 | 脚本 | 说明 |
| --- | --- | --- |
| `@web3/web` | `dev` | `vite --host 0.0.0.0` |
| `@web3/web` | `preview` | Vite 预览 |
| `@web3/server` | `dev` | `tsx watch src/main.ts` |
| `@web3/server` | `start` | `node dist/main.js` |

### 7.3 当前仓库事实

| 项目 | 当前事实 |
| --- | --- |
| 包管理器锁定 | `pnpm@10.13.1` |
| Node.js `engines` 声明 | 当前仓库未声明 |
| 当前本地验证环境 | `Node.js v24.13.0` |
| 类型检查命令 | `tsc --noEmit` |
| 测试框架 | 当前仓库未配置单元测试框架 |

## 8. 项目目录结构

```text
web3/
├─ apps/
│  ├─ web/                     # React + Vite 前端
│  │  ├─ src/
│  │  │  ├─ api/               # REST 与 WebSocket 客户端
│  │  │  ├─ components/        # 页面与业务组件
│  │  │  ├─ hooks/             # 实时订阅等自定义 Hook
│  │  │  ├─ pages/             # 页面组件
│  │  │  ├─ router/            # 路由配置
│  │  │  ├─ stores/            # Zustand 状态管理
│  │  │  ├─ styles/            # 全局与模块样式
│  │  │  ├─ utils/             # 前端工具函数
│  │  │  └─ types.ts           # 前端统一类型定义
│  │  └─ vite.config.ts
│  └─ server/                  # Fastify + SQLite 后端
│     ├─ src/
│     │  ├─ bootstrap/         # 运行时装配
│     │  ├─ config/            # 环境变量与配置
│     │  ├─ database/          # SQLite 建表与迁移
│     │  ├─ exchange/          # 交易所适配层
│     │  ├─ repositories/      # SQLite 仓储
│     │  ├─ routes/            # API 路由与 DTO
│     │  ├─ services/          # 核心业务服务
│     │  ├─ types/             # 后端领域类型
│     │  └─ utils/             # 工具函数
│     └─ data/                 # SQLite 数据文件
├─ docs/                       # 项目文档、路线图、全流程说明
├─ package.json
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

## 9. 启动方式

### 9.1 安装依赖

```bash
pnpm install
```

### 9.2 启动前后端

```bash
pnpm dev
```

### 9.3 本地访问地址

| 服务 | 地址 |
| --- | --- |
| 前端 | `http://localhost:3102` |
| 后端 | `http://localhost:3101` |

## 10. 环境变量说明

复制 `.env.example` 为 `.env` 后按需调整：

```bash
cp .env.example .env
```

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3101` | 后端端口 |
| `VITE_WS_BASE_URL` | `ws://localhost:3101/ws` | 前端 WebSocket 地址 |
| `DATABASE_PATH` | `./data/web3-trading-tool.db` | SQLite 文件路径 |
| `DEFAULT_EXCHANGE` | `okx` | 默认交易所 |
| `ENABLE_REAL_TRADING` | `false` | 真实下单总开关 |
| `EXCHANGE_HTTP_PROXY` | 空 | 交易所请求代理 |
| `OKX_API_KEY` | 空 | OKX API Key |
| `OKX_API_SECRET` | 空 | OKX API Secret |
| `OKX_API_PASSPHRASE` | 空 | OKX Passphrase |
| `OKX_SIMULATED` | `true` | OKX 模拟盘标记 |
| `BINANCE_API_KEY` | 空 | Binance API Key |
| `BINANCE_API_SECRET` | 空 | Binance API Secret |
| `BINANCE_USE_TESTNET` | `false` | Binance Spot Testnet 开关 |
| `REAL_ORDER_SYNC_INTERVAL_MS` | `15000` | 真实订单同步轮询间隔 |
| `REAL_ORDER_SYNC_LOOKBACK_MINUTES` | `240` | 真实订单同步回看窗口 |
| `REAL_ORDER_SYNC_BATCH_SIZE` | `50` | 单次真实订单同步批量上限 |
| `RISK_MAX_QUOTE_AMOUNT` | `1000` | 单笔最大计价金额 |
| `RISK_MAX_MARKET_AGE_MS` | `10000` | 行情最大允许延迟 |
| `RISK_DAILY_MAX_TRIGGER_COUNT` | `20` | 每日最大通过风控次数 |
| `RISK_DAILY_MAX_QUOTE_AMOUNT` | `5000` | 每日最大通过风控计价金额 |
| `RISK_TRADING_MODE` | `simulation_only` | 风控交易模式 |
| `SIMULATION_INITIAL_QUOTE_BALANCE` | `10000` | 模拟账户初始本金 |
| `SIMULATION_QUOTE_CURRENCY` | `USDT` | 模拟账户默认计价币种 |

公共行情和本地推送不需要填写交易所 API Key。API Key 主要用于真实下单、余额查询和私有订单状态订阅。

## 11. 当前能力边界

- 默认运行在模拟交易模式。
- 前后端已具备策略实例、统一信号、执行任务、恢复任务和审计日志闭环基础能力。
- 已接入 OKX、Binance 的公共行情、交易规则、真实下单前置能力和真实订单同步基础链路。
- Polymarket 当前仍处于规划阶段，相关流程请参考 `docs/todo.md` 与 `docs/量化交易执行全流程.md`。

## 12. 相关文档

- 使用手册：[docs/用户使用手册.md](docs/用户使用手册.md)
- 全流程说明：[docs/量化交易执行全流程.md](docs/量化交易执行全流程.md)
- 任务规划：[docs/todo.md](docs/todo.md)
