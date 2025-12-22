import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { ProLayout } from '@ant-design/pro-components'
import logo from '@/assets/images/logo.png'
import { menuRoutes } from '@/router/config'

const BasicLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const route = useMemo(() => ({ routes: menuRoutes }), [])

  return (
    <ConfigProvider theme={{ components: { Menu: { subMenuItemSelectedColor: '#fff' } } }}>
      <ProLayout
        title="管理系统"
        logo={logo}
        route={route}
        location={location}
        menu={{ autoClose: false }}
        token={{
          sider: {
            colorMenuBackground: '#001529',
            colorTextMenuTitle: '#fff',
            colorTextMenu: '#fff',
            colorTextMenuSelected: '#fff',
            colorBgMenuItemSelected: '#1890ff',
            colorTextMenuItemHover: '#1890ff',
          },
        }}
        menuItemRender={(item, dom) => (
          <div key={item.path} onClick={() => item.path && navigate(item.path)}>
            {dom}
          </div>
        )}
        fixSiderbar
        fixedHeader
      >
        <Outlet />
      </ProLayout>
    </ConfigProvider>
  )
}

export default BasicLayout
