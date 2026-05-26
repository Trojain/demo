import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

const OverviewPage = lazy(() => import('../pages/OverviewPage').then((module) => ({ default: module.OverviewPage })));
const RulesPage = lazy(() => import('../pages/RulesPage').then((module) => ({ default: module.RulesPage })));
const TriggersPage = lazy(() => import('../pages/TriggersPage').then((module) => ({ default: module.TriggersPage })));
const OrdersPage = lazy(() => import('../pages/OrdersPage').then((module) => ({ default: module.OrdersPage })));

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
    path: '/orders',
    element: <OrdersPage />
  },
  {
    path: '*',
    element: <Navigate to="/overview" replace />
  }
];
