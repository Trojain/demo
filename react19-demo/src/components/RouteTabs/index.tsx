import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { MenuProps } from 'antd'
import { Dropdown, Tabs } from 'antd'
import { CloseOutlined, MinusOutlined, StopOutlined } from '@ant-design/icons'
import { getRouteNameByPathname } from '@/router/routeUtils'
import { usePageCacheStore } from '@/store/pageCache'
import { useTabStore } from '@/store/tabs'
import styles from './index.module.scss'

type TargetKey = React.MouseEvent | React.KeyboardEvent | string

// 路由标签页组件
// - 显示已访问的页面标签
// - 支持右键菜单：关闭当前/关闭其他/关闭全部
// - 关闭标签时同步清除页面缓存
const RouteTabs = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname
  const removeCachedPagesByPathname = usePageCacheStore((s) => s.removeCachedPagesByPathname)
  // 使用 selector 订阅具体字段，避免不必要的 rerender
  const tabs = useTabStore((s) => s.tabs)
  const activeKey = useTabStore((s) => s.activeKey)
  const addTab = useTabStore((s) => s.addTab)
  const removeTab = useTabStore((s) => s.removeTab)
  const closeOtherTabs = useTabStore((s) => s.closeOtherTabs)
  const closeAllTabs = useTabStore((s) => s.closeAllTabs)

  // 路由变化时添加标签
  useEffect(() => {
    if (pathname === '/login' || pathname === '/') return

    const routeName = getRouteNameByPathname(pathname)
    if (routeName) {
      addTab({
        label: routeName,
        key: pathname,
        closable: pathname !== '/dashboard', // dashboard 不可关闭
      })
    }
  }, [pathname, addTab])

  // 标签关闭事件
  const onEdit = (targetKey: TargetKey, action: 'add' | 'remove') => {
    if (action === 'remove') {
      removeCachedPagesByPathname(targetKey as string)
      removeTab(targetKey as string)
      const { activeKey } = useTabStore.getState()
      if (activeKey !== pathname) {
        navigate(activeKey)
      }
    }
  }

  // 切换标签
  const onChange = (key: string) => navigate(key)

  // 自定义 TabBar，支持右键菜单
  const renderTabBar = (props: any, DefaultTabBar: any) => (
    <DefaultTabBar {...props}>
      {(node: any) => {
        const { key } = node
        const tab = tabs.find((t) => t.key === key)
        if (!tab) return node

        // 右键菜单项
        const menuItems: MenuProps['items'] = [
          {
            key: 'close',
            icon: <CloseOutlined />,
            label: '关闭标签',
            disabled: !tab.closable,
            onClick: () => {
              removeCachedPagesByPathname(key)
              removeTab(key)
              const { activeKey } = useTabStore.getState()
              if (activeKey !== pathname) navigate(activeKey)
            },
          },
          {
            key: 'closeOthers',
            icon: <MinusOutlined />,
            label: '关闭其他',
            onClick: () => {
              const pathsToRemove = tabs.filter((t) => t.key !== key && t.closable !== false).map((t) => t.key)
              removeCachedPagesByPathname(pathsToRemove)
              closeOtherTabs(key)
              navigate(key)
            },
          },
          {
            key: 'closeAll',
            icon: <StopOutlined />,
            label: '关闭全部',
            onClick: () => {
              const pathsToRemove = tabs.filter((t) => t.closable !== false).map((t) => t.key)
              removeCachedPagesByPathname(pathsToRemove)
              closeAllTabs()
              const { activeKey } = useTabStore.getState()
              navigate(activeKey)
            },
          },
        ]

        return (
          <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']} key={key}>
            {node}
          </Dropdown>
        )
      }}
    </DefaultTabBar>
  )

  return (
    <div className={styles.tabsContainer}>
      <Tabs
        hideAdd
        type="editable-card"
        activeKey={activeKey}
        items={tabs.map((tab) => ({ label: tab.label, key: tab.key, closable: tab.closable }))}
        onChange={onChange}
        onEdit={onEdit}
        renderTabBar={renderTabBar}
      />
    </div>
  )
}

export default RouteTabs
