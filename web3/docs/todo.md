# Web3 量化交易执行体 TODO

## 0. 文档规则

- `✅` 表示已完成。
- `⬛️` 表示未完成。
- 当前文档是后续开发与上线验收的唯一主路线图。
- 当前目标是：`Web3 量化交易执行体 + OKX / Binance 自动下单 + Polymarket 信号前置与手动确认预留`。
- 当前文档只记录业务流程、数据归档、接口依据、风险控制、性能要求、上线验收。
- 前端页面、图表、样式、菜单、交互细节不进入本 TODO，除非它直接影响业务闭环。
- 禁止根据页面显示、经验文本、非官方资料猜测交易所流程、字段、状态。
- 任何交易所字段必须来自官方文档。未确认字段只能标记为 `待官方确认`，不能进入实现。
- 内部字段可以按执行体业务需要设计，但必须明确标注为内部归档字段，不能伪装成交易所官方字段。
- 不再主动新增测试。上线验收优先使用 typecheck、lint、真实接口联调、模拟盘演练、人工验收清单。

## 1. 官方接口依据矩阵

### 1.1 OKX 官方依据

官方文档入口：`https://app.okx.com/docs-v5/en/`

后续 OKX 相关开发只允许基于以下官方能力推进：

- REST 认证与签名
  - 用于真实交易接口调用。
  - 官方章节：`REST Authentication`
- 交易规则
  - REST：`GET /api/v5/public/instruments`
  - 归档用途：交易对、精度、最小下单量、tick size、lot size 等官方字段。
- 公共行情
  - REST：`GET /api/v5/market/ticker`
  - REST：`GET /api/v5/market/tickers`
  - WebSocket：Tickers channel
  - WebSocket：Candlesticks channel
- 下单
  - REST：`POST /api/v5/trade/order`
  - 核心官方字段以文档为准，包括 `instId`、`tdMode`、`clOrdId`、`side`、`ordType`、`sz`、`px`、`tgtCcy`。
  - SPOT 市价单金额语义必须按 OKX 官方 `tgtCcy` 规则实现。
- 查单与订单同步
  - REST：`GET /api/v5/trade/order`
  - REST：`GET /api/v5/trade/orders-history`
  - WebSocket：Orders channel
  - 订单状态字段、成交数量、均价、手续费字段以官方响应为准。
- 账户与余额
  - REST：`GET /api/v5/account/balance`
  - WebSocket：Account channel
- 限频与连接限制
  - 官方章节：`Rate Limits`
  - 官方章节：`WebSocket`

### 1.2 Binance 官方依据

官方文档入口：`https://developers.binance.com/docs/binance-spot-api-docs`

后续 Binance Spot 相关开发只允许基于以下官方能力推进：

- 交易规则
  - REST：`GET /api/v3/exchangeInfo`
  - 官方 filters：`PRICE_FILTER`、`LOT_SIZE`、`MARKET_LOT_SIZE`、`MIN_NOTIONAL`、`NOTIONAL` 等以文档为准。
- 公共行情
  - REST：`GET /api/v3/ticker/24hr`
  - REST：`GET /api/v3/klines`
  - WebSocket Streams：ticker、kline 等官方 stream。
- 下单
  - REST：`POST /api/v3/order`
  - 官方必填字段和可选字段以文档为准，包括 `symbol`、`side`、`type`、`timeInForce`、`quantity`、`quoteOrderQty`、`price`、`newClientOrderId`、`timestamp`。
  - 市价单官方语义：
    - `quantity` 表示基础币数量。
    - `quoteOrderQty` 表示计价币金额，买入时表示花费多少 quote asset，卖出时表示收到多少 quote asset。
- 查单与撤单
  - REST：`GET /api/v3/order`
  - REST：`DELETE /api/v3/order`
  - REST：`DELETE /api/v3/openOrders`
- 账户与成交
  - REST：Account endpoints
  - REST：Trades and order query endpoints
- 私有推送
  - User Data Stream：`executionReport`
  - User Data Stream：`outboundAccountPosition`
- 限频
  - 官方章节：`LIMITS`
  - REST 权重、订单速率、WebSocket 连接限制按官方文档执行。

### 1.3 Polymarket 官方依据

官方文档入口：`https://docs.polymarket.com/api-reference/introduction`

后续 Polymarket 相关开发只允许基于以下官方能力推进：

- Gamma API
  - 用途：市场发现、市场元数据、事件、标签。
  - 重点接口：`Get market by id`
  - 可归档官方字段包括 `id`、`question`、`conditionId`、`resolutionSource`、`endDate`、`description`、`outcomes`、`outcomePrices`、`active`、`closed`。
- CLOB API
  - 用途：订单簿、价格、价差、下单。
  - 重点接口：`Get CLOB market info`
  - 重点能力：tokens、tick size、fee、min order size 等以官方响应为准。
- Market WebSocket
  - Endpoint：`wss://ws-subscriptions-clob.polymarket.com/ws/market`
  - 官方事件：`book`、`price_change`、`last_trade_price`、`tick_size_change`、`best_bid_ask`
- Orderbook
  - 滞后判断必须基于订单簿、best bid、best ask、spread、可成交深度。
  - 页面展示价格不能作为执行判断依据。
- Authentication
  - CLOB 交易需要官方认证流程。
  - L1、L2 认证、API key、secret、passphrase、签名流程按官方文档执行。
- Geographic Restrictions
  - 下单前必须执行 geoblock 检查。
  - 未完成 geoblock 检查前，禁止进入 Polymarket 交易执行。
- Rate Limits
  - REST 初始化和兜底必须遵守官方限频。
  - 盘口实时数据优先使用官方 WebSocket。

## 2. 上线目标与边界

### 2.1 上线目标

- OKX / Binance：
  - 支持模拟交易完整闭环。
  - 支持真实交易自动下单，默认需要人工确认开关和风控开关保护。
  - 支持订单状态同步、成交补全、账本回写、异常恢复、对账归档。
- Polymarket：
  - V1 到 V3 只做信号前置、盘口校验、风控、提醒。
  - V4 只预留用户确认后手动下单规划。
  - V5 自动执行暂不进入上线目标。

### 2.2 明确暂不做

- 暂不做 Polymarket 全市场自动解析。
- 暂不通过 `question` 文本自动推导阈值、到期条件、YES / NO 方向。
- 暂不做未完成 geoblock 检查的 Polymarket 下单。
- 暂不做未完成认证闭环的 Polymarket 下单。
- 暂不做未完成盘口深度、spread、TTL 校验的 Polymarket 自动押注。
- 暂不做未完成对账闭环的真实自动交易扩展。
- 暂不做期货、永续、杠杆、借贷等非 Spot 主线能力。

## 3. 已完成能力基线

> 本章记录当前已经具备的 Web3 量化交易执行体能力。
> 后续每完成一项路线图任务，必须把对应状态从 `⬛️` 改为 `✅`。

### 3.1 行情与交易所基础能力

