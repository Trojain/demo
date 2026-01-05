import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntdApp, ConfigProvider } from 'antd'
// 适配 React 19：为 antd-mobile v5 提供渲染入口
// 详见：https://mobile.ant.design/guide/v5-for-19
import { unstableSetRender } from 'antd-mobile'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App'
import './styles/global.scss'

dayjs.locale('zh-cn')

unstableSetRender((node, container) => {
  const c = container as any
  c._reactRoot ||= ReactDOM.createRoot(container)
  const root = c._reactRoot
  root.render(node)

  return async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    root.unmount()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: { colorPrimary: '#1677ff' },
        cssVar: { key: 'app' },
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
)
