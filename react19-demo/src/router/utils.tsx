import { IndexRouteObject, Navigate, NonIndexRouteObject } from 'react-router-dom'
import { lazyLoad } from '@/utils/lazyLoad'
import { AppRouteConfig } from './config'

type AppRouteObject = IndexRouteObject | NonIndexRouteObject

export const generateRoutes = (routes: AppRouteConfig[]): AppRouteObject[] => {
  return routes.map((item) => {
    // 处理 index 路由
    if (item.index) {
      const route: IndexRouteObject = {
        index: true,
        element: item.redirect ? <Navigate to={item.redirect} replace /> : undefined,
      }
      return route
    }

    // 处理普通路由
    const route: NonIndexRouteObject = {
      path: item.path,
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
