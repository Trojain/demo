import { apiClient } from './client';
import type {
  AuditLog,
  CreateRulePayload,
  DashboardSummary,
  ExchangeCode,
  InstrumentRule,
  MarketCandle,
  MarketHealth,
  MarketTickerSnapshot,
  MonitorRule,
  OrderPreview,
  OrderRecord,
  RiskConfig,
  RiskCheck,
  TickerPrice,
  TradeAccount,
  TradeEquityHistoryPoint,
  TradeAccountSummary,
  TradeAccountType,
  TradeFill,
  TradeOrderPayload,
  TradeOrderPreview,
  TradeOperationLog,
  TradePosition,
  TradePositionView,
  TradingSignal,
  TriggerEvent,
  UpdateRiskConfigPayload,
  UpdateRulePayload
} from '../types';

export const tradingApi = {
  getDashboardSummary: async () => {
    const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary');
    return data;
  },
  getRules: async () => {
    const { data } = await apiClient.get<MonitorRule[]>('/rules');
    return data;
  },
  createRule: async (payload: CreateRulePayload) => {
    const { data } = await apiClient.post<MonitorRule>('/rules', payload);
    return data;
  },
  updateRule: async (id: string, payload: UpdateRulePayload) => {
    const { data } = await apiClient.put<MonitorRule>(`/rules/${id}`, payload);
    return data;
  },
  toggleRule: async (id: string, enabled: boolean) => {
    const { data } = await apiClient.patch<MonitorRule>(`/rules/${id}/toggle`, { enabled });
    return data;
  },
  deleteRule: async (id: string) => {
    await apiClient.delete(`/rules/${id}`);
  },
  getTriggers: async () => {
    const { data } = await apiClient.get<TriggerEvent[]>('/triggers');
    return data;
  },
  deleteTrigger: async (id: string) => {
    await apiClient.delete(`/triggers/${id}`);
  },
  getSignals: async (limit = 100) => {
    const { data } = await apiClient.get<TradingSignal[]>('/signals', {
      params: { limit }
    });
    return data;
  },
  deleteSignal: async (id: string) => {
    await apiClient.delete(`/signals/${id}`);
  },
  getRiskChecks: async (limit = 100) => {
    const { data } = await apiClient.get<RiskCheck[]>('/risk-checks', {
      params: { limit }
    });
    return data;
  },
  deleteRiskCheck: async (id: string) => {
    await apiClient.delete(`/risk-checks/${id}`);
  },
  getRiskConfig: async () => {
    const { data } = await apiClient.get<RiskConfig>('/risk-config');
    return data;
  },
  getTradeAccounts: async (mode?: TradeAccountType) => {
    const { data } = await apiClient.get<TradeAccount[]>('/trade/accounts', {
      params: { mode }
    });
    return data;
  },
  getTradePositions: async (mode?: TradeAccountType, exchange?: ExchangeCode) => {
    const { data } = await apiClient.get<TradePosition[]>('/trade/positions', {
      params: { mode, exchange }
    });
    return data;
  },
  getTradeFills: async (mode?: TradeAccountType, exchange?: ExchangeCode, limit = 100) => {
    const { data } = await apiClient.get<TradeFill[]>('/trade/fills', {
      params: { mode, exchange, limit }
    });
    return data;
  },
  getTradeLogs: async (mode?: TradeAccountType, exchange?: ExchangeCode, limit = 100) => {
    const { data } = await apiClient.get<TradeOperationLog[]>('/trade/logs', {
      params: { mode, exchange, limit }
    });
    return data;
  },
  getTradeSummary: async (mode?: TradeAccountType) => {
    const { data } = await apiClient.get<TradeAccountSummary[]>('/trade/summary', {
      params: { mode }
    });
    return data;
  },
  getTradeEquityHistory: async (mode?: TradeAccountType, exchange?: ExchangeCode, days = 30) => {
    const { data } = await apiClient.get<TradeEquityHistoryPoint[]>('/trade/equity-history', {
      params: { mode, exchange, days }
    });
    return data;
  },
  getTradePositionValuations: async (mode?: TradeAccountType, exchange?: ExchangeCode) => {
    const { data } = await apiClient.get<TradePositionView[]>('/trade/positions/valuation', {
      params: { mode, exchange }
    });
    return data;
  },
  previewTradeOrder: async (payload: TradeOrderPayload) => {
    const { data } = await apiClient.post<TradeOrderPreview>('/trade/orders/preview', payload);
    return data;
  },
  confirmTradeOrder: async (preview: TradeOrderPayload) => {
    const { data } = await apiClient.post<OrderRecord>('/trade/orders/confirm', { preview });
    return data;
  },
  getSimulationAccounts: async () => {
    return tradingApi.getTradeAccounts('simulation');
  },
  getSimulationPositions: async (exchange?: ExchangeCode) => {
    return tradingApi.getTradePositions('simulation', exchange);
  },
  getSimulationFills: async (exchange?: ExchangeCode, limit = 100) => {
    return tradingApi.getTradeFills('simulation', exchange, limit);
  },
  getSimulationLogs: async (exchange?: ExchangeCode, limit = 100) => {
    return tradingApi.getTradeLogs('simulation', exchange, limit);
  },
  updateRiskConfig: async (payload: UpdateRiskConfigPayload) => {
    const { data } = await apiClient.put<RiskConfig>('/risk-config', payload);
    return data;
  },
  confirmOrder: async (triggerId: string) => {
    const { data } = await apiClient.post<OrderRecord>('/orders/confirm', { triggerId });
    return data;
  },
  previewOrder: async (triggerId: string) => {
    const { data } = await apiClient.post<OrderPreview>('/orders/preview', { triggerId });
    return data;
  },
  ignoreTrigger: async (triggerId: string) => {
    const { data } = await apiClient.patch<TriggerEvent>(`/triggers/${triggerId}/ignore`);
    return data;
  },
  getOrders: async () => {
    const { data } = await apiClient.get<OrderRecord[]>('/orders');
    return data;
  },
  deleteOrder: async (id: string) => {
    await apiClient.delete(`/orders/${id}`);
  },
  getAuditLogs: async (limit = 100) => {
    const { data } = await apiClient.get<AuditLog[]>('/audit-logs', {
      params: { limit }
    });
    return data;
  },
  deleteAuditLog: async (id: string) => {
    await apiClient.delete(`/audit-logs/${id}`);
  },
  getTradingRules: async (exchange: ExchangeCode = 'okx', symbol?: string) => {
    const { data } = await apiClient.get<InstrumentRule[]>('/trading-rules', {
      params: { exchange, symbol }
    });
    return data;
  },
  getTickers: async () => {
    const { data } = await apiClient.get<TickerPrice[]>('/tickers');
    return data;
  },
  getMarketOverview: async (exchange: ExchangeCode = 'okx') => {
    const { data } = await apiClient.get<MarketTickerSnapshot[]>('/market/overview', {
      params: { exchange }
    });
    return data;
  },
  getMarketHealth: async (exchange: ExchangeCode = 'okx') => {
    const { data } = await apiClient.get<MarketHealth>('/market/health', {
      params: { exchange }
    });
    return data;
  },
  getMarketCandles: async (symbol: string, bar = '10s', exchange: ExchangeCode = 'okx') => {
    const { data } = await apiClient.get<MarketCandle[]>('/market/candles', {
      params: { exchange, symbol, bar }
    });
    return data;
  }
};
