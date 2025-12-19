import { AuthGuard } from '@/components/AuthGuard'
import { lazyLoad } from '@/utils/lazyLoad'
import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const NotFound = lazy(() => import('@/pages/404'))
const BasicLayout = lazy(() => import('@/layouts/BasicLayout'))

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: lazyLoad(<Login />),
  },
  {
    path: '/',
    element: <AuthGuard>{lazyLoad(<BasicLayout />)}</AuthGuard>,
    children: [
      {
        index: true,
        element: lazyLoad(<Dashboard />),
      },
      {
        path: 'users',
        element: <div style={{ padding: 24 }}>用户管理</div>,
      },
    ],
  },
  {
    path: '*',
    element: lazyLoad(<NotFound />),
  },
]
