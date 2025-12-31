// 个人中心页
import { Avatar, Card, Descriptions } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useUserStore } from '@/store/user'
import styles from './index.module.scss'

export default function Profile() {
  const { userInfo } = useUserStore()
  const isMobile = useIsMobile()

  return (
    <Card title="个人中心">
      <div className={styles.header}>
        <Avatar size={isMobile ? 64 : 80} icon={<UserOutlined />} />
        <div>
          <h2 className={styles.title}>{userInfo?.username || '用户'}</h2>
          <p className={styles.subtitle}>普通用户</p>
        </div>
      </div>

      <Descriptions bordered column={isMobile ? 1 : 2} size={isMobile ? 'small' : 'default'}>
        <Descriptions.Item label="用户名">{userInfo?.username || '-'}</Descriptions.Item>
        <Descriptions.Item label="Token">
          <div className={styles.token}>{userInfo?.token ? `${userInfo.token.slice(0, 20)}...` : '-'}</div>
        </Descriptions.Item>
        <Descriptions.Item label="角色">普通用户</Descriptions.Item>
        <Descriptions.Item label="状态">
          <span className={styles.statusNormal}>正常</span>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
