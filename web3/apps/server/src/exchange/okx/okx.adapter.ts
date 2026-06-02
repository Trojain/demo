import { nanoid } from 'nanoid';
import { Decimal } from 'decimal.js';
import { createHmac } from 'node:crypto';
import WebSocket from 'ws';
import type {
  AccountBalance,
  ExchangeAdapter,
  GetOrderDetailRequest,
  GetOrderDetailResult,
  InstrumentRule,
  MarketCandle,
  MarketTickerSnapshot,
  PlaceOrderRequest,
  PlaceOrderResult,
  PrivateTradeStreamHandlers,
  TickerPrice,
} from '../../types/exchange.js';
import { fetchExchangeJson } from '../http-client.js';
import { normalizeExchangeOrderError } from '../exchange-order-error.js';
import { toDisplaySymbol, toOkxInstId } from '../symbol.js';
import { appConfig } from '../../config/env.js';
import { createExchangeWebSocket } from '../ws-client.js';

type OkxTickerResponse = {
  data?: Array<{
    instId: string;
    last: string;
    open24h?: string;
    vol24h?: string;
    volCcy24h?: string;
    ts: string;
  }>;
};

type OkxCandlesResponse = {
  data?: Array<[string, string, string, string, string, string, string, string, string]>;
};

type OkxInstrumentsResponse = {
  data?: Array<{
    instId: string;
    baseCcy: string;
    quoteCcy: string;
    tickSz: string;
    lotSz: string;
    minSz: string;
    state: string;
  }>;
};

type OkxBalanceResponse = {
  data?: Array<{
    details?: Array<{
      ccy: string;
      availBal?: string;
      availEq?: string;
      frozenBal?: string;
      cashBal?: string;
      eq?: string;
    }>;
  }>;
};

type OkxPlaceOrderResponse = {
  code?: string;
  msg?: string;
  data?: Array<{
    ordId?: string;
    clOrdId?: string;
    sCode?: string;
    sMsg?: string;
    ts?: string;
  }>;
};

type OkxOrderDetailResponse = {
  data?: Array<{
    ordId?: string;
    state?: string;
    avgPx?: string;
    px?: string;
    accFillSz?: string;
    fee?: string;
    feeCcy?: string;
    uTime?: string;
  }>;
};

type OkxPrivateEventResponse = {
  event?: string;
  code?: string;
  msg?: string;
  arg?: {
    channel?: string;
  };
};

type OkxPrivateOrderStreamResponse = OkxPrivateEventResponse & {
  arg?: {
    channel?: string;
    instId?: string;
  };
  data?: Array<{
    ordId?: string;
    instId?: string;
    state?: string;
    avgPx?: string;
    px?: string;
    accFillSz?: string;
    fee?: string;
    feeCcy?: string;
    uTime?: string;
  }>;
};

type OkxPrivateAccountStreamResponse = OkxPrivateEventResponse & {
  data?: Array<{
    uTime?: string;
    details?: Array<{
      ccy?: string;
      availBal?: string;
      availEq?: string;
      frozenBal?: string;
      cashBal?: string;
      eq?: string;
    }>;
  }>;
};

export class OkxAdapter implements ExchangeAdapter {
  readonly code = 'okx' as const;
  private ws?: WebSocket;
  private candleWs?: WebSocket;
  private privateTradeWs?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private candleReconnectTimer?: NodeJS.Timeout;
  private privateTradeReconnectTimer?: NodeJS.Timeout;
  private currentTickerSignature = '';
  private currentCandleSignature = '';
  private tickerHandler?: (ticker: TickerPrice) => void;
  private candleHandler?: (candle: MarketCandle) => void;
  private privateTradeHandlers?: PrivateTradeStreamHandlers;
  private privateTradeStopRequested = false;

