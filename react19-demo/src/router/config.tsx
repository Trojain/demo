import { lazy } from 'react'
import { DashboardOutlined, UserOutlined } from '@ant-design/icons'

export interface AppRouteConfig {
  path: string
  name?: string
  icon?: React.ReactNode
  component?: React.LazyExoticComponent<any>
  hideInMenu?: boolean
  redirect?: string
  children?: AppRouteConfig[]
}

export const menuRoutes: AppRouteConfig[] = [
  {
    path: '/dashboard',
    name: '仪表盘',
    icon: <DashboardOutlined />,
    component: lazy(() => import('@/pages/Dashboard')),
  },
  {
    path: '/pay',
    name: '支付管理',
    icon: <UserOutlined />,
    children: [
      {
        path: '/pay',
        redirect: '/pay/channel',
        hideInMenu: true,
      },
      {
        path: 'channel',
        name: '支付渠道',
        component: lazy(() => import('@/pages/pay/channel')),
      },
    ],
  },
  {
    path: '/profile',
    name: '个人中心',
    component: lazy(() => import('@/pages/Profile')),
    hideInMenu: true, // 隐藏在菜单中，仅通过顶部操作栏访问
  },
]