- ✅ 已完成 OKX 公共行情接入。
- ✅ 已完成 Binance 公共行情接入。
- ✅ 已完成 OKX 交易规则同步基础能力。
- ✅ 已完成 Binance `exchangeInfo` 交易规则同步基础能力。
- ✅ 已完成 OKX WebSocket ticker 行情接入。
- ✅ 已完成 Binance WebSocket ticker 行情接入。
- ✅ 已完成 OKX / Binance K 线数据接入与低频校准。
- ✅ 已完成实时行情时序保护，避免 REST 旧快照覆盖 WebSocket 新价格。
- ✅ 已完成行情健康状态基础归档。
- ✅ 已完成 Binance 主网 / 测试网环境切换基础能力。
- ✅ 已完成 OKX 模拟盘 / 实盘环境标签基础能力。

### 3.2 信号、风控与触发基础能力

- ✅ 已完成价格规则信号基础链路。
- ✅ 已完成外部信号输入基础接口。
- ✅ 已完成信号状态归档基础能力。
- ✅ 已完成风控基础能力，覆盖单笔金额、日次数、日金额、真实交易模式控制。
- ✅ 已完成风控日维度统计基础能力。
- ✅ 已完成触发事件生成和人工确认基础链路。
- ✅ 已完成下单前预览基础接口。
- ✅ 已完成真实交易二次确认令牌基础能力。

### 3.3 模拟交易与账本基础能力

- ✅ 已完成模拟账户初始化。
- ✅ 已完成模拟买入预览。
- ✅ 已完成模拟买入成交和持仓更新。
- ✅ 已完成模拟卖出预览。
- ✅ 已完成模拟卖出成交和已实现盈亏计算。
- ✅ 已完成模拟成交记录归档。
- ✅ 已完成模拟操作日志归档。
- ✅ 已完成模拟持仓估值和收益统计基础能力。
- ✅ 已完成模拟和真实交易账本统一查询基础接口。

### 3.4 OKX / Binance 真实交易基础能力

- ✅ 已完成 OKX 真实下单协议层基础映射。
- ✅ 已完成 Binance 真实下单协议层基础映射。
- ✅ 已完成统一 `PlaceOrderResult` 返回结构。
- ✅ 已完成手动快捷交易真实下单基础链路。
- ✅ 已完成规则触发确认后的真实下单基础链路。
- ✅ 已完成真实下单前余额校验基础能力。
- ✅ 已完成真实下单失败审计基础能力。
- ✅ 已完成交易所错误标准化分类基础能力。
- ✅ 已完成 Binance 市价单 `MARKET_LOT_SIZE` 基础校验。
- ✅ 已完成 Binance `quoteOrderQty` 数量语义基础处理。
- ✅ 已完成 OKX 市价单 `tgtCcy` 数量语义基础处理。
- ✅ 已完成手动真实下单允许没有 `ruleId / triggerId` 的订单落库兼容。

### 3.5 订单同步、私有推送与成交补全基础能力

- ✅ 已完成真实订单 REST 状态同步基础能力。
- ✅ 已完成 OKX 私有订单推送基础接入。
- ✅ 已完成 OKX 私有账户余额推送基础接入。
- ✅ 已完成 Binance 私有订单推送基础接入。
- ✅ 已完成 Binance 私有余额推送基础接入。
- ✅ 已完成私有推送健康状态基础归档。
- ✅ 已完成推送优先、REST 兜底的订单同步基础链路。
- ✅ 已完成真实订单成交增量补全基础能力。
- ✅ 已完成真实账本回写基础能力。
- ✅ 已完成余额刷新失败恢复基础能力。

### 3.6 异常恢复与审计基础能力

- ✅ 已完成恢复任务表和恢复任务基础模型。
- ✅ 已完成自动恢复基础能力。
- ✅ 已完成人工重试基础接口。
- ✅ 已完成批量恢复基础能力。
- ✅ 已完成恢复来源归档，覆盖 `normal_path`、`auto_retry`、`manual_retry`。
- ✅ 已完成规则确认收尾失败恢复阶段 `rule_trigger_finalize`。
- ✅ 已完成订单同步失败恢复阶段 `order_sync`。
- ✅ 已完成私有推送失败恢复阶段 `private_stream`。
- ✅ 已完成成交补全失败恢复阶段 `trade_fill_sync`。
- ✅ 已完成余额刷新失败恢复阶段 `balance_refresh`。
- ✅ 已完成恢复统计基础能力。
- ✅ 已完成恢复质量分析基础能力。
- ✅ 已完成恢复耗时分析基础能力。
- ✅ 已完成恢复尝试次数分析基础能力。
- ✅ 已完成审计日志基础归档。
- ✅ 已完成审计日志后端分页和级别筛选基础能力。

### 3.7 交易统计与配置归档基础能力

- ✅ 已完成交易日报基础能力。
- ✅ 已完成订单成交统计基础能力。
- ✅ 已完成执行质量分析基础能力。
- ✅ 已完成配置导出基础能力。
- ✅ 已完成配置导入基础能力。
- ✅ 已完成导入配置时默认暂停规则的保护能力。
- ✅ 已完成配置导入按规则 ID 幂等更新基础能力。

### 3.8 执行体底座基础能力

- ✅ 已完成策略实例模型和策略版本归档。
- ✅ 已完成价格规则到策略实例的兼容回填。
- ✅ 已完成统一信号协议基础字段，覆盖状态、去重键、过期时间和拒绝原因。
- ✅ 已完成执行任务模型，覆盖状态、幂等键、互斥锁、失败阶段和失败原因。
- ✅ 已完成订单、恢复任务和审计日志对执行任务的关联归档。
- ✅ 已预留 Polymarket 信号来源枚举，业务接入仍按 `P3.1` 到 `P3.4` 推进。

### 3.9 已完成但仍需上线级收口的能力

- ✅ 已具备 OKX / Binance 真实下单基础能力。
- ⬛️ 仍需按 `P1.1` 到 `P1.4` 完成官方字段映射、交易规则、状态同步、成交补全的上线级收口。
- ✅ 已具备订单同步和私有推送基础能力。
- ⬛️ 仍需按 `P2.1` 完成订单状态机和禁止迁移表。
- ✅ 已具备模拟和真实账本基础能力。
- ⬛️ 仍需按 `P2.2` 完成仓位状态机上线级收口。
- ✅ 已具备恢复基础能力。
- ⬛️ 仍需按 `P2.3` 完成恢复模型上线级收口。
- ✅ 已具备审计基础能力。
- ⬛️ 仍需按 `8.1`、`10.1`、`10.2` 完成字段映射、完成证据和上线门禁。
- ✅ 已具备 Polymarket 规划。
- ⬛️ Polymarket V1 到 V3 尚未开发，需按 `P3.1` 到 `P3.4` 推进。

## 4. 完整业务流程

### 4.1 OKX / Binance 自动交易闭环

1. 策略实例处于可运行状态。
2. 行情层接收 OKX 或 Binance 官方行情数据。
3. 信号层生成标准化信号。
4. 信号通过幂等、有效期、优先级、来源校验。
5. 风控层执行单笔金额、日次数、日金额、真实交易开关、市场新鲜度校验。
6. 通过风控后生成执行任务。
7. 执行编排层检查同账户、同交易所、同交易对互斥。
8. 需要确认的任务进入 `waiting_confirm`。
9. 确认后进入交易所下单适配器。
10. 适配器严格按 OKX 或 Binance 官方字段构造请求。
11. 下单成功后本地订单记录必须落库。
12. 私有推送优先更新订单状态。
13. REST 查单作为兜底同步。
14. 成交增量进入成交补全。
15. 成交补全后更新账本、余额、持仓、盈亏。
16. 任意失败进入恢复任务。
17. 恢复失败进入人工处理或对账差异。
18. 所有关键动作进入审计归档。