  connectTickerStream(symbols: string[], onTicker: (ticker: TickerPrice) => void) {
    const uniqueSymbols = [...new Set(symbols.map(toOkxInstId))].sort();
    if (uniqueSymbols.length === 0) {
      return;
    }

    const signature = uniqueSymbols.join('|');
    this.tickerHandler = onTicker;
    const tickerSocketActive = this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN;
    if (this.currentTickerSignature === signature && tickerSocketActive) {
      return;
    }

    this.currentTickerSignature = signature;
    this.ws?.close();
    this.ws = createExchangeWebSocket('wss://ws.okx.com:8443/ws/v5/public');

    this.ws.on('open', () => {
      this.ws?.send(
        JSON.stringify({
          op: 'subscribe',
          args: uniqueSymbols.map((instId) => ({ channel: 'tickers', instId }))
        })
      );
    });

    this.ws.on('message', (raw) => {
      const payload = JSON.parse(raw.toString()) as OkxTickerResponse;
      const ticker = payload.data?.[0];
      if (!ticker?.last) {
        return;
      }

      this.tickerHandler?.({
        exchange: this.code,
        symbol: toDisplaySymbol(ticker.instId),
        price: ticker.last,
        eventTime: new Date(Number(ticker.ts)).toISOString()
      });
    });

    this.ws.on('close', () => {
      clearTimeout(this.reconnectTimer);
      const reconnectSymbols = this.currentTickerSignature.split('|').filter(Boolean);
      const reconnectHandler = this.tickerHandler;
      if (reconnectSymbols.length > 0 && reconnectHandler) {
        this.reconnectTimer = setTimeout(() => {
          this.currentTickerSignature = '';
          this.connectTickerStream(reconnectSymbols, reconnectHandler);
        }, 3000);
      }
    });

    this.ws.on('error', () => {
      console.warn('OKX ticker WebSocket 异常，准备重连');
      this.ws?.close();
    });
  }

  async getLatestPrice(symbol: string): Promise<TickerPrice> {
    const snapshot = await this.getTickerSnapshot(symbol);
    return {
      exchange: snapshot.exchange,
      symbol: snapshot.symbol,
      price: snapshot.price,
      eventTime: snapshot.eventTime
    };
  }

  async getTickerSnapshot(symbol: string): Promise<MarketTickerSnapshot> {
    const instId = toOkxInstId(symbol);
    const payload = await fetchExchangeJson<OkxTickerResponse>(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`);
    const ticker = payload.data?.[0];
    if (!ticker?.last) {
      throw new Error(`OKX 未返回 ${instId} 的有效价格`);
    }

    const open24h = ticker.open24h ?? ticker.last;
    const changePercent24h = new Decimal(ticker.last).minus(open24h).div(open24h).mul(100).toFixed(2);

    return {
      exchange: this.code,
      symbol: toDisplaySymbol(ticker.instId),
      price: ticker.last,
      eventTime: new Date(Number(ticker.ts)).toISOString(),
      open24h,
      changePercent24h,
      volume24h: ticker.vol24h ?? '0',
      volumeCurrency24h: ticker.volCcy24h ?? '0'
    };
  }

  async getTickerSnapshots(symbols: string[]): Promise<MarketTickerSnapshot[]> {
    const expectedInstIds = new Set(symbols.map(toOkxInstId));
    const payload = await fetchExchangeJson<OkxTickerResponse>('https://www.okx.com/api/v5/market/tickers?instType=SPOT');

    return (payload.data ?? [])
      .filter((ticker) => expectedInstIds.has(ticker.instId) && Boolean(ticker.last))
      .map((ticker) => {
        const open24h = ticker.open24h ?? ticker.last;
        const changePercent24h = new Decimal(ticker.last).minus(open24h).div(open24h).mul(100).toFixed(2);

        return {
          exchange: this.code,
          symbol: toDisplaySymbol(ticker.instId),
          price: ticker.last,
          eventTime: new Date(Number(ticker.ts)).toISOString(),
          open24h,
          changePercent24h,
          volume24h: ticker.vol24h ?? '0',
          volumeCurrency24h: ticker.volCcy24h ?? '0'
        };
      });
  }

  async getCandles(symbol: string, bar: string, limit: number, after?: string): Promise<MarketCandle[]> {
    const instId = toOkxInstId(symbol);
    const params = new URLSearchParams({
      instId,
      bar,
      limit: String(limit)
    });

    if (after) {
      params.set('after', after);
    }

    const payload = await fetchExchangeJson<OkxCandlesResponse>(`https://www.okx.com/api/v5/market/candles?${params.toString()}`);

    return (payload.data ?? [])
      .map((item) => ({
        symbol: toDisplaySymbol(instId),
        time: new Date(Number(item[0])).toISOString(),
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5],
        volumeCurrency: item[6]
      }))
      .reverse();
  }

