/**
 * ProTable 默认配置 Hook
 * 统一管理 search、pagination、options 等通用配置
 * 使用方式：<ProTable {...useProTableConfig()} />
 */
import type { ProTableProps } from '@ant-design/pro-components'

type ProTableConfig = Pick<ProTableProps<any, any>, 'search' | 'pagination' | 'options'>

export function useProTableConfig(overrides?: Partial<ProTableConfig>): ProTableConfig {
  return {
    search: {
      defaultCollapsed: false,
      labelWidth: 'auto',
      showHiddenNum: true,
      ...overrides?.search,
    },
    pagination: {
      defaultPageSize: 20,
      showSizeChanger: true,
      showQuickJumper: true,
      ...overrides?.pagination,
    },
    options: {
      fullScreen: true,
      reload: true,
      density: true,
      setting: true,
      ...overrides?.options,
    },
  }
}

export default useProTableConfig