### 4.2 Polymarket V1 到 V3 信号前置闭环

1. 人工配置 Polymarket 市场映射。
2. Gamma API 拉取并校验市场元数据。
3. CLOB API 拉取并校验 CLOB 市场信息。
4. Market WebSocket 订阅 YES / NO token 盘口事件。
5. 系统维护 best bid、best ask、spread、last trade、深度、tick size。
6. OKX / Binance 行情变化触发市场映射检查。
7. 只基于官方订单簿和 best bid / ask 判断是否存在候选滞后信号。
8. 候选信号进入 Polymarket 专用风控。
9. 风控检查市场状态、spread、深度、滑点、TTL、最大投入、提醒次数。
10. 通过后生成 Polymarket 提醒信号。
11. 提醒信号归档到统一信号链路，但不进入交易所下单。
12. 未通过则归档拒绝原因。

### 4.3 Polymarket V4 手动确认下单预留闭环

1. 先完成 V1 到 V3。
2. 下单前执行 geoblock 检查。
3. 完成官方认证流程设计。
4. 按官方 `Post a new order` 定义下单字段。
5. 用户人工确认后才能提交。
6. 提交结果、订单状态、成交、错误全部归档。
7. 未完成 geoblock、认证、官方字段映射前，禁止开发交易执行。

## 5. 核心数据归档模型

### 5.1 内部统一对象

以下字段是内部归档字段，用于执行体闭环，不代表交易所官方字段。

#### 策略实例

- `strategyId`
- `strategyType`
- `strategyVersion`
- `status`
- `exchangeScope`
- `symbolScope`
- `accountScope`
- `mode`
- `parameterJson`
- `riskProfileId`
- `createdAt`
- `updatedAt`

#### 信号

- `signalId`
- `strategyId`
- `sourceType`
- `sourceKey`
- `dedupeKey`
- `exchange`
- `symbol`
- `side`
- `orderType`
- `quantityType`
- `baseQuantity`
- `quoteAmount`
- `targetPrice`
- `marketPrice`
- `marketEventTime`
- `priority`
- `expireAt`
- `status`
- `metadataJson`

#### 风控记录

- `riskCheckId`
- `signalId`
- `strategyId`
- `exchange`
- `symbol`
- `mode`
- `status`
- `reason`
- `quoteExposure`
- `marketPrice`
- `itemsJson`
- `statDate`
- `createdAt`

#### 执行任务

- `executionId`
- `strategyId`
- `signalId`
- `exchange`
- `symbol`
- `mode`
- `status`
- `lockKey`
- `idempotencyKey`
- `confirmRequired`
- `confirmToken`
- `failureStage`
- `createdAt`
- `startedAt`
- `finishedAt`

#### 订单

- `orderId`
- `executionId`
- `strategyId`
- `signalId`
- `exchange`
- `symbol`
- `side`
- `orderType`
- `quantityType`
- `baseQuantity`
- `quoteAmount`
- `price`
- `clientOrderId`
- `exchangeOrderId`
- `status`
- `rawMessage`
- `createdAt`
- `updatedAt`

#### 成交

- `fillId`
- `orderId`
- `exchange`
- `symbol`
- `side`
- `price`
- `baseQuantity`
- `quoteAmount`
- `feeAmount`
- `feeCurrency`
- `exchangeTradeId`
- `createdAt`

#### 账本与持仓

- `accountId`
- `mode`
- `exchange`
- `quoteCurrency`
- `availableQuoteBalance`
- `lockedQuoteBalance`
- `symbol`
- `baseCurrency`
- `quantity`
- `availableQuantity`
- `lockedQuantity`
- `avgCostPrice`
- `costAmount`
- `realizedPnl`
- `unrealizedPnl`
- `updatedAt`

#### 恢复任务

- `recoveryId`
- `identityKey`
- `orderId`
- `exchangeOrderId`
- `exchange`
- `source`
- `mode`
- `symbol`
- `failureStage`
- `recoveryStatus`
- `retryCount`
- `maxRetryCount`
- `lastRecoverySource`
- `resolvedBy`
- `payloadJson`
- `createdAt`
- `updatedAt`
- `resolvedAt`

#### 对账差异

- `reconcileId`
- `reconcileType`
- `exchange`
- `symbol`
- `accountId`
- `localEntityId`
- `exchangeEntityId`
- `differenceType`
- `differencePayloadJson`
- `status`
- `resolvedBy`
- `createdAt`
- `resolvedAt`

#### 审计日志

- `auditId`
- `level`
- `action`
- `entityType`
- `entityId`
- `strategyId`
- `signalId`
- `executionId`
- `orderId`
- `recoveryId`
- `exchange`
- `environment`
- `mode`
- `message`
- `payloadJson`
- `createdAt`

#### Polymarket 市场映射

- `mappingId`
- `sourceExchange`
- `sourceSymbol`
- `gammaMarketId`
- `conditionId`
- `question`
- `resolutionSource`
- `endDate`
- `yesTokenId`
- `noTokenId`
- `active`
- `closed`
- `metadataJson`
- `createdAt`
- `updatedAt`

#### Polymarket 盘口快照

- `snapshotId`
- `mappingId`
- `conditionId`
- `tokenId`
- `outcome`
- `bestBid`
- `bestAsk`
- `spread`
- `lastTradePrice`
- `depthJson`
- `tickSize`
- `eventTime`
- `receivedAt`

#### Polymarket 信号

- `polymarketSignalId`
- `mappingId`
- `sourceExchange`
- `sourceSymbol`
- `sourcePrice`
- `sourceEventTime`
- `conditionId`
- `targetOutcome`
- `targetTokenId`
- `bestBid`
- `bestAsk`
- `spread`
- `estimatedFillPrice`
- `availableDepth`
- `ttlMs`
- `status`
- `reason`
- `createdAt`
- `expiredAt`

### 5.2 数据归档硬性规则

- 每个核心对象必须有稳定主键。
- 每个下游对象必须能追溯上游来源。
- 每个异常必须能定位到阶段、原因、动作、最终状态。
- 每个外部响应必须保留必要原始摘要，敏感字段禁止入库。
- 真实交易链路必须能从策略实例串到审计日志。
- Polymarket 信号必须能从外部行情串到盘口快照和提醒原因。

## 6. 路线图

### P0 执行体底座

#### ✅ P0.1 统一策略实例模型

规划目的：让策略成为执行、信号、风控、恢复、审计、对账的统一业务入口。

官方依据：此项是内部执行体模型，不映射任何交易所字段。交易所字段只在适配层引用官方文档。

实现方式：

- 新增策略实例归档模型。
- 将现有价格规则归入策略实例上下文。
- 外部信号必须绑定策略实例后才能进入风控。
- 策略参数变更必须生成版本记录。
- 策略状态必须控制后续信号是否可执行。

数据归档要求：

- 信号、风控、执行任务、订单、恢复、审计必须归档 `strategyId`。
- 参数版本必须可追溯。

