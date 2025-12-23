// 全局布局：注入 UI 实例到非 React 上下文
import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { App as AntdApp } from 'antd'
import { setGlobalUI } from '@/utils/globalUI'

export default function GlobalLayout() {
  const { message, modal } = AntdApp.useApp() // 获取 Antd UI 实例
  const navigate = useNavigate()
  const [initialized, setInitialized] = useState(false) // 控制渲染时机

  useEffect(() => {
    setGlobalUI(message, modal, navigate) // 注入到全局模块
    setInitialized(true)
  }, [message, modal, navigate])

  return initialized ? <Outlet /> : null // 初始化后才渲染子路由
}
