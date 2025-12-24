// 顶部操作栏
import { useLocation, useNavigate } from 'react-router-dom'
import type { MenuProps } from 'antd'
import { Badge, Dropdown, Tooltip } from 'antd'
import {
  BellOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { logout } from '@/services/user'
import { useThemeStore } from '@/store/theme'
import { useUserStore } from '@/store/user'
import { globalUI } from '@/utils/globalUI'
import styles from './index.module.scss'

export default function HeaderActions() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userInfo, clearUserInfo } = useUserStore()
  const { theme, toggleTheme } = useThemeStore()
  const { message, modal } = globalUI

  const langMenuItems: MenuProps['items'] = [
    {
      key: 'zh',
      label: '简体中文',
      onClick: () => {
        message.success('已切换到简体中文')
      },
    },
    {
      key: 'en',
      label: 'English',
      onClick: () => {
        message.success('Switched to English')
      },
    },
  ]

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/system/user'),
    },
    {
      key: 'setting',
      icon: <SettingOutlined />,
      label: '账号设置',
      onClick: () => navigate('/system/setting'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        modal.confirm({
          title: '确认退出？',
          content: '退出后需要重新登录',
          onOk: async () => {
            await logout()
            clearUserInfo()
            message.success('已退出登录')
            navigate('/login', { state: { from: location } })
          },
        })
      },
    },
  ]

  return (
    <div className={styles.header}>
      {/* 通知图标 */}
      <div className={styles.actionIcon}>
        <Badge count={1} offset={[2, -2]} size="small">
          <BellOutlined className={styles.iconFont} onClick={() => message.info('暂无新通知')} />
        </Badge>
      </div>

      {/* 主题切换 */}
      <Tooltip title={theme === 'light' ? '切换深色模式' : '切换浅色模式'}>
        <div className={styles.actionIcon} onClick={toggleTheme}>
          {theme === 'light' ? (
            <SunOutlined className={styles.iconFont} />
          ) : (
            <MoonOutlined className={styles.iconFont} />
          )}
        </div>
      </Tooltip>

      {/* 语言切换 */}
      <div className={styles.actionIcon}>
        <Dropdown menu={{ items: langMenuItems }} placement="bottom" arrow>
          <GlobalOutlined className={styles.iconFont} />
        </Dropdown>
      </div>

      {/* 用户头像 */}
      <div className={styles.actionIcon}>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              <UserOutlined className={styles.avatarIcon} />
            </div>
            <span>{userInfo?.currentUser?.account || '用户'}</span>
          </div>
        </Dropdown>
      </div>
    </div>
  )
}
