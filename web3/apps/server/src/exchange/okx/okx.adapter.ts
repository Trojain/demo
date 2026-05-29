import { nanoid } from 'nanoid';
import { Decimal } from 'decimal.js';
import { createHmac } from 'node:crypto';
import WebSocket from 'ws';
import type { AccountBalance, ExchangeAdapter, InstrumentRule, MarketCandle, MarketTickerSnapshot, PlaceOrderRequest, PlaceOrderResult, TickerPrice } from '../../types/exchange.js';
import { fetchExchangeJson } from '../http-client.js';
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

export class OkxAdapter implements ExchangeAdapter {
  readonly code = 'okx' as const;
  private ws?: WebSocket;
  private candleWs?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private candleReconnectTimer?: NodeJS.Timeout;
  private currentTickerSignature = '';
  private currentCandleSignature = '';
  private tickerHandler?: (ticker: TickerPrice) => void;
  private candleHandler?: (candle: MarketCandle) => void;

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

  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResult> {
    if (request.simulationMode) {
      return {
        exchangeOrderId: `sim-okx-${nanoid(12)}`,
        status: 'submitted',
        rawMessage: `OKX 模拟下单成功，symbol=${request.symbol}, side=${request.side}, type=${request.type}`
      };
    }

    throw new Error('OKX 真实下单尚未在第一版开启，请先保持 ENABLE_REAL_TRADING=false');
  }
}
