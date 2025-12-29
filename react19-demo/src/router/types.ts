// 路由参数
export interface RouteParams {
  params: Record<string, string | undefined> // 动态路由参数，如 /user/:id 中的 id
  searchParams: URLSearchParams // URL 查询参数
}

// 页面组件 Props
export interface PageComponentProps {
  routeParams?: RouteParams // 路由参数（通过 PageCache 注入，替代 useParams/useSearchParams）
}

// 页面组件类型
export type PageComponent = React.ComponentType<PageComponentProps>
