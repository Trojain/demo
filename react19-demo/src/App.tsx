import { App as AntdApp } from 'antd'
import { useEffect } from 'react'
import { BrowserRouter, useNavigate, useRoutes } from 'react-router-dom'
import { routes } from './router'
import { setRequestUi } from './utils/request'

// 全局初始化：注入 Ant Design UI 方法到 request 实例
function GlobalContextBinder() {
  const { message, modal } = AntdApp.useApp()
  const navigate = useNavigate()

  useEffect(() => {
    setRequestUi(message, modal, navigate)
  }, [message, modal, navigate])

  return null
}

// 路由渲染
function AppRoutes() {
  return useRoutes(routes)
}

function App() {
  return (
    <BrowserRouter>
      <GlobalContextBinder />
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