风险与性能要求：

- 策略状态判断必须是本地读，不允许高频远程查询。
- 策略配置需要缓存，但变更后必须能失效。

完成标准：

- 任意执行任务都能追溯到策略实例和参数版本。

完成状态：

- ✅ 已新增 `strategy_instances` 和 `strategy_versions`。
- ✅ 已将价格规则归入策略实例上下文。
- ✅ 已完成旧规则、旧信号、旧触发、旧订单的策略字段兼容回填。
- ✅ 已在规则创建、更新、启停时同步策略实例和参数版本。

#### ✅ P0.2 统一信号协议

规划目的：让价格规则、外部输入、Polymarket 候选信号都进入统一信号模型。

官方依据：

- OKX / Binance 行情字段来自官方行情 WebSocket 和 REST。
- Polymarket 市场与盘口字段来自 Gamma、CLOB、Market WebSocket。

实现方式：

- 新增统一信号 DTO。
- 明确信号状态：`received`、`validated`、`rejected`、`converted`、`expired`。
- 建立 `dedupeKey` 去重。
- 建立 `expireAt` 过期控制。
- 建立来源类型：价格规则、外部输入、Polymarket 盘口滞后。

数据归档要求：

- 信号必须归档来源、事件时间、市场价格、策略实例、状态、拒绝原因。

风险与性能要求：

- 高频行情不能直接写信号，必须由策略条件触发后写入。
- 去重必须使用索引或可控查询，避免高频信号导致页面和数据库卡顿。

完成标准：

- 策略类执行入口都先生成统一信号，快捷交易直接生成执行任务并保留 `strategyId` 为空。

完成状态：

- ✅ 已新增统一信号字段 `strategyId`、`strategyVersionId`、`dedupeKey`、`expireAt`、`rejectedReason`。
- ✅ 已将新信号状态扩展为 `received`、`validated`、`rejected`、`converted`、`expired`，保留旧 `pending` 兼容历史数据。
- ✅ 已建立信号去重索引，避免重复来源事件反复写库。
- ✅ 已预留 `polymarket_lag` 信号来源枚举，业务接入仍按 P3 推进。

#### ✅ P0.3 建立执行编排层

规划目的：把确认、互斥、幂等、下单、失败阶段统一纳入执行任务。

官方依据：

- OKX 下单以 `POST /api/v5/trade/order` 为准。
- Binance 下单以 `POST /api/v3/order` 为准。
- Polymarket V1 到 V3 暂不进入执行任务下单。

实现方式：

- 新增执行任务模型。
- 定义状态：`pending`、`waiting_confirm`、`running`、`submitted`、`completed`、`failed`、`cancelled`。
- 建立同账户、同交易所、同交易对互斥锁。
- 建立 `idempotencyKey`，防止重复信号、重复确认、重复提交。
- 失败必须归入明确阶段。

数据归档要求：

- 执行任务必须关联信号、策略、订单、恢复任务。

风险与性能要求：

- 锁必须有超时恢复机制。
- 执行任务查询需要按状态、时间、交易所建立索引。

完成标准：

- OKX / Binance 下单前必须存在执行任务。

完成状态：

- ✅ 已新增 `execution_tasks` 执行任务模型。
- ✅ 已接入规则触发确认链路，风控通过后生成执行任务。
- ✅ 已接入快捷交易确认链路，手动交易也会生成执行任务。
- ✅ 已接入订单落库、恢复任务和审计日志的 `executionTaskId` 归档。
- ✅ 已建立 `idempotencyKey` 和同模式、交易所、交易对的互斥锁。
- ✅ 已在执行失败时归档失败阶段和失败原因。
- ✅ 已在真实订单同步到终态后释放执行任务互斥。

### P1 OKX / Binance 自动下单闭环

#### ⬛️ P1.1 交易规则校验收口

规划目的：所有订单在提交前必须通过官方交易规则校验。

官方依据：

- OKX：`GET /api/v5/public/instruments`
- Binance：`GET /api/v3/exchangeInfo` 与官方 Filters

实现方式：

- 同步交易规则并缓存。
- OKX 校验 `tickSz`、`lotSz`、`minSz` 等官方字段。
- Binance 校验 `PRICE_FILTER`、`LOT_SIZE`、`MARKET_LOT_SIZE`、`MIN_NOTIONAL`、`NOTIONAL` 等官方 filters。
- 市价单数量语义按交易所官方文档区分。

数据归档要求：

- 下单预检必须归档使用的规则版本或刷新时间。
- 预检失败必须归档失败项。

风险与性能要求：

- 交易规则低频刷新，高频下单读取本地缓存。
- 规则缓存过期时禁止真实下单。

完成标准：

- 不符合官方规则的订单不能进入真实下单。

#### ⬛️ P1.2 下单适配器收口

规划目的：OKX / Binance 真实下单字段完全按官方接口映射。

官方依据：

- OKX：`POST /api/v5/trade/order`
- Binance：`POST /api/v3/order`

实现方式：

- OKX 下单映射只使用官方字段，SPOT 市价金额语义使用 `tgtCcy`。
- Binance 市价金额语义使用 `quantity` 或 `quoteOrderQty`，按官方说明执行。
- 客户端幂等 ID 分别映射：
  - OKX：`clOrdId`
  - Binance：`newClientOrderId`
- 交易所原始响应归档为摘要，敏感字段不入库。

数据归档要求：

- 订单必须归档内部 `orderId`、客户端幂等 ID、交易所订单号、请求摘要、响应摘要。

风险与性能要求：

- 真实下单前必须二次确认真实交易开关。
- 提交失败必须归档标准错误分类。

完成标准：

- OKX / Binance 市价、限价在官方字段口径下能稳定提交。

#### ⬛️ P1.3 私有推送与 REST 兜底同步

规划目的：订单状态和余额更新具备实时路径和兜底路径。

官方依据：

- OKX：Orders channel、Account channel、`GET /api/v5/trade/order`
- Binance：User Data Stream `executionReport`、`outboundAccountPosition`、`GET /api/v3/order`

实现方式：

- 私有推送优先处理订单和余额。
- REST 定时同步 pending 订单。
- 推送乱序时使用事件时间、状态优先级、成交累计量保护。
- REST 旧快照禁止覆盖更新状态。

数据归档要求：

- 订单同步必须记录来源：private stream 或 REST。
- 同步失败进入恢复任务。

风险与性能要求：

- 私有推送断线需要指数退避重连。
- REST 兜底需要批量限制，避免触发限频。

完成标准：

- 推送断开后，REST 能补齐最终订单状态。

#### ⬛️ P1.4 成交补全与账本回写

规划目的：订单成交后必须准确进入成交、账本、持仓。

官方依据：

- OKX：订单详情、成交明细相关官方接口和 Orders channel 返回字段。
- Binance：订单查询响应中的成交累计字段、User Data Stream `executionReport`。

实现方式：

- 以交易所成交增量或订单累计成交差额生成本地成交。
- 同一成交 ID 或同一订单累计增量不得重复记账。
- 手续费金额和手续费币种按官方返回字段归档。

数据归档要求：

- 成交、账本、持仓必须关联订单。

风险与性能要求：

