import type { ExchangeCode, OrderSide, OrderType, UnifiedOrderStatus } from './domain.js';

export interface TickerPrice {
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对 */
  symbol: string;
  /** 最新成交价，使用字符串保留精度 */
  price: string;
  /** 行情更新时间 */
  eventTime: string;
}

export interface MarketTickerSnapshot extends TickerPrice {
  /** 24 小时开盘价，用于计算涨跌幅 */
  open24h: string;
  /** 24 小时涨跌幅百分比，正数表示上涨 */
  changePercent24h: string;
  /** 24 小时基础币成交量 */
  volume24h: string;
  /** 24 小时计价币成交额，USDT 交易对通常可视为 USDT 成交额 */
  volumeCurrency24h: string;
  /** 市值字段预留，后续接入 CoinGecko 等第三方数据 */
  marketCap?: string;
}

export interface MarketCandle {
  /** 统一交易对 */
  symbol: string;
  /** K 线时间 */
  time: string;
  /** 开盘价 */
  open: string;
  /** 最高价 */
  high: string;
  /** 最低价 */
  low: string;
  /** 收盘价 */
  close: string;
  /** 基础币成交量 */
  volume: string;
  /** 计价币成交额 */
  volumeCurrency: string;
}

export interface InstrumentRule {
  /** 交易所编码 */
  exchange: ExchangeCode;
  /** 统一交易对，例如 BTC-USDT */
  symbol: string;
  /** 基础币，例如 BTC */
  baseCurrency: string;
  /** 计价币，例如 USDT */
  quoteCurrency: string;
  /** 价格最小变动单位，对应 OKX tickSz */
  tickSize: string;
  /** 数量最小变动单位，对应 OKX lotSz */
  lotSize: string;
  /** 市价单数量最小变动单位，当前主要用于 Binance MARKET_LOT_SIZE */
  marketLotSize?: string;
  /** 最小下单数量，对应 OKX minSz 或 Binance LOT_SIZE minQty */
  minSize: string;
  /** 市价单最小下单数量，当前主要用于 Binance MARKET_LOT_SIZE minQty */
  marketMinSize?: string;
  /** 最小成交额，对应 Binance MIN_NOTIONAL 或 NOTIONAL */
  minNotional?: string;
  /** 交易对状态，OKX live 表示可交易 */
  state: string;
}

export interface PlaceOrderRequest {
  /** 统一交易对 */
  symbol: string;
  /** 买入或卖出 */
  side: OrderSide;
  /** 市价或限价 */
  type: OrderType;
  /** 基础币数量 */
  baseQuantity?: string;
  /** 计价币金额 */
  quoteAmount?: string;
  /** 限价单价格 */
  price?: string;
  /** 客户端订单号，方便幂等和排查 */
  clientOrderId: string;
  /** 是否模拟下单 */
  simulationMode: boolean;
}

export interface PlaceOrderResult {
  /** 交易所订单号或本地模拟订单号 */
  exchangeOrderId: string;
  /** 统一订单状态 */
  status: UnifiedOrderStatus;
  /** 客户端订单号，后续幂等、防重和日志排查依赖该字段 */
  clientOrderId?: string;
  /** 交易所受理时间，无法获取时可为空 */
  acceptedAt?: string;
  /** 交易所返回的委托价格摘要 */
  price?: string;
  /** 交易所返回的基础币数量摘要 */
  baseQuantity?: string;
  /** 交易所返回的计价币金额摘要 */
  quoteAmount?: string;
  /** 原始响应摘要 */
  rawMessage: string;
}

export interface AccountBalance {
  /** 币种，例如 USDT 或 BTC */
  currency: string;
  /** 可用余额 */
  available: string;
  /** 冻结余额 */
  locked: string;
  /** 总余额 */
  total: string;
  /** 余额查询错误，真实交易前置校验失败时返回 */
  error?: string;
}

export interface ExchangeAdapter {
  /** 交易所编码 */
  readonly code: ExchangeCode;
  /** 订阅行情，收到价格后通过回调交给行情服务 */
  connectTickerStream(symbols: string[], onTicker: (ticker: TickerPrice) => void): void;
  /** 订阅 K 线，图表实时曲线使用交易所官方 candle 数据，返回取消订阅函数 */
  connectCandleStream?(symbol: string, bar: string, onCandle: (candle: MarketCandle) => void): () => void;
  /** 查询最新价格，WebSocket 暂无数据时作为补偿 */
  getLatestPrice(symbol: string): Promise<TickerPrice>;
  /** 查询完整行情快照，用于总览行情列表 */
  getTickerSnapshot?(symbol: string): Promise<MarketTickerSnapshot>;
  /** 批量查询完整行情快照，用于总览行情列表降低 REST 请求数量 */
  getTickerSnapshots?(symbols: string[]): Promise<MarketTickerSnapshot[]>;
  /** 查询 K 线，用于价格走势，after 用于向更早时间分页 */
  getCandles?(symbol: string, bar: string, limit: number, after?: string): Promise<MarketCandle[]>;
  /** 查询交易规则，用于下单前校验 */
  getInstrumentRules?(): Promise<InstrumentRule[]>;
  /** 查询账户余额，真实交易前校验使用 */
  getAccountBalances?(currencies?: string[]): Promise<AccountBalance[]>;
  /** 下单接口，第一版只开放模拟下单，真实下单预留 */
  placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResult>;
}
