import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

const OverviewPage = lazy(() => import('../pages/OverviewPage').then((module) => ({ default: module.OverviewPage })));
const RulesPage = lazy(() => import('../pages/RulesPage').then((module) => ({ default: module.RulesPage })));
const RiskConfigPage = lazy(() => import('../pages/RiskConfigPage').then((module) => ({ default: module.RiskConfigPage })));
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
    element: <Navigate to="/rules" replace />
  },
  {
    path: '/trade-positions',
    element: <Navigate to="/overview" replace />
  },
  {
    path: '/trade-logs',
    element: <TradeLogsPage />
  },
  {
    path: '/signals',
    element: <Navigate to="/rules" replace />
  },
  {
    path: '/market-health',
    element: <Navigate to="/rules" replace />
  },
  {
    path: '/risk-config',
    element: <RiskConfigPage />
  },
  {
    path: '/audit-logs',
    element: <Navigate to="/rules" replace />
  },
  {
    path: '*',
    element: <Navigate to="/overview" replace />
  }
];
