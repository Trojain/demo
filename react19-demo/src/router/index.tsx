import { lazy } from 'react'
import { Navigate, RouteObject, createBrowserRouter } from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import GlobalLayout from '@/layouts/GlobalLayout'
import { lazyLoad } from '@/utils/lazyLoad'
import { menuRoutes } from './config'
import { generateRoutes } from './utils'

const Login = lazy(() => import('@/pages/Login'))
const BasicLayout = lazy(() => import('@/layouts/BasicLayout/index'))
const NotFound = lazy(() => import('@/pages/404'))

const routes: RouteObject[] = [
  {
    element: <GlobalLayout />,
    children: [
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
            element: <Navigate to="/dashboard" replace />,
          },
          ...generateRoutes(menuRoutes),
          {
            path: '*',
            element: lazyLoad(<NotFound />),
          },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
