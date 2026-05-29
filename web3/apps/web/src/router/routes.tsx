import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

const OverviewPage = lazy(() => import('../pages/OverviewPage').then((module) => ({ default: module.OverviewPage })));
const RulesPage = lazy(() => import('../pages/RulesPage').then((module) => ({ default: module.RulesPage })));
const TriggersPage = lazy(() => import('../pages/TriggersPage').then((module) => ({ default: module.TriggersPage })));
const AuditLogsPage = lazy(() => import('../pages/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));
const SignalsPage = lazy(() => import('../pages/SignalsPage').then((module) => ({ default: module.SignalsPage })));
const MarketHealthPage = lazy(() => import('../pages/MarketHealthPage').then((module) => ({ default: module.MarketHealthPage })));
const RiskConfigPage = lazy(() => import('../pages/RiskConfigPage').then((module) => ({ default: module.RiskConfigPage })));
const TradePositionsPage = lazy(() => import('../pages/TradePositionsPage').then((module) => ({ default: module.TradePositionsPage })));
const TradeLogsPage = lazy(() => import('../pages/TradeLogsPage').then((module) => ({ default: module.TradeLogsPage })));

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/overview" replace />
  },
  {
    path: '/overview',
    element: <OverviewPage />
  },
  {
    path: '/rules',
    element: <RulesPage />
  },
  {
    path: '/triggers',
    element: <TriggersPage />
  },
  {
    path: '/trade-positions',
    element: <TradePositionsPage />
  },
  {
    path: '/trade-logs',
    element: <TradeLogsPage />
  },
  {
    path: '/signals',
    element: <SignalsPage />
  },
  {
    path: '/market-health',
    element: <MarketHealthPage />
  },
  {
    path: '/risk-config',
    element: <RiskConfigPage />
  },
  {
    path: '/audit-logs',
    element: <AuditLogsPage />
  },
  {
    path: '*',
    element: <Navigate to="/overview" replace />
  }
];