- 成交补全必须串行处理同一订单。
- 成交累计回退必须进入恢复或对账差异。

完成标准：

- 成交到持仓、余额、盈亏的数据链路可追溯。

### P2 状态机、恢复、对账、熔断

#### ⬛️ P2.1 订单状态机

规划目的：统一订单状态迁移，防止状态回退和重复处理。

官方依据：

- OKX 订单状态字段以官方订单接口和 Orders channel 为准。
- Binance 订单状态字段以官方订单接口和 `executionReport` 为准。

实现方式：

- 内部状态统一为 `submitted`、`partially_filled`、`filled`、`cancelled`、`rejected`、`failed`。
- 建立交易所状态到内部状态映射表。
- 每个状态定义允许前置状态。
- 成交累计量只允许持平或递增。

数据归档要求：

- 每次状态变化写审计。
- 状态拒绝迁移写警告审计。

风险与性能要求：

- 状态机必须纯本地计算。
- 同一订单状态更新必须串行。

完成标准：

- 任意订单状态都能解释来源和迁移原因。

#### ⬛️ P2.2 仓位状态机

规划目的：统一开仓、加仓、减仓、平仓和盈亏口径。

官方依据：仓位与账本是内部模型。真实成交输入来自 OKX / Binance 官方成交和订单同步结果。

实现方式：

- 买入增加数量和成本。
- 卖出减少数量并结转已实现盈亏。
- 部分成交按成交增量处理。
- 手续费按币种归档，不猜测折算。

数据归档要求：

- 每次持仓变化必须关联成交。
- 每次余额变化必须关联成交或同步来源。

风险与性能要求：

- 同账户同交易对持仓更新必须串行。

完成标准：

- 任意持仓数值都能追溯到成交链路。

#### ⬛️ P2.3 恢复模型收口

规划目的：异常进入标准恢复模型，避免临时补丁。

官方依据：恢复是内部模型。异常来源来自官方接口错误、私有推送错误、本地归档失败。

实现方式：

- 标准恢复阶段：
  - `order_submit_finalize`
  - `rule_trigger_finalize`
  - `order_sync`
  - `private_stream`
  - `trade_fill_sync`
  - `balance_refresh`
  - `reconcile`
- 标准恢复状态：
  - `pending_recovery`
  - `recovering`
  - `recovered`
  - `manual_review_required`
  - `recovery_failed`
- 恢复动作来源：
  - `normal_path`
  - `auto_retry`
  - `manual_retry`

数据归档要求：

- 恢复任务必须有 `identityKey`。
- 恢复结果必须写审计。

风险与性能要求：

- 自动恢复批量大小必须可配置。
- 恢复任务不得阻塞正常行情和下单线程。

完成标准：

- 核心异常都有恢复归档和最终状态。

#### ⬛️ P2.4 对账闭环

规划目的：发现本地数据与交易所数据差异，并归档处理。

官方依据：

- OKX：订单、成交、账户余额、持仓相关官方接口。
- Binance：订单、成交、账户余额相关官方接口。
- Polymarket V1 到 V3暂不做交易对账，只做市场和信号归档一致性检查。

实现方式：

- 订单对账。
- 成交对账。
- 余额对账。
- 持仓对账。
- 差异归档、自动修复、人工确认修复、忽略。

数据归档要求：

- 差异对象必须记录本地值、交易所值、发现时间、处理动作。

风险与性能要求：

- 对账任务低频执行，禁止与行情 WebSocket 主路径竞争资源。
- 大批量对账需要分页。

完成标准：

- 差异可以发现、归档、修复、复盘。

#### ⬛️ P2.5 熔断与人工接管

规划目的：真实交易异常时可以停住执行体。

官方依据：内部运行控制模型。

实现方式：

- 全局停机。
- 账户停机。
- 策略停机。
- 连续失败熔断。
- 对账差异熔断。
- 人工接管后停止新执行，保留同步、恢复、审计。

数据归档要求：

- 开关变化和熔断触发必须写审计。

风险与性能要求：

- 开关判断必须本地缓存。
- 停机开关必须在下单前最后一刻再检查一次。

完成标准：

- 异常场景不会继续提交新真实订单。

### P3 Polymarket V1 到 V3 信号前置

#### ⬛️ P3.1 市场映射与元数据接入

规划目的：建立外部行情到 Polymarket 指定市场的稳定映射。

官方依据：

- Polymarket API Introduction
- Gamma API：`Get market by id`
- CLOB API：`Get CLOB market info`

实现方式：

- 只接人工确认市场。
- 归档 Gamma 官方字段：`id`、`question`、`conditionId`、`resolutionSource`、`endDate`、`description`、`outcomes`、`outcomePrices`、`active`、`closed`。
- 归档 CLOB token、tick size、fee、min order size 等官方字段。
- 不通过自然语言自动解析市场阈值。

数据归档要求：

- 市场映射必须关联外部行情源和 Polymarket token。

风险与性能要求：

- Gamma 和 CLOB 元数据低频刷新。

完成标准：

- 指定 BTC / ETH / SOL 市场可被稳定映射。

#### ⬛️ P3.2 实时盘口接入

规划目的：获取真实可执行盘口。

官方依据：

- Market WebSocket：`wss://ws-subscriptions-clob.polymarket.com/ws/market`
- 官方事件：`book`、`price_change`、`last_trade_price`、`tick_size_change`、`best_bid_ask`
- Orderbook 文档

实现方式：

- 订阅映射市场的 YES / NO token。
- 维护 best bid、best ask、spread、last trade、深度、tick size。
- REST 只用于初始化和兜底。

数据归档要求：

- 盘口快照保留事件时间和接收时间。

风险与性能要求：

- WebSocket 更新需要节流写库。
- 高频盘口只保留最新快照和必要历史摘要。

完成标准：

- 可以稳定获得目标市场可执行盘口。

#### ⬛️ P3.3 滞后信号生成

规划目的：基于 OKX / Binance 快速行情和 Polymarket 盘口生成候选提醒。

官方依据：

- OKX / Binance 行情来自官方行情接口。
- Polymarket 判断只使用官方 orderbook 和 WebSocket 盘口事件。

实现方式：

- 外部行情变化触发映射检查。
- 读取最新 YES / NO 盘口。
- 按内部配置判断价差机会。
- 生成候选 Polymarket 信号。

数据归档要求：

- 记录外部价格、事件时间、盘口价格、目标 outcome、原因。

风险与性能要求：

- 候选信号生成需要 TTL。
- 同一市场重复信号需要去重。

完成标准：

- 能生成可解释的 Polymarket 候选信号。

#### ⬛️ P3.4 盘口校验与风控

规划目的：过滤不可执行或风险过高的候选信号。

官方依据：

- Gamma 市场 `active`、`closed`
- CLOB orderbook
- Rate Limits

实现方式：

- 检查市场 `active` 和 `closed`。
- 检查 spread。
- 检查可成交深度。
- 检查估算成交价格。
- 检查最大投入、最大滑点、TTL、单市场提醒次数。

数据归档要求：

- 通过和拒绝都归档原因。

风险与性能要求：

- 风控只读取本地盘口快照。
- REST 查询只做必要兜底。

完成标准：

- 只有满足盘口和风控条件的信号进入提醒队列。

