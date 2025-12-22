/**
 * 个人中心页面
 */
import { Avatar, Card, Descriptions } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/user'

export default function Profile() {
  const { userInfo } = useUserStore()

  return (
    <Card title="个人中心">
      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <Avatar size={80} icon={<UserOutlined />} />
        <div>
          <h2 style={{ margin: 0 }}>{userInfo?.username || '用户'}</h2>
          <p style={{ color: '#666', margin: '8px 0 0' }}>普通用户</p>
        </div>
      </div>

      <Descriptions bordered column={2}>
        <Descriptions.Item label="用户名">{userInfo?.username || '-'}</Descriptions.Item>
        <Descriptions.Item label="Token">{userInfo?.token?.slice(0, 20)}...</Descriptions.Item>
        <Descriptions.Item label="角色">普通用户</Descriptions.Item>
        <Descriptions.Item label="状态">
          <span style={{ color: '#52c41a' }}>正常</span>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
