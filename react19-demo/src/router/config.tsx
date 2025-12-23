import { lazy } from 'react'
import { DashboardOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'

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
      { path: '/pay', redirect: '/pay/channel', hideInMenu: true },
      {
        path: 'channel',
        name: '支付渠道',
        component: lazy(() => import('@/pages/Pay/Channel')),
      },
    ],
  },
  {
    path: '/system',
    name: '系统管理',
    icon: <SettingOutlined />,
    children: [
      { path: '/system', redirect: '/system/user', hideInMenu: true },
      {
        path: 'user',
        name: '个人中心',
        component: lazy(() => import('@/pages/System/User')),
      },
      {
        path: 'setting',
        name: '账号设置',
        component: lazy(() => import('@/pages/System/Setting')),
      },
    ],
  },
]