### P4 Polymarket V4 手动确认下单预留

#### ⬛️ P4.1 geoblock 与认证边界确认

规划目的：在进入手动下单前确认合规和认证边界。

官方依据：

- Geographic Restrictions
- Authentication
- Clients & SDKs

实现方式：

- 下单前检查 `https://polymarket.com/api/geoblock`。
- 按官方认证设计 L1 / L2 认证。
- 密钥、secret、passphrase 禁止进入普通审计 payload。

数据归档要求：

- geoblock 检查结果归档为下单前置检查。
- 认证失败只归档错误摘要。

风险与性能要求：

- geoblock 未通过禁止下单。
- 认证失败禁止进入订单提交。

完成标准：

- 未通过地理限制与认证检查时无法提交 Polymarket 手动订单。

#### ⬛️ P4.2 用户确认后手动下单

规划目的：只在用户确认后提交 Polymarket 订单。

官方依据：

- Post a new order
- Orderbook
- Authentication

实现方式：

- 下单字段完全按官方接口定义。
- 第一阶段只支持用户确认后的买 YES / 买 NO。
- 下单前再次读取最新盘口快照。
- 下单结果进入订单归档。

数据归档要求：

- 订单必须关联 Polymarket 信号、盘口快照、确认记录。

风险与性能要求：

- 确认过期后禁止提交。
- 盘口变化超过阈值后禁止提交。

完成标准：

- 用户确认后手动下单链路可审计、可恢复、可对账。

## 7. 上线闭环验收标准

### A. 官方依据验收

- ⬛️ OKX 所有字段和状态均能追溯到 OKX V5 官方文档。
- ⬛️ Binance 所有字段和状态均能追溯到 Binance Spot 官方文档。
- ⬛️ Polymarket 所有字段和状态均能追溯到 Polymarket 官方文档。
- ⬛️ 未确认字段没有进入实现。

### B. 信号闭环验收

- ⬛️ 价格规则、外部信号、Polymarket 信号都进入统一信号协议。
- ⬛️ 重复信号被拦截。
- ⬛️ 过期信号被拦截。
- ⬛️ 任意信号可追溯来源和策略实例。

### C. 风控闭环验收

- ⬛️ 风控通过和拒绝都有归档。
- ⬛️ 风控拒绝后不会进入执行任务。
- ⬛️ 日次数和日金额按本地日期归档。
- ⬛️ 真实交易开关最后一刻仍会检查。

### D. 下单闭环验收

- ⬛️ OKX 按官方字段提交。
- ⬛️ Binance 按官方字段提交。
- ⬛️ 交易规则缓存过期时禁止真实下单。
- ⬛️ 重复确认不会重复下单。

### E. 同步闭环验收

- ⬛️ 私有推送优先。
- ⬛️ REST 兜底可补齐。
- ⬛️ 旧事件不会覆盖新状态。
- ⬛️ 同步失败进入恢复任务。

### F. 成交账本闭环验收

- ⬛️ 成交不重复记账。
- ⬛️ 部分成交能正确更新。
- ⬛️ 手续费归档清晰。
- ⬛️ 持仓和余额能追溯到成交。

### G. 恢复闭环验收

- ⬛️ 核心异常都有恢复任务。
- ⬛️ 自动恢复和人工重试来源清晰。
- ⬛️ 恢复超过上限进入人工处理。
- ⬛️ 恢复全过程可审计。

### H. 对账闭环验收

- ⬛️ 订单、成交、余额、持仓可对账。
- ⬛️ 差异可发现、归档、修复、忽略。
- ⬛️ 修复动作可追溯。
- ⬛️ 对账不会污染原始审计。

### I. Polymarket 信号闭环验收

- ⬛️ 市场映射来自人工确认和官方元数据。
- ⬛️ 盘口来自官方 CLOB 和 Market WebSocket。
- ⬛️ 滞后信号基于 best bid、best ask、spread、depth。
- ⬛️ 市场关闭、深度不足、spread 过大、TTL 过期均能拒绝信号。

### J. 安全与合规验收

- ⬛️ API key、secret、passphrase 不进入普通日志和审计 payload。
- ⬛️ Polymarket geoblock 未通过时禁止下单。
- ⬛️ 真实交易必须受全局、账户、策略开关控制。
- ⬛️ 人工接管后不会继续自动下单。

### K. 性能与限频验收

- ⬛️ 实时行情和盘口走 WebSocket。
- ⬛️ REST 只做初始化、低频校准、兜底同步。
- ⬛️ 高频数据写库节流。
- ⬛️ 批量恢复、批量对账有处理上限。
- ⬛️ 页面实时刷新不能阻塞后端执行链路。

### L. 上线验收

- ⬛️ 模拟交易主链路跑通。
- ⬛️ OKX 真实小额链路跑通。
- ⬛️ Binance 测试网链路跑通。
- ⬛️ 恢复链路演练通过。
- ⬛️ 对账链路演练通过。
- ⬛️ 熔断和人工接管演练通过。
- ⬛️ Polymarket V1 到 V3 信号闭环演练通过。

## 8. 上线执行规范补强项

### 8.1 字段映射清单

#### ⬛️ 8.1.1 OKX 字段映射清单

规划目的：保证 OKX 适配器字段完全来自 OKX V5 官方文档。

官方依据：OKX V5 官方文档，重点包括 instruments、place order、get order、orders channel、account channel。

实现方式：

- 为 OKX 建立字段映射文档或代码内常量表。
- 每个字段必须记录：
  - OKX 官方字段名
  - 内部字段名
  - 使用场景
  - 是否必填
  - 缺失时处理方式
  - 原始响应归档位置
- 至少覆盖：
  - 交易规则字段
  - 下单请求字段
  - 下单响应字段
  - 订单同步字段
  - 成交字段
  - 余额字段
  - 私有推送字段

完成标准：

- 任意 OKX 字段都能追溯官方文档来源。
- OKX 适配层不允许出现未登记字段。

#### ⬛️ 8.1.2 Binance 字段映射清单

规划目的：保证 Binance Spot 适配器字段完全来自 Binance Spot 官方文档。

官方依据：Binance Spot 官方文档，重点包括 exchangeInfo、new order、query order、user data stream。

实现方式：

- 为 Binance 建立字段映射文档或代码内常量表。
- 每个字段必须记录：
  - Binance 官方字段名
  - 内部字段名
  - 使用场景
  - 是否必填
  - 缺失时处理方式
  - 原始响应归档位置
- 至少覆盖：
  - filters 字段
  - 下单请求字段
  - 下单响应字段
  - `executionReport` 字段
  - `outboundAccountPosition` 字段
  - 订单查询字段

完成标准：

- 任意 Binance 字段都能追溯官方文档来源。
- Binance 适配层不允许出现未登记字段。

#### ⬛️ 8.1.3 Polymarket 字段映射清单

规划目的：保证 Polymarket 市场、盘口、信号、后续手动下单字段完全来自官方文档。

官方依据：Polymarket Gamma、CLOB、Market WebSocket、Authentication、Geographic Restrictions、Post a new order。

实现方式：

