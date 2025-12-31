import { lazy } from 'react'
import { DashboardOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'
import type { PageComponent } from './types'

// 懒加载页面组件
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const PayChannel = lazy(() => import('@/pages/Pay/Channel'))
const SystemUser = lazy(() => import('@/pages/System/User'))
const SystemSetting = lazy(() => import('@/pages/System/Setting'))

export interface AppRouteConfig {
  path?: string
  name?: string
  icon?: React.ReactNode
  component?: PageComponent
  hideInMenu?: boolean
  redirect?: string
  index?: boolean
  children?: AppRouteConfig[]
  keepAlive?: boolean // 默认false
}

export const menuRoutes: AppRouteConfig[] = [
  {
    path: '/dashboard',
    name: '仪表盘',
    icon: <DashboardOutlined />,
    component: Dashboard,
  },
  {
    path: '/pay',
    name: '支付管理',
    icon: <UserOutlined />,
    children: [
      { index: true, redirect: '/pay/channel', hideInMenu: true },
      {
        path: 'channel',
        name: '支付渠道',
        component: PayChannel,
        keepAlive: true,
      },
    ],
  },
  {
    path: '/system',
    name: '系统管理',
    icon: <SettingOutlined />,
    children: [
      { index: true, redirect: '/system/user', hideInMenu: true },
      {
        path: 'user',
        name: '个人中心',
        component: SystemUser,
        keepAlive: true,
      },
      {
        path: 'setting',
        name: '账号设置',
        component: SystemSetting,
        keepAlive: true,
      },
    ],
  },
  {
    path: '/',
    hideInMenu: true,
    redirect: '/dashboard',
  },
]
