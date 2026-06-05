import { apiClient } from './client';
import type {
  AuditLog,
  CreateRulePayload,
  DailyRiskStats,
  DashboardSummary,
  ExchangeCode,
  InstrumentRule,
  MarketCandle,
  MarketHealth,
  MarketTickerSnapshot,
  MonitorRule,
  OrderPreview,
  OrderRecord,
  OrderRecoveryRecord,
  RiskConfig,
  RiskCheck,
  TickerPrice,
  TradeAccount,
  TradeDailyReport,
  TradeEquityHistoryPoint,
  TradeAccountSummary,
  TradeAccountType,
  TradeFill,
  TradeOrderPayload,
  TradeOrderPreview,
  TradeOperationLog,
  TradePosition,
  TradePositionView,
  RuleExecutionDetail,
  TradingSignal,
  TriggerEvent,
  UpdateRiskConfigPayload,
  UpdateRulePayload
} from '../types';

export interface PagedResult<T> {
  /** 当前页数据 */
  items: T[];
  /** 符合条件的总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 当前分页大小 */
  pageSize: number;
}

export interface CreateExternalSignalPayload {
  /** 关联规则 ID，外部信号沿用该规则的下单参数与风控配置。 */
  ruleId: string;
  /** 外部信号对应的市场价格。 */
  marketPrice: string;
  /** 行情事件时间，不传时由服务端回退当前时间。 */
  marketEventTime?: string;
  /** 外部信号原因说明。 */
  reason: string;
  /** 外部信号来源键，建议来自上游系统的稳定唯一值。 */
  sourceKey?: string;
  /** 外部信号来源标签，例如 webhook、research、manual。 */
  sourceLabel?: string;
  /** 外部信号附加上下文。 */
  metadata?: Record<string, unknown>;
}

export interface ExternalSignalResult {
  /** 已写入的交易信号，若被重复拦截则可能为空。 */
  signal?: TradingSignal;
  /** 风控通过后生成的触发事件。 */
  trigger?: TriggerEvent;
}

export interface DailyRiskStatsResult {
  /** 今日统计摘要。 */
  today?: DailyRiskStats;
  /** 最近 N 天统计列表，按日期倒序。 */
  items: DailyRiskStats[];
}

export const tradingApi = {
  getDashboardSummary: async () => {
    const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary');
    return data;
  },
  getRules: async () => {
    const { data } = await apiClient.get<MonitorRule[]>('/rules');
    return data;
  },
  getRuleExecutionDetail: async (id: string) => {
    const { data } = await apiClient.get<RuleExecutionDetail>(`/rules/${id}/execution`);
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
  createExternalSignal: async (payload: CreateExternalSignalPayload) => {
    const { data } = await apiClient.post<ExternalSignalResult>('/signals/external', payload);
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
  getDailyRiskStats: async (days = 7) => {
    const { data } = await apiClient.get<DailyRiskStatsResult>('/risk-stats/daily', {
      params: { days }
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
  getTradeFillPage: async (
    page = 1,
    pageSize = 20,
    mode?: TradeAccountType,
    exchange?: ExchangeCode,
    date?: string,
  ) => {
    const { data } = await apiClient.get<PagedResult<TradeFill>>('/trade/fills/page', {
      params: { page, pageSize, mode, exchange, date }
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
  confirmTradeOrder: async (preview: TradeOrderPayload, confirmToken?: string) => {
    const { data } = await apiClient.post<OrderRecord>('/trade/orders/confirm', { preview, confirmToken });
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
  getAuditLogs: async (limit = 100, actions?: string[], levels?: string[]) => {
    const { data } = await apiClient.get<AuditLog[]>('/audit-logs', {
      params: { limit, actions: actions?.join(','), levels: levels?.join(',') }
    });
    return data;
  },
  getAuditLogPage: async (page = 1, pageSize = 20, actions?: string[], levels?: string[]) => {
    const { data } = await apiClient.get<PagedResult<AuditLog>>('/audit-logs/page', {
      params: { page, pageSize, actions: actions?.join(','), levels: levels?.join(',') }
    });
    return data;
  },
  getOrderRecoveryPage: async (page = 1, pageSize = 20, statuses?: string[], stages?: string[]) => {
    const { data } = await apiClient.get<PagedResult<OrderRecoveryRecord>>('/order-recoveries/page', {
      params: { page, pageSize, statuses: statuses?.join(','), stages: stages?.join(',') }
    });
    return data;
  },
  retryOrderRecovery: async (id: string) => {
    const { data } = await apiClient.post<OrderRecoveryRecord>(`/order-recoveries/${id}/retry`);
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
  },
  getDailyReport: async (days = 30, exchange?: ExchangeCode, mode?: 'simulation' | 'real') => {
    const { data } = await apiClient.get<TradeDailyReport[]>('/trade/daily-report', {
      params: { days, exchange, mode }
    });
    return data;
  },
  getQualityAnalysis: async (days = 30, exchange?: ExchangeCode, mode?: 'simulation' | 'real') => {
    const { data } = await apiClient.get<TradeQualityAnalysisResult>('/trade/quality-analysis', {
      params: { days, exchange, mode }
    });
    return data;
  },
};

export interface TradeQualityAnalysisResult {
  summary: {
    totalOrderCount: number
    filledOrderCount: number
    failedOrderCount: number
    cancelledOrderCount: number
    fillRate: number
    avgTriggerLatencyMs: number
    avgExecutionLatencyMs: number
    avgSlippagePercent: number
    winRate: number
    profitLossRatio: number
  }
  statusDistribution: Array<{
    name: string
    value: number
  }>
  topSymbols: Array<{
    symbol: string
    volume: string
    count: number
    realizedPnl: string
  }>
  dailyTrend: Array<{
    date: string
    avgSlippagePercent: number
    avgExecutionLatencyMs: number
  }>
  failedReasons: Array<{
    reason: string
    count: number
  }>
}
