import { PathMatch, matchPath } from 'react-router-dom'
import type { AppRouteConfig } from './config'
import { menuRoutes } from './config'
import type { PageComponentProps, RouteParams } from './types'

// 扁平化后的路由信息
export interface FlatRoute {
  pattern: string // 路由匹配模式
  name: string // 路由名称
  component?: React.ComponentType<PageComponentProps> // 页面组件
  keepAlive: boolean // 是否启用页面缓存
  isDynamic: boolean // 是否为动态路由
  redirect?: string // 重定向目标
}

export type { PageComponentProps, RouteParams } from './types'

// 路由解析结果
export interface ResolvedRoute {
  route: FlatRoute
  match: PathMatch<string> | null // 动态路由匹配结果，静态路由为 null
}

// 判断是否为动态路由（含 : 或 *）
const isDynamicPattern = (pattern: string): boolean => {
  return pattern.includes(':') || pattern.includes('*')
}

// 递归扁平化路由配置
// 递归扁平化路由配置
export const flattenRoutes = (routes: AppRouteConfig[], parentPath = ''): FlatRoute[] => {
  const result: FlatRoute[] = []

  for (const route of routes) {
    if (!route.path) {
      if (route.children) result.push(...flattenRoutes(route.children, parentPath))
      continue
    }

    // 拼接完整路径
    let fullPath = route.path
    if (!fullPath.startsWith('/')) {
      fullPath = `${parentPath === '/' ? '' : parentPath}/${fullPath}`
    }

    // 有组件和名称或者有重定向的路由才加入列表
    if ((route.component && route.name) || route.redirect) {
      result.push({
        pattern: fullPath,
        name: route.name ?? '',
        component: route.component,
        keepAlive: route.keepAlive ?? false,
        isDynamic: isDynamicPattern(fullPath),
        redirect: route.redirect,
      })
    }

    if (route.children) result.push(...flattenRoutes(route.children, fullPath))
  }

  return result
}

// 扁平化后的路由列表（应用启动时生成）
export const flatRouteList = flattenRoutes(menuRoutes)

// 静态路由 Map，支持 O(1) 查找
const staticRouteMap = new Map<string, FlatRoute>()
// 动态路由列表，需要遍历匹配
const dynamicRoutes: FlatRoute[] = []

// 初始化：将路由分类到静态 Map 和动态数组
flatRouteList.forEach((route) => {
  if (route.isDynamic) {
    dynamicRoutes.push(route)
  } else {
    staticRouteMap.set(route.pattern, route)
  }
})

// 解析路由：先查静态 Map（O(1)），再遍历动态路由匹配
export const resolveRoute = (pathname: string): ResolvedRoute | null => {
  // 静态路由直接命中
  const staticRoute = staticRouteMap.get(pathname)
  if (staticRoute) return { route: staticRoute, match: null }

  // 动态路由遍历匹配
  for (const route of dynamicRoutes) {
    const match = matchPath({ path: route.pattern, end: true }, pathname)
    if (match) return { route, match }
  }
  return null
}

// 根据路径查找路由
export const findRouteByPathname = (pathname: string): FlatRoute | null => {
  return resolveRoute(pathname)?.route ?? null
}

// 获取路由对应的组件
export const getComponentByPathname = (pathname: string) => {
  return findRouteByPathname(pathname)?.component ?? null
}

// 获取路由名称
export const getRouteNameByPathname = (pathname: string) => {
  return findRouteByPathname(pathname)?.name ?? ''
}

// 检查路由是否启用缓存
export const isRouteKeepAlive = (pathname: string): boolean => {
  return findRouteByPathname(pathname)?.keepAlive ?? false
}

// 提取路由参数
export const getRouteParams = (pathname: string, search: string): RouteParams => {
  const resolved = resolveRoute(pathname)
  return {
    params: (resolved?.match?.params as Record<string, string | undefined>) ?? {},
    searchParams: new URLSearchParams(search),
  }
}