  connectCandleStream(symbol: string, bar: string, onCandle: (candle: MarketCandle) => void) {
    const instId = toOkxInstId(symbol);
    const channel = `candle${bar}`;
    const signature = `${instId}:${channel}`;
    this.candleHandler = onCandle;
    const candleSocketActive = this.candleWs?.readyState === WebSocket.CONNECTING || this.candleWs?.readyState === WebSocket.OPEN;
    if (this.currentCandleSignature === signature && candleSocketActive) {
      return () => undefined;
    }

    this.currentCandleSignature = signature;
    clearTimeout(this.candleReconnectTimer);
    this.candleWs?.close();
    // OKX K 线 WebSocket 属于 business 频道，ticker 才使用 public 频道。
    this.candleWs = createExchangeWebSocket('wss://ws.okx.com:8443/ws/v5/business');

    this.candleWs.on('open', () => {
      this.candleWs?.send(
        JSON.stringify({
          op: 'subscribe',
          args: [{ channel, instId }]
        })
      );
    });

    this.candleWs.on('message', (raw) => {
      const payload = JSON.parse(raw.toString()) as OkxCandlesResponse;
      const item = payload.data?.[0];
      if (!item) {
        return;
      }

      this.candleHandler?.({
        symbol: toDisplaySymbol(instId),
        time: new Date(Number(item[0])).toISOString(),
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5],
        volumeCurrency: item[6]
      });
    });

    this.candleWs.on('close', () => {
      const reconnectSignature = this.currentCandleSignature;
      const reconnectHandler = this.candleHandler;
      if (reconnectSignature === signature && reconnectHandler) {
        this.candleReconnectTimer = setTimeout(() => {
          this.currentCandleSignature = '';
          this.connectCandleStream(symbol, bar, reconnectHandler);
        }, 3000);
      }
    });

    this.candleWs.on('error', () => {
      console.warn('OKX K 线 WebSocket 异常，准备重连');
      this.candleWs?.close();
    });

