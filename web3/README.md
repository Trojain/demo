# Web3 行情监控与半自动下单工具

第一版用于本地运行，默认模拟下单。前端负责规则配置、触发确认和订单查看，后端负责行情接入、规则扫描、SQLite 持久化和交易所适配。

## 启动

```bash
pnpm install
pnpm dev
```

前端地址：

```txt
http://localhost:5173
```

后端地址：

```txt
http://localhost:3001
```

## 配置

复制 `.env.example` 为 `.env` 后按需调整：

```bash
cp .env.example .env
```

关键配置：

- `PORT`：后端端口，默认 `3001`
- `VITE_WS_BASE_URL`：前端行情推送地址，开发环境默认 `ws://localhost:3001/ws`
- `DATABASE_PATH`：SQLite 数据文件路径
- `ENABLE_REAL_TRADING`：真实下单总开关，第一版建议保持 `false`
- `EXCHANGE_HTTP_PROXY`：交易所 HTTP 代理，例如 `http://127.0.0.1:7897`
- `OKX_API_KEY`、`OKX_API_SECRET`、`OKX_API_PASSPHRASE`：OKX 真实下单预留配置
- `BINANCE_API_KEY`、`BINANCE_API_SECRET`：Binance 真实下单预留配置

公共行情和本地推送不需要填写交易所 API Key。API Key 只用于后续真实下单、余额查询和私有订单状态订阅。

## 用户手册

详细使用说明见 [docs/用户使用手册.md](docs/用户使用手册.md)。

## 第一版能力

- OKX 公共行情 WebSocket 订阅
- Binance 行情 REST 查询预留
- 监控规则配置
- 目标价触发检测
- 前端确认后模拟下单
- 触发事件和订单记录落 SQLite
- 行情数据只缓存在内存

## 风险说明

当前版本默认模拟下单，真实下单接口尚未开放。后续接入真实交易前，需要补充 API 签名、交易规则校验、余额校验、限流、私有订单推送和更完整的风控策略。