- 为 Polymarket 建立字段映射文档或代码内常量表。
- 每个字段必须记录：
  - Polymarket 官方字段名
  - 内部字段名
  - API 来源
  - 使用场景
  - 是否必填
  - 缺失时处理方式
  - 原始响应归档位置
- 至少覆盖：
  - Gamma market 字段
  - CLOB market 字段
  - Market WebSocket 事件字段
  - Orderbook 字段
  - geoblock 检查结果
  - V4 下单字段

完成标准：

- 任意 Polymarket 字段都能追溯官方文档来源。
- 未登记字段不能进入实现。

### 8.2 状态映射与禁止迁移表

#### ⬛️ 8.2.1 OKX / Binance 订单状态映射

规划目的：防止交易所状态直接污染内部订单状态机。

官方依据：OKX 订单接口与 orders channel，Binance 订单接口与 `executionReport`。

实现方式：

- 建立交易所状态到内部状态映射表。
- 内部状态固定为：
  - `submitted`
  - `partially_filled`
  - `filled`
  - `cancelled`
  - `rejected`
  - `failed`
- 每个映射项必须记录：
  - 交易所
  - 官方状态字段
  - 官方状态值
  - 内部状态
  - 是否终态
  - 是否允许触发账本补全

完成标准：

- 订单状态更新只能通过映射表进入内部状态。

#### ⬛️ 8.2.2 禁止状态迁移规则

规划目的：防止旧事件、乱序推送、REST 旧快照造成状态回退。

官方依据：交易所事件时间、订单更新时间、成交累计量字段均以官方接口返回为准。

实现方式：

- 建立内部状态允许迁移表。
- 终态订单禁止回退到非终态。
- 成交累计量只能持平或递增。
- 事件时间旧于本地最新更新时间时，需要进入旧事件保护逻辑。
- 被拒绝的迁移必须写审计，不直接覆盖订单。

完成标准：

- 乱序推送、重复推送、REST 旧快照不会污染本地订单状态。

### 8.3 数据迁移与旧库兼容计划

#### ⬛️ 8.3.1 数据库迁移顺序

规划目的：避免新增字段、索引、表结构导致旧 SQLite 库启动失败。

实现方式：

- 新表先创建。
- 旧表补列后再创建依赖新列的索引。
- 旧数据回填必须可重复执行。
- 迁移步骤必须幂等。
- 每个迁移步骤必须有失败时的错误提示。

完成标准：

- 使用旧数据库启动时，不出现因缺列、缺表、索引提前创建导致的 500。

#### ⬛️ 8.3.2 旧数据回填规则

规划目的：保证策略实例、执行任务等新增模型接入后，旧数据仍能追溯。

实现方式：

- 现有价格规则回填为默认策略实例。
- 现有信号尽量回填 `strategyId`。
- 现有订单尽量回填来源上下文。
- 无法可靠回填的字段标记为 `legacy_unknown` 或空值，禁止猜测补全。

完成标准：

- 新模型上线后，旧数据可查询、可审计，不阻塞系统启动。

### 8.4 性能预算与资源边界

#### ⬛️ 8.4.1 实时数据性能预算

规划目的：避免行情、盘口和页面刷新影响执行体主链路。

实现方式：

- OKX / Binance 行情主路径使用 WebSocket。
- Polymarket 盘口主路径使用 Market WebSocket。
- REST 只做初始化、低频校准、兜底同步。
- 高频 WebSocket 消息只更新内存快照。
- 写库必须节流，只归档必要快照和信号。

完成标准：

- 高频行情和盘口更新不会造成后端执行任务阻塞。

#### ⬛️ 8.4.2 任务处理性能预算

规划目的：避免恢复、对账、批量任务影响实时交易。

实现方式：

- 自动恢复设置批量上限。
- 对账任务分页执行。
- 同订单同步任务串行。
- 同账户同交易对持仓更新串行。
- 执行任务、恢复任务、对账任务按状态和时间建立索引。

完成标准：

- 批量恢复和对账运行时，行情、下单、订单同步仍可继续工作。

### 8.5 人工验收表

#### ⬛️ 8.5.1 OKX / Binance 自动交易人工验收

规划目的：在不新增测试的约束下，保证上线前有可执行验收步骤。

验收步骤：

- 使用模拟交易跑通买入、卖出、成交、持仓、盈亏。
- 使用 Binance 测试网跑通真实下单、查单、私有推送、成交补全。
- 使用 OKX 小额真实交易跑通下单、查单、私有推送、成交补全。
- 人为断开私有推送，确认 REST 兜底同步可恢复。
- 人为制造下单失败，确认恢复任务和审计归档。
- 人为触发风控拒绝，确认不会生成执行任务。

完成标准：

- 每一步都有明确输入、预期归档对象、预期终态、失败处理方式。

#### ⬛️ 8.5.2 Polymarket V1 到 V3 人工验收

规划目的：确认 Polymarket 信号前置闭环不依赖猜测。

验收步骤：

- 人工配置一个 BTC 或 ETH Polymarket 市场映射。
- 拉取 Gamma 元数据并归档。
- 拉取 CLOB market info 并归档 token 信息。
- 订阅 Market WebSocket 并更新盘口快照。
- 模拟 OKX / Binance 行情变化，生成候选信号。
- 设置 spread 过大、深度不足、市场关闭、TTL 过期场景，确认信号被拒绝。
- 设置满足条件场景，确认生成提醒信号。

完成标准：

- Polymarket 信号可以从外部行情、市场映射、盘口快照、风控结果完整追溯。

### 8.6 Polymarket 市场映射审核规则

#### ⬛️ 8.6.1 市场映射人工审核

规划目的：避免系统自动误读 Polymarket 市场语义。

实现方式：

- 每个市场必须人工配置。
- 必须记录映射审核时间。
- 必须记录映射审核人或审核来源。
- 必须记录外部价格源。
- 必须记录阈值解释来自人工配置。
- 必须记录 `resolutionSource`。
- 必须记录 `endDate`。
- 必须记录 YES / NO token。
- 禁止从 `question` 自动推导阈值、方向、到期条件。

完成标准：

- 未审核市场不能进入信号判断。

#### ⬛️ 8.6.2 市场状态复核

规划目的：防止关闭、过期、无效市场继续产生信号。

实现方式：

- 每次信号生成前检查本地市场状态。
- 元数据低频刷新 `active`、`closed`、`endDate`。
- 市场关闭或过期后，自动停用映射。

完成标准：

- 已关闭或过期市场不会产生提醒信号。

### 8.7 第一版真实上线最小范围

#### ⬛️ 8.7.1 最小上线范围

规划目的：控制真实交易上线风险。

第一版上线范围：

- OKX：小额真实交易。
- Binance：优先测试网，主网只在测试网验收通过后开放。
- Polymarket：只开放 V1 到 V3 信号提醒。
- 策略：单策略、单账户、单交易对先验收。
- 自动执行：默认关闭，需要显式开启。
- 对账：至少支持订单、成交、余额基础对账。
- 熔断：全局停机、账户停机、策略停机必须可用。

完成标准：

- 超出最小上线范围的能力不能作为第一版生产默认开启项。

#### ⬛️ 8.7.2 上线禁止项

规划目的：明确哪些能力未完成前禁止进入生产。

禁止项：

