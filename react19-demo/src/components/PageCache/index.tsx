import { Activity, Suspense, useEffect, useMemo, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import ErrorBoundary from '@/components/ErrorBoundary'
import { isRouteKeepAlive, resolveRoute } from '@/router/routeUtils'
import type { PageComponentProps, RouteParams } from '@/router/types'
import { generateCacheKey, usePageCacheStore } from '@/store/pageCache'
import styles from './index.module.scss'

export type { PageComponentProps, RouteParams } from '@/router/types'

// 页面缓存组件（基于 React 19 Activity 实现 KeepAlive）
// - keepAlive=true 的页面用 Activity 包裹，切换后保留状态
// - keepAlive=false 的页面正常渲染，切换后状态丢失
// - 每个页面独立 ErrorBoundary，单个页面崩溃不影响其他页面
const PageCache = () => {
  const location = useLocation()
  // 使用选择器订阅具体字段，避免不必要的 rerender
  const cachedPages = usePageCacheStore((s) => s.cachedPages)
  const addCachedPage = usePageCacheStore((s) => s.addCachedPage)

  // 防止同一 key 重复触发 addCachedPage
  const lastProcessedKeyRef = useRef<string>('')
  const { pathname, search } = location

  // 路由变化时，将 keepAlive 页面加入缓存
  useEffect(() => {
    const cacheKey = generateCacheKey(pathname, search)

    // 忽略登录页和根路径
    if (pathname === '/login' || pathname === '/') return

    // 同 key 不重复处理
    if (cacheKey === lastProcessedKeyRef.current) return
    lastProcessedKeyRef.current = cacheKey

    // 只缓存启用 keepAlive 的页面
    if (isRouteKeepAlive(pathname)) {
      addCachedPage(pathname, search)
    }
  }, [pathname, search, addCachedPage])

  // 当前页面的缓存 key
  const currentKey = generateCacheKey(pathname, search)

  // 当前路由解析结果（用于渲染非缓存页面）
  const currentResolved = useMemo(() => resolveRoute(pathname), [pathname])

  // 缓存页面列表（预生成 routeParams，保持引用稳定）
  const cachedPagesToRender = useMemo(() => {
    return cachedPages
      .map((page) => {
        const resolved = resolveRoute(page.pathname)
        if (!resolved) return null

        const routeParams: RouteParams = {
          params: (resolved.match?.params as Record<string, string | undefined>) ?? {},
          searchParams: new URLSearchParams(page.search),
        }

        return {
          key: page.key,
          pathname: page.pathname,
          search: page.search,
          Component: resolved.route.component,
          routeParams,
        }
      })
      .filter((page): page is NonNullable<typeof page> => page !== null)
  }, [cachedPages])

  // 检查当前页面是否在缓存列表中
  const isCurrentPageCached = cachedPagesToRender.some((page) => page.key === currentKey)

  // 当前非缓存页面的 routeParams
  const currentRouteParams = useMemo(
    (): RouteParams => ({
      params: (currentResolved?.match?.params as Record<string, string | undefined>) ?? {},
      searchParams: new URLSearchParams(search),
    }),
    [currentResolved, search],
  )

  // 检查当前路由配置是否标记为 keepAlive
  const isCurrentRouteKeepAlive = currentResolved?.route.keepAlive ?? false

  // 处理路由重定向
  if (currentResolved?.route.redirect) {
    return <Navigate to={currentResolved.route.redirect} replace />
  }

  return (
    <div className={styles.pageCache}>
      {/* 渲染所有缓存页面，通过 Activity mode 控制显示/隐藏 */}
      {cachedPagesToRender.map((page) => {
        const Component = page.Component as React.ComponentType<PageComponentProps>
        const isActive = currentKey === page.key

        return (
          <Activity key={page.key} mode={isActive ? 'visible' : 'hidden'}>
            <ErrorBoundary resetKey={page.key}>
              <div className={styles.pageWrapper}>
                <Suspense fallback={<Spin className={styles.loading} />}>
                  <Component routeParams={page.routeParams} />
                </Suspense>
              </div>
            </ErrorBoundary>
          </Activity>
        )
      })}

      {/* 渲染非缓存页面（keepAlive=false 或未设置的页面） */}
      {!isCurrentPageCached && currentResolved && !isCurrentRouteKeepAlive && (
        <ErrorBoundary resetKey={currentKey}>
          <div className={styles.pageWrapper}>
            <Suspense fallback={<Spin className={styles.loading} />}>
              {currentResolved.route.component && <currentResolved.route.component routeParams={currentRouteParams} />}
            </Suspense>
          </div>
        </ErrorBoundary>
      )}
    </div>
  )
}

export default PageCache
