// API 统一导出
import type { ActionType } from '@ant-design/pro-components'
import { globalUI } from '@/utils/globalUI'

// 用户相关
export * from './user'

// 支付相关
export * from './pay'

// 响应处理
interface HandleResponseOptions {
  sucMsg?: string
  errMsg?: string
  actionRef?: React.RefObject<ActionType | undefined>
}

export function handleResponse(response: any, options: HandleResponseOptions = {}) {
  const { sucMsg = '操作成功', errMsg = '操作失败', actionRef } = options
  const { message } = globalUI
  if (response?.code === 200) {
    if (sucMsg) message.success(sucMsg)
    if (actionRef) actionRef.current?.reload()
    return true
  } else {
    if (errMsg) message.error(errMsg)
    return false
  }
}
