import { Navigate, RouteObject } from 'react-router-dom'
import { lazyLoad } from '@/utils/lazyLoad'
import { AppRouteConfig } from './config'

export const generateRoutes = (routes: AppRouteConfig[]): RouteObject[] => {
  return routes.map((item) => {
    const route: RouteObject = {}

    // 处理 index 路由
    if (item.index) {
      route.index = true
    } else if (item.path) {
      route.path = item.path
    }

    if (item.redirect) {
      route.element = <Navigate to={item.redirect} replace />
    } else if (item.component) {
      route.element = lazyLoad(<item.component />)
    }

    if (item.children) {
      route.children = generateRoutes(item.children)
    }

    return route
  })
}
