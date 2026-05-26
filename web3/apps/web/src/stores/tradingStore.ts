import { create } from 'zustand';
import type { MarketTickerSnapshot, MonitorRule, OrderRecord, TickerPrice, TriggerEvent } from '../types';
import { tradingApi } from '../api/trading';

interface TradingState {
  /** 监控规则列表 */
  rules: MonitorRule[];
  /** 触发事件列表 */
  triggers: TriggerEvent[];
  /** 订单记录列表 */
  orders: OrderRecord[];
  /** 最新行情 */
  tickers: TickerPrice[];
  /** 总览行情快照 */
  marketOverview: MarketTickerSnapshot[];
  /** 最近行情曲线点 */
  priceSeries: Array<{ time: string; symbol: string; price: number }>;
  /** 全局加载状态 */
  loading: boolean;
  /** 规则列表加载状态 */
  rulesLoading: boolean;
  /** 触发事件加载状态 */
  triggersLoading: boolean;
  /** 订单记录加载状态 */
  ordersLoading: boolean;
  refreshAll: () => Promise<void>;
  refreshRules: () => Promise<void>;
  refreshTriggers: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  setTicker: (ticker: TickerPrice) => void;
  prependTrigger: (trigger: TriggerEvent) => void;
}

function toPricePoint(ticker: TickerPrice) {
  return {
    time: ticker.eventTime,
    symbol: ticker.symbol,
    price: Number(ticker.price)
  };
}

export const useTradingStore = create<TradingState>((set, get) => ({
  rules: [],
  triggers: [],
  orders: [],
  tickers: [],
  marketOverview: [],
  priceSeries: [],
  loading: false,
  rulesLoading: false,
  triggersLoading: false,
  ordersLoading: false,
  refreshAll: async () => {
    set({ loading: true });
    try {
      const [rules, triggers, orders, tickers, marketOverview] = await Promise.all([
        tradingApi.getRules(),
        tradingApi.getTriggers(),
        tradingApi.getOrders(),
        tradingApi.getTickers(),
        tradingApi.getMarketOverview()
      ]);
      const currentSeries = get().priceSeries;
      const tickerSource = tickers.length > 0 ? tickers : marketOverview;
      const nextSeries = currentSeries.length > 0 ? currentSeries : tickerSource.map(toPricePoint);
      set({ rules, triggers, orders, tickers, marketOverview, priceSeries: nextSeries.slice(-80) });
    } finally {
      set({ loading: false });
    }
  },
  refreshRules: async () => {
    set({ rulesLoading: true });
    try {
      const rules = await tradingApi.getRules();
      set({ rules });
    } finally {
      set({ rulesLoading: false });
    }
  },
  refreshTriggers: async () => {
    set({ triggersLoading: true });
    try {
      const triggers = await tradingApi.getTriggers();
      set({ triggers });
    } finally {
      set({ triggersLoading: false });
    }
  },
  refreshOrders: async () => {
    set({ ordersLoading: true });
    try {
      const orders = await tradingApi.getOrders();
      set({ orders });
    } finally {
      set({ ordersLoading: false });
    }
  },
  setTicker: (ticker) => {
    const nextTickers = [ticker, ...get().tickers.filter((item) => `${item.exchange}:${item.symbol}` !== `${ticker.exchange}:${ticker.symbol}`)];
    const nextOverview = get().marketOverview.map((item) =>
      `${item.exchange}:${item.symbol}` === `${ticker.exchange}:${ticker.symbol}` ? { ...item, ...ticker } : item
    );
    const nextSeries = [...get().priceSeries, toPricePoint(ticker)].slice(-80);
    set({ tickers: nextTickers, marketOverview: nextOverview, priceSeries: nextSeries });
  },
  prependTrigger: (trigger) => {
    set({ triggers: [trigger, ...get().triggers] });
  }
}));