    return () => {
      if (this.currentCandleSignature !== signature) {
        return;
      }

      this.currentCandleSignature = '';
      clearTimeout(this.candleReconnectTimer);
      this.candleWs?.close();
      this.candleWs = undefined;
    };
  }

  async getInstrumentRules(): Promise<InstrumentRule[]> {
    const payload = await fetchExchangeJson<OkxInstrumentsResponse>('https://www.okx.com/api/v5/public/instruments?instType=SPOT');

    return (payload.data ?? []).map((item) => ({
      exchange: this.code,
      symbol: toDisplaySymbol(item.instId),
      baseCurrency: item.baseCcy,
      quoteCurrency: item.quoteCcy,
      tickSize: item.tickSz,
      lotSize: item.lotSz,
      minSize: item.minSz,
      state: item.state
    }));
  }

  async getAccountBalances(currencies?: string[]): Promise<AccountBalance[]> {
    if (!appConfig.okx.apiKey || !appConfig.okx.apiSecret || !appConfig.okx.passphrase) {
      throw new Error('OKX API Key、Secret 或 Passphrase 未配置，无法查询真实账户余额');
    }

    const query = currencies?.length ? `?ccy=${currencies.map(currency => currency.toUpperCase()).join(',')}` : '';
    const requestPath = `/api/v5/account/balance${query}`;
    const timestamp = new Date().toISOString();
    const signature = createHmac('sha256', appConfig.okx.apiSecret)
      .update(`${timestamp}GET${requestPath}`)
      .digest('base64');
    const payload = await fetchExchangeJson<OkxBalanceResponse>(`https://www.okx.com${requestPath}`, {
      method: 'GET',
      headers: {
        'OK-ACCESS-KEY': appConfig.okx.apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': appConfig.okx.passphrase,
        'x-simulated-trading': appConfig.okx.simulated ? '1' : '0',
      },
    });

    return (payload.data?.[0]?.details ?? []).map(item => {
      const available = item.availBal || item.availEq || '0';
      const locked = item.frozenBal || '0';
      const total = item.eq || item.cashBal || new Decimal(available).plus(locked).toFixed();
      return {
        currency: item.ccy,
        available,
        locked,
        total,
      };
    });
  }

  connectPrivateTradeStream(handlers: PrivateTradeStreamHandlers) {
    if (!appConfig.okx.apiKey || !appConfig.okx.apiSecret || !appConfig.okx.passphrase) {
      return () => undefined;
    }

    this.privateTradeHandlers = handlers;
    this.privateTradeStopRequested = false;
    clearTimeout(this.privateTradeReconnectTimer);
    this.privateTradeWs?.close();
    this.privateTradeHandlers.onStatusChange?.('connecting');
    this.openPrivateTradeStream();

    return () => {
      this.privateTradeStopRequested = true;
      clearTimeout(this.privateTradeReconnectTimer);
      this.privateTradeReconnectTimer = undefined;
      this.privateTradeHandlers?.onStatusChange?.('stopped');
      this.privateTradeWs?.close();
      this.privateTradeWs = undefined;
    };
  }

  async getOrderDetail(request: GetOrderDetailRequest): Promise<GetOrderDetailResult> {
    try {
      if (!appConfig.okx.apiKey || !appConfig.okx.apiSecret || !appConfig.okx.passphrase) {
        throw new Error('OKX API Key、Secret 或 Passphrase 未配置，无法查询真实订单详情');
      }

      const params = new URLSearchParams({
        instId: toOkxInstId(request.symbol),
        ordId: request.exchangeOrderId,
      });
      const requestPath = `/api/v5/trade/order?${params.toString()}`;
      const timestamp = new Date().toISOString();
      const signature = createHmac('sha256', appConfig.okx.apiSecret)
        .update(`${timestamp}GET${requestPath}`)
        .digest('base64');
      const payload = await fetchExchangeJson<OkxOrderDetailResponse>(`https://www.okx.com${requestPath}`, {
        method: 'GET',
        headers: {
          'OK-ACCESS-KEY': appConfig.okx.apiKey,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': appConfig.okx.passphrase,
          'x-simulated-trading': appConfig.okx.simulated ? '1' : '0',
        },
      });
      const detail = payload.data?.[0];
      if (!detail?.ordId) {
        throw new Error(`OKX 订单详情返回缺少 ordId，响应=${JSON.stringify(payload)}`);
      }

      const averagePrice = this.resolvePositiveDecimal(detail.avgPx) ?? this.resolvePositiveDecimal(detail.px);
      const accumulatedBaseQuantity = this.resolvePositiveDecimal(detail.accFillSz);
      return {
        status: this.mapOrderState(detail.state),
        price: averagePrice,
        baseQuantity: accumulatedBaseQuantity,
        // OKX 订单详情会返回累计成交数量和均价，这里按官方字段推导累计成交额，用于本地账本和页面展示。
        quoteAmount:
          averagePrice && accumulatedBaseQuantity
            ? new Decimal(averagePrice).mul(accumulatedBaseQuantity).toFixed()
            : undefined,
        feeAmount: detail.fee ? new Decimal(detail.fee).abs().toFixed() : undefined,
        feeCurrency: detail.feeCcy,
        updatedAt: detail.uTime ? new Date(Number(detail.uTime)).toISOString() : undefined,
        rawMessage: JSON.stringify(payload),
      };
    } catch (error) {
      throw normalizeExchangeOrderError(this.code, error);
    }
  }

  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResult> {
    try {
      if (request.simulationMode) {
        return {
          exchangeOrderId: `sim-okx-${nanoid(12)}`,
          status: 'submitted',
          clientOrderId: request.clientOrderId,
          acceptedAt: new Date().toISOString(),
          price: request.price,
          baseQuantity: request.baseQuantity,
          quoteAmount: request.quoteAmount,
          rawMessage: `OKX 模拟下单成功，symbol=${request.symbol}, side=${request.side}, type=${request.type}`
        };
      }

      if (!appConfig.okx.apiKey || !appConfig.okx.apiSecret || !appConfig.okx.passphrase) {
        throw new Error('OKX API Key、Secret 或 Passphrase 未配置，无法发起真实下单');
      }

      const instId = toOkxInstId(request.symbol);
      const timestamp = new Date().toISOString();
      const requestPath = '/api/v5/trade/order';
      const body = this.buildPlaceOrderBody(request, instId);
      const bodyJson = JSON.stringify(body);
      const signature = createHmac('sha256', appConfig.okx.apiSecret)
        .update(`${timestamp}POST${requestPath}${bodyJson}`)
        .digest('base64');
      const payload = await fetchExchangeJson<OkxPlaceOrderResponse>(`https://www.okx.com${requestPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'OK-ACCESS-KEY': appConfig.okx.apiKey,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': appConfig.okx.passphrase,
          'x-simulated-trading': appConfig.okx.simulated ? '1' : '0',
        },
        body: bodyJson,
      });
      const orderResult = payload.data?.[0];
      if (orderResult?.sCode && orderResult.sCode !== '0') {
        throw new Error(`OKX 下单失败，错误码 ${orderResult.sCode}${orderResult.sMsg ? `，${orderResult.sMsg}` : ''}`);
      }
      if (!orderResult?.ordId) {
        throw new Error(`OKX 下单返回缺少 ordId，响应=${JSON.stringify(payload)}`);
      }

      return {
        exchangeOrderId: orderResult.ordId,
        status: 'submitted',
        clientOrderId: orderResult.clOrdId ?? request.clientOrderId,
        acceptedAt: orderResult.ts ? new Date(Number(orderResult.ts)).toISOString() : timestamp,
        price: request.price,
        baseQuantity: request.baseQuantity,
        quoteAmount: request.quoteAmount,
        rawMessage: JSON.stringify({
          code: payload.code ?? '0',
          msg: payload.msg ?? '',
          data: orderResult,
        }),
      };
    } catch (error) {
      throw normalizeExchangeOrderError(this.code, error);
    }
  }

  private buildPlaceOrderBody(request: PlaceOrderRequest, instId: string) {
    const size = this.resolveOrderSize(request);
    const body: Record<string, string | boolean> = {
      instId,
      tdMode: 'cash',
      side: request.side,
      ordType: request.type,
      sz: size,
      clOrdId: request.clientOrderId,
    };

    if (request.type === 'limit') {
      if (!request.price) {
        throw new Error('OKX 限价单缺少 price');
      }

      body.px = request.price;
      return body;
    }

    // 官方文档说明现货市价单可通过 banAmend 禁止余额不足时被系统自动缩单，便于预检口径和最终结果保持一致。
    body.banAmend = true;
    if (request.quoteAmount) {
      body.tgtCcy = 'quote_ccy';
    } else if (request.baseQuantity) {
      body.tgtCcy = 'base_ccy';
    }

    return body;
  }

  private resolveOrderSize(request: PlaceOrderRequest) {
    if (request.type === 'limit' && !request.baseQuantity) {
      // 真实限价单统一要求上游先提供基础币数量，避免交易所对 quoteAmount 口径差异造成拒单。
      throw new Error('OKX 真实限价单必须提供基础币数量');
    }

    const size = request.baseQuantity ?? request.quoteAmount;
    if (!size) {
      throw new Error('OKX 下单缺少数量参数');
    }

    return size;
  }

  private openPrivateTradeStream() {
    this.privateTradeWs = createExchangeWebSocket('wss://ws.okx.com:8443/ws/v5/private');

    this.privateTradeWs.on('open', () => {
      this.privateTradeWs?.send(JSON.stringify(this.buildPrivateLoginPayload()));
    });

    this.privateTradeWs.on('message', raw => {
      if (raw.toString() === 'pong') {
        return;
      }

      const payload = JSON.parse(raw.toString()) as OkxPrivateOrderStreamResponse | OkxPrivateAccountStreamResponse;
      if (payload.event === 'login') {
        if (payload.code !== '0') {
          this.privateTradeHandlers?.onStatusChange?.('error', payload.msg ?? payload.code ?? '未知错误');
          this.privateTradeHandlers?.onError?.(new Error(`OKX 私有推送登录失败：${payload.msg ?? payload.code ?? '未知错误'}`));
          this.privateTradeWs?.close();
          return;
        }

        this.privateTradeHandlers?.onStatusChange?.('connected');
        this.subscribePrivateChannels();
        return;
      }

      if (payload.event === 'error') {
        this.privateTradeHandlers?.onStatusChange?.('error', payload.msg ?? payload.code ?? '未知错误');
        this.privateTradeHandlers?.onError?.(new Error(`OKX 私有推送异常：${payload.msg ?? payload.code ?? '未知错误'}`));
        return;
      }

      if (payload.arg?.channel === 'orders') {
        this.handlePrivateOrderMessage(payload as OkxPrivateOrderStreamResponse);
        return;
      }

      if (payload.arg?.channel === 'account') {
        this.handlePrivateAccountMessage(payload as OkxPrivateAccountStreamResponse);
      }
    });

    this.privateTradeWs.on('ping', data => {
      this.privateTradeWs?.pong(data);
    });

    this.privateTradeWs.on('close', () => {
      this.privateTradeWs = undefined;
      if (this.privateTradeStopRequested) {
        return;
      }

      this.privateTradeHandlers?.onStatusChange?.('reconnecting');
      clearTimeout(this.privateTradeReconnectTimer);
      this.privateTradeReconnectTimer = setTimeout(() => {
        this.openPrivateTradeStream();
      }, 3000);
    });

    this.privateTradeWs.on('error', error => {
      this.privateTradeHandlers?.onStatusChange?.('error', error instanceof Error ? error.message : 'OKX 私有推送连接异常');
      this.privateTradeHandlers?.onError?.(error instanceof Error ? error : new Error('OKX 私有推送连接异常'));
      this.privateTradeWs?.close();
    });
  }

  private buildPrivateLoginPayload() {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', appConfig.okx.apiSecret)
      .update(`${timestamp}GET/users/self/verify`)
      .digest('base64');

    return {
      op: 'login',
      args: [{
        apiKey: appConfig.okx.apiKey,
        passphrase: appConfig.okx.passphrase,
        timestamp,
        sign: signature,
      }],
    };
  }

  private subscribePrivateChannels() {
    this.privateTradeWs?.send(JSON.stringify({
      op: 'subscribe',
      args: [
        { channel: 'orders', instType: 'SPOT' },
        { channel: 'account', extraParams: JSON.stringify({ updateInterval: '0' }) },
      ],
    }));
  }

  private handlePrivateOrderMessage(payload: OkxPrivateOrderStreamResponse) {
    payload.data?.forEach(item => {
      if (!item.ordId || !item.instId) {
        return;
      }

      const price = this.resolvePositiveDecimal(item.avgPx) ?? this.resolvePositiveDecimal(item.px);
      const baseQuantity = this.resolvePositiveDecimal(item.accFillSz);
      this.privateTradeHandlers?.onOrderUpdate({
        exchange: this.code,
        symbol: toDisplaySymbol(item.instId),
        exchangeOrderId: item.ordId,
        status: this.mapOrderState(item.state),
        price,
        baseQuantity,
        quoteAmount: price && baseQuantity ? new Decimal(price).mul(baseQuantity).toFixed() : undefined,
        feeAmount: item.fee ? new Decimal(item.fee).abs().toFixed() : undefined,
        feeCurrency: item.feeCcy,
        updatedAt: item.uTime ? new Date(Number(item.uTime)).toISOString() : undefined,
        rawMessage: JSON.stringify(item),
      });
    });
  }

  private handlePrivateAccountMessage(payload: OkxPrivateAccountStreamResponse) {
    payload.data?.forEach(item => {
      const balances = (item.details ?? [])
        .filter(detail => Boolean(detail.ccy))
        .map(detail => {
          const available = detail.availBal || detail.availEq || '0';
          const locked = detail.frozenBal || '0';
          const total = detail.eq || detail.cashBal || new Decimal(available).plus(locked).toFixed();
          return {
            currency: detail.ccy!,
            available,
            locked,
            total,
          };
        });
      if (balances.length === 0) {
        return;
      }

      this.privateTradeHandlers?.onBalanceUpdate?.({
        exchange: this.code,
        balances,
        updatedAt: item.uTime ? new Date(Number(item.uTime)).toISOString() : undefined,
        rawMessage: JSON.stringify(item),
      });
    });
  }

  private mapOrderState(state?: string): GetOrderDetailResult['status'] {
    switch ((state || '').toLowerCase()) {
      case 'live':
        return 'submitted';
      case 'partially_filled':
        return 'partially_filled';
      case 'filled':
        return 'filled';
      case 'canceled':
      case 'mmp_canceled':
        return 'cancelled';
      case 'order_failed':
        return 'failed';
      default:
        return 'submitted';
    }
  }

  private resolvePositiveDecimal(value?: string) {
    if (!value) {
      return undefined;
    }

    try {
      const decimalValue = new Decimal(value);
      return decimalValue.greaterThan(0) ? decimalValue.toFixed() : undefined;
    } catch {
      return undefined;
    }
  }
}
