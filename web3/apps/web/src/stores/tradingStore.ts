import { create } from 'zustand';
import type { DashboardSummary, MarketTickerSnapshot, MonitorRule, OrderRecord, TickerPrice, TriggerEvent } from '../types';
import { tradingApi } from '../api/trading';
import { createMarketPriceSnapshot, shouldAcceptMarketPrice, tickerKey } from '../utils/marketPrice';

interface TradingState {
  /** 监控总览轻量统计 */
  dashboardSummary: DashboardSummary;
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
  refreshSummary: () => Promise<void>;
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
  dashboardSummary: {
    enabledRuleCount: 0,
    ruleCount: 0,
    pendingTriggerCount: 0,
    orderCount: 0,
    tickerCount: 0
  },
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
  refreshSummary: async () => {
    set({ loading: true });
    try {
      const dashboardSummary = await tradingApi.getDashboardSummary();
      set({ dashboardSummary });
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
    const currentTickers = get().tickers;
    const currentTicker = currentTickers.find((item) => tickerKey(item) === tickerKey(ticker));
    // WebSocket 实时行情和 REST 快照都可能进入同一通道，旧 eventTime 不能覆盖新价格。
    if (!shouldAcceptMarketPrice(
      currentTicker ? createMarketPriceSnapshot(currentTicker, 'realtime') : undefined,
      createMarketPriceSnapshot(ticker, 'realtime'),
    )) {
      return;
    }

    const nextTickers = [ticker, ...currentTickers.filter((item) => tickerKey(item) !== tickerKey(ticker))];
    const nextOverview = get().marketOverview.map((item) => {
      if (tickerKey(item) !== tickerKey(ticker)) {
        return item;
      }

      return shouldAcceptMarketPrice(createMarketPriceSnapshot(item, 'rest'), createMarketPriceSnapshot(ticker, 'realtime')) ? { ...item, ...ticker } : item;
    });
    const nextSeries = [...get().priceSeries, toPricePoint(ticker)].slice(-80);
    set({
      tickers: nextTickers,
      marketOverview: nextOverview,
      priceSeries: nextSeries,
      dashboardSummary: {
        ...get().dashboardSummary,
        tickerCount: nextTickers.length
      }
    });
  },
  prependTrigger: (trigger) => {
    const currentSummary = get().dashboardSummary;
    set({
      triggers: [trigger, ...get().triggers],
      dashboardSummary: {
        ...currentSummary,
        pendingTriggerCount: trigger.status === 'pending' ? currentSummary.pendingTriggerCount + 1 : currentSummary.pendingTriggerCount
      }
    });
  }
}));
