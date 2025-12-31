import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConfigProvider, theme as antdTheme } from 'antd'
import { ProLayout } from '@ant-design/pro-components'
import logo from '@/assets/images/logo.png'
import ErrorBoundary from '@/components/ErrorBoundary'
import HeaderActions from '@/components/HeaderActions'
import PageCache from '@/components/PageCache'
import RouteTabs from '@/components/RouteTabs'
import { useIsMobile } from '@/hooks/useIsMobile'
import { menuRoutes } from '@/router/config'
import { useThemeStore } from '@/store/theme'
import '@/styles/theme.scss'
import styles from './index.module.scss'

const BasicLayout = () => {
  const location = useLocation()
  const route = useMemo(() => ({ routes: menuRoutes }), [])
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(isMobile)
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (isMobile) {
      setCollapsed(true)
    }
  }, [isMobile])

  // 移动端菜单展开时锁定页面滚动，防止滚动穿透
  useEffect(() => {
    if (isMobile && !collapsed) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, collapsed])

  const handleMenuToggle = () => setCollapsed((prev) => !prev)

  return (
    <div className={`theme-${theme}`}>
      <ConfigProvider
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          components: { Menu: { subMenuItemSelectedColor: '#fff' } },
        }}
      >
        <ProLayout
          logo={logo}
          title="管理系统"
          route={route}
          location={location}
          menu={{ autoClose: false }}
          breakpoint="lg"
          collapsedWidth={isMobile ? 0 : 80}
          collapsed={collapsed}
          onCollapse={setCollapsed}
          // 自定义菜单颜色
          token={{
            sider: {
              colorMenuBackground: '#001529',
              colorTextMenu: '#fff',
              colorTextMenuSelected: '#fff',
              colorBgMenuItemSelected: '#1890ff',
              colorTextMenuItemHover: '#1890ff',
            },
            header: { heightLayoutHeader: 48, colorBgHeader: '#fff' },
          }}
          menuItemRender={(item, dom) => (
            <Link to={item.path || '/'} onClick={() => isMobile && setCollapsed(true)}>
              {dom}
            </Link>
          )}
          // 自定义菜单头部
          // 自定义菜单头部
          menuHeaderRender={(_, defaultDom, props) => (
            <Link to="/" className={styles.logoHeader} onClick={() => isMobile && setCollapsed(true)}>
              <img src={logo} alt="logo" className={styles.logoImage} />
              {!props?.collapsed && <h1 className={styles.logoText}>管理系统</h1>}
            </Link>
          )}
          contentStyle={{ padding: 0, margin: 0 }}
          collapsedButtonRender={false}
          // 移动端隐藏顶部标题栏
          headerRender={isMobile ? false : undefined}
          fixedHeader
        >
          {/* 顶部固定区域：包含操作栏和标签页 */}
          <div className={styles.fixedHeaderWrapper}>
            <HeaderActions collapsed={collapsed} onToggleMenu={handleMenuToggle} />
            <RouteTabs />
          </div>

          {/* 页面内容区域 */}
          <div className={styles.layoutContent}>
            <ErrorBoundary>
              <PageCache />
            </ErrorBoundary>
          </div>
        </ProLayout>
      </ConfigProvider>
    </div>
  )
}

export default BasicLayout
