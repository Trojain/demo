import { apiClient } from './client';
import type { CreateRulePayload, MarketCandle, MarketTickerSnapshot, MonitorRule, OrderRecord, TickerPrice, TriggerEvent, UpdateRulePayload } from '../types';

export const tradingApi = {
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
  confirmOrder: async (triggerId: string) => {
    const { data } = await apiClient.post<OrderRecord>('/orders/confirm', { triggerId });
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
  getTickers: async () => {
    const { data } = await apiClient.get<TickerPrice[]>('/tickers');
    return data;
  },
  getMarketOverview: async () => {
    const { data } = await apiClient.get<MarketTickerSnapshot[]>('/market/overview');
    return data;
  },
  getMarketCandles: async (symbol: string, bar = '1m') => {
    const { data } = await apiClient.get<MarketCandle[]>('/market/candles', {
      params: { symbol, bar }
    });
    return data;
  }
};
