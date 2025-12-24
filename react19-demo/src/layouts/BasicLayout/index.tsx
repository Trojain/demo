// 基础布局
import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ConfigProvider, theme as antdTheme } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { ProLayout } from '@ant-design/pro-components'
import logo from '@/assets/images/logo.png'
import HeaderActions from '@/components/HeaderActions'
import RouteTabs from '@/components/RouteTabs'
import { menuRoutes } from '@/router/config'
import { useThemeStore } from '@/store/theme'
import '@/styles/theme.scss'
import styles from './index.module.scss'

const BasicLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const route = useMemo(() => ({ routes: menuRoutes }), [])
  const [collapsed, setCollapsed] = useState(false)
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <div className={`theme-${theme}`}>
      <ConfigProvider
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          components: { Menu: { subMenuItemSelectedColor: '#fff' } },
        }}
      >
        <ProLayout
          title="管理系统"
          route={route}
          location={location}
          menu={{ autoClose: false }}
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
            <div key={item.path} onClick={() => item.path && navigate(item.path)}>
              {dom}
            </div>
          )}
          // 自定义菜单头部
          menuHeaderRender={() => (
            <>
              <div className={styles.spacer} />
              <div id="customize_menu_header" className={styles.logoHeader} onClick={() => navigate('/')}>
                <img src={logo} alt="logo" className={styles.logoImage} />
                <h1 className={styles.logoText}>管理系统</h1>
              </div>
            </>
          )}
          contentStyle={{ padding: 0, margin: 0 }}
          // 自定义菜单折叠按钮
          collapsedButtonRender={false}
          menuFooterRender={() => (
            <div onClick={() => setCollapsed(!collapsed)} className={styles.footer}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
          )}
          fixedHeader
        >
          {/* 顶部固定区域：包含操作栏和标签页 */}
          <div className={styles.fixedHeaderWrapper}>
            <HeaderActions />
            <RouteTabs />
          </div>

          {/* 页面内容区域 */}
          <div className={styles.layoutContent}>
            <Outlet />
          </div>
        </ProLayout>
      </ConfigProvider>
    </div>
  )
}

export default BasicLayout
