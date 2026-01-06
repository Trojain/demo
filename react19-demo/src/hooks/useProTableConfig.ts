import { useMemo } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import type { ProTableProps } from '@ant-design/pro-components'
import { useIsMobile } from '@/hooks/useIsMobile'
import { menuRoutes } from '@/router/config'
import { flattenRoutes } from '@/router/routeUtils'

type ProTableConfig = Pick<
  ProTableProps<any, any>,
  'search' | 'pagination' | 'options' | 'headerTitle' | 'ghost' | 'form' | 'size' | 'scroll'
>

export function useProTableConfig(overrides?: Partial<ProTableConfig>): ProTableConfig {
  const isMobile = useIsMobile()
  const location = useLocation()

  const headerTitle = useMemo(() => {
    if (isMobile) return undefined
    const allRoutes = flattenRoutes(menuRoutes)
    const matched = allRoutes.find((r) => matchPath(r.pattern, location.pathname))
    return matched?.name
  }, [isMobile, location.pathname])

  const base: ProTableConfig = {
    headerTitle,
    form: isMobile
      ? {
          layout: 'horizontal',
          labelAlign: 'left',
          colon: false,
          labelCol: { flex: '0 0 clamp(40px, 22vw, 120px)' },
          wrapperCol: { flex: '1 1 0' },
          size: 'small',
        }
      : {
          labelWidth: 'auto',
          layout: 'horizontal',
          labelAlign: 'left',
          colon: false,
        },
    search: {
      span: isMobile ? 24 : 6,
      defaultCollapsed: isMobile,
      showHiddenNum: true,
      ...overrides?.search,
    },
    pagination: {
      defaultPageSize: isMobile ? 10 : 20,
      showSizeChanger: !isMobile,
      showQuickJumper: !isMobile,
      simple: !isMobile,
      size: isMobile ? 'small' : 'default',
      ...overrides?.pagination,
    },
    // size: isMobile ? 'small' : 'middle',
    options: isMobile
      ? false
      : {
          fullScreen: true,
          reload: true,
          density: true,
          setting: true,
          ...overrides?.options,
        },
  }

  return {
    ...base,
    ...overrides,
    search: { ...base.search, ...overrides?.search },
    pagination: { ...base.pagination, ...overrides?.pagination },
    options:
      base.options === false
        ? (overrides?.options ?? false)
        : { ...(base.options as any), ...(overrides?.options as any) },
    form: { ...(base.form as any), ...(overrides?.form as any) },
    scroll: { x: isMobile ? 'max-content' : '100%' },
  }
}

export default useProTableConfig
