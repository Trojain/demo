// 页面标签页
import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { MenuProps } from 'antd'
import { Dropdown, Tabs } from 'antd'
import { menuRoutes } from '@/router/config'
import { useTabStore } from '@/store/tabs'
import styles from './index.module.scss'

type TargetKey = React.MouseEvent | React.KeyboardEvent | string

const RouteTabs = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { tabs, activeKey, addTab, removeTab, closeOtherTabs } = useTabStore()

  // 扁平化路由配置以查找标签名称
  const findRouteName = useCallback((targetPath: string, routes: any[], parentPath = ''): string => {
    for (const route of routes) {
      let fullPath = route.path
      if (!fullPath.startsWith('/')) {
        fullPath = `${parentPath === '/' ? '' : parentPath}/${fullPath}`
      }

      if (fullPath === targetPath) return route.name

      if (route.children) {
        const name = findRouteName(targetPath, route.children, fullPath)
        if (name) return name
      }
    }
    return ''
  }, [])

  // 监听路由变化，添加标签
  useEffect(() => {
    const { pathname } = location
    // 忽略登录页和根路径
    if (pathname === '/login' || pathname === '/') return

    const routeName = findRouteName(pathname, menuRoutes)
    if (routeName) {
      addTab({
        label: routeName,
        key: pathname,
        closable: pathname !== '/dashboard', // 假设 dashboard 不可关闭
      })
    }
  }, [location, addTab, findRouteName])

  const onEdit = (targetKey: TargetKey, action: 'add' | 'remove') => {
    if (action === 'remove') {
      removeTab(targetKey as string)
      const { activeKey } = useTabStore.getState()
      if (activeKey !== location.pathname) {
        navigate(activeKey)
      }
    }
  }

  const onChange = (key: string) => {
    navigate(key)
  }

  //右键菜单
  const renderTabBar = (props: any, DefaultTabBar: any) => (
    <DefaultTabBar {...props}>
      {(node: any) => {
        const { key } = node
        const tab = tabs.find((t) => t.key === key)

        if (!tab) return node

        const menuItems: MenuProps['items'] = [
          {
            key: 'close',
            label: '关闭标签',
            disabled: !tab.closable,
            onClick: () => {
              removeTab(key)
              const { activeKey } = useTabStore.getState()
              if (activeKey !== location.pathname) {
                navigate(activeKey)
              }
            },
          },
          {
            key: 'closeOthers',
            label: '关闭其他',
            onClick: () => {
              closeOtherTabs(key)
              navigate(key)
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