- 未通过官方字段映射审查的交易所适配。
- 未通过交易规则校验的真实下单。
- 未通过风控的执行任务。
- 未通过 geoblock 的 Polymarket 下单。
- 未完成认证闭环的 Polymarket 下单。
- 未完成状态机保护的订单同步。
- 未完成恢复归档的真实下单链路。
- 未完成停机开关的自动执行。

完成标准：

- 任一禁止项未满足时，生产真实交易能力不能开启。

## 9. 当前推荐推进顺序

1. ✅ `P0.1` 统一策略实例模型。
2. ✅ `P0.2` 统一信号协议。
3. ✅ `P0.3` 建立执行编排层。
4. `P1.1` 到 `P1.4` 收口 OKX / Binance 自动下单闭环。
5. `P2.1` 到 `P2.5` 收口状态机、恢复、对账、熔断。
6. `P3.1` 到 `P3.4` 接入 Polymarket V1 到 V3。
7. `P4.1` 到 `P4.2` 评估 Polymarket V4 手动确认下单。
8. 全部通过第 7 章上线验收后，才能进入生产上线。

## 10. 上线判定与运维保障

### 10.1 完成证据清单

#### ⬛️ 10.1.1 每个路线图任务的完成证据

规划目的：保证任务完成不能只靠口头判断，必须留下可复核证据。

每个 P0 / P1 / P2 / P3 / P4 任务完成后，必须记录：

- 涉及代码文件。
- 涉及数据库迁移。
- 涉及 DTO / VO / 类型定义。
- 涉及配置项和默认值。
- 官方接口依据。
- 字段映射表。
- 数据归档对象。
- 风险控制点。
- 人工验收记录。
- 遗留风险。

完成标准：

- 没有完成证据的任务不能标记为 `✅`。

### 10.2 上线门禁规则

#### ⬛️ 10.2.1 一票否决项

规划目的：明确哪些条件未满足时禁止上线。

以下任意一项未完成，禁止开启生产真实交易：

- 官方字段映射清单未完成。
- OKX / Binance 下单字段未复核。
- 旧库迁移未验证。
- 交易规则缓存过期保护未完成。
- 风控拒绝后仍可能进入执行任务。
- 重复确认仍可能重复下单。
- 订单状态机未完成旧事件保护。
- 成交补全存在重复记账风险。
- 恢复链路未演练。
- 对账链路未演练。
- 熔断和人工接管未演练。
- API key、secret、passphrase 存在明文日志风险。
- Polymarket geoblock 未通过却启用下单。
- Polymarket 认证流程未完成却启用下单。

完成标准：

- 一票否决项全部通过后，才能进入真实交易上线验收。

### 10.3 配置与密钥安全

#### ⬛️ 10.3.1 配置完整性

规划目的：保证生产环境配置可复核、可迁移、可回滚。

实现方式：

- `.env.example` 必须覆盖全部必要配置。
- 真实交易开关默认关闭。
- Binance 主网、OKX 实盘、Polymarket 下单必须显式开启。
- 代理、限频、风控、恢复、对账配置必须有默认值和说明。
- 生产配置变更必须写审计。

完成标准：

- 新环境可以按配置说明启动到安全默认状态。

#### ⬛️ 10.3.2 密钥安全

规划目的：避免真实交易密钥泄露。

实现方式：

- API key、secret、passphrase 禁止写入仓库。
- API key、secret、passphrase 禁止进入普通日志。
- API key、secret、passphrase 禁止进入审计 payload。
- 错误摘要必须脱敏。
- 配置导出不得包含密钥。

完成标准：

- 审计、日志、配置导出中不能出现敏感密钥明文。

### 10.4 回滚与停机预案

#### ⬛️ 10.4.1 紧急停机流程

规划目的：异常时可以立即阻断新交易，同时保留必要同步能力。

实现方式：

- 全局停机立即阻断新执行任务。
- 账户停机立即阻断对应账户新执行任务。
- 策略停机立即阻断对应策略新执行任务。
- 停机后仍保留订单同步、成交补全、恢复、审计。
- 停机动作必须写审计。

完成标准：

- 停机后不会提交新真实订单，已提交订单仍可同步最终状态。

#### ⬛️ 10.4.2 回滚流程

规划目的：版本异常时能安全回退。

实现方式：

- 回滚前备份数据库。
- 回滚前记录当前运行配置。
- 回滚前确认是否有活跃订单。
- 有活跃订单时禁止直接丢弃同步能力。
- 数据库结构回滚必须有人工确认。
- 回滚后必须检查恢复任务、对账差异、订单状态。

完成标准：

- 回滚不会造成订单、成交、账本、恢复数据断链。

### 10.5 数据备份与保留策略

#### ⬛️ 10.5.1 数据备份

规划目的：保证真实交易数据可恢复。

实现方式：

- SQLite 数据库上线前必须备份。
- 每次数据库迁移前必须备份。
- 真实交易开启前必须备份。
- 备份文件需要记录时间、版本、环境。

完成标准：

- 出现迁移失败或版本回退时，可以恢复到上线前状态。

#### ⬛️ 10.5.2 数据保留策略

规划目的：控制数据量，同时保证审计和对账可追溯。

实现方式：

- 订单、成交、账本、持仓、恢复、对账差异长期保留。
- 审计日志按配置保留，但真实交易关键审计不得短期删除。
- 高频行情不长期全量保留。
- Polymarket 盘口快照只保留最新快照和必要历史摘要。
- 对账差异和修复记录长期保留。

完成标准：

- 高频数据不会无限膨胀，核心交易归档不会丢失。

### 10.6 生产观测指标

#### ⬛️ 10.6.1 执行体健康指标

规划目的：上线后能判断系统是否健康。

必须观测：

- OKX / Binance 行情 WebSocket 状态。
- OKX / Binance 私有推送状态。
- Polymarket Market WebSocket 状态。
- REST 退避状态。
- 订单提交成功率。
- 订单同步延迟。
- 成交补全延迟。
- 恢复任务积压数量。
- 对账差异数量。
- 风控拒绝数量。
- 熔断状态。
- 人工接管状态。

完成标准：

- 任一关键指标异常时，可以定位到交易所、账户、策略、交易对和故障阶段。

### 10.7 版本冻结与发布清单

#### ⬛️ 10.7.1 上线前版本冻结

规划目的：避免上线前继续引入不可控变更。

上线前必须冻结：

- 依赖版本。
- 数据库迁移。
- 环境变量。
- 交易所环境。
- 风控参数。
- 策略参数。
- 真实交易默认开关。
- 最小真实交易金额。

完成标准：

- 冻结后只允许修复上线阻塞问题，不允许继续加入新功能。

#### ⬛️ 10.7.2 发布检查清单

规划目的：保证发布动作可重复。

发布前必须确认：

- `pnpm --filter @web3/server typecheck` 通过。
- `pnpm --filter @web3/web typecheck` 通过。
- `pnpm lint` 通过。
- 数据库已备份。
- 迁移已在旧库验证。
- 模拟交易链路已验收。
- OKX 小额真实链路已验收。
- Binance 测试网链路已验收。
- Polymarket V1 到 V3 信号链路已验收。
- 恢复、对账、熔断、人工接管演练已完成。

完成标准：

- 发布检查清单全部通过后，才允许进入生产运行。
