import { create } from 'zustand';
import type { DashboardSummary, MonitorRule, OrderRecord, TickerPrice, TriggerEvent } from '../types';
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
  /** 最新行情索引，按交易所和交易对精确定位 */
  tickerMap: Record<string, TickerPrice>;
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
  tickerMap: {},
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
    const tickerId = tickerKey(ticker);
    const currentTicker = get().tickerMap[tickerId];
    // WebSocket 实时行情和 REST 快照都可能进入同一通道，旧 eventTime 不能覆盖新价格。
    if (!shouldAcceptMarketPrice(
      currentTicker ? createMarketPriceSnapshot(currentTicker, 'realtime') : undefined,
      createMarketPriceSnapshot(ticker, 'realtime'),
    )) {
      return;
    }

    set((state) => {
      const nextTickerMap = {
        ...state.tickerMap,
        [tickerId]: ticker,
      };
      const nextTickerCount = currentTicker ? state.dashboardSummary.tickerCount : state.dashboardSummary.tickerCount + 1;

      return {
        tickerMap: nextTickerMap,
        // 只在缓存数量变化时更新总览统计，避免所有订阅 dashboardSummary 的页面跟随每一笔行情重渲染。
        dashboardSummary: nextTickerCount === state.dashboardSummary.tickerCount
          ? state.dashboardSummary
          : {
              ...state.dashboardSummary,
              tickerCount: nextTickerCount,
            },
      };
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
