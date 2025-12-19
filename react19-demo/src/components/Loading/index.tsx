// Loading 组件
import { Spin } from 'antd'

export default function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        minHeight: 400,
      }}
    >
      <Spin size="large" tip="加载中..." />
    </div>
  )
}
