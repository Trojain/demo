import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Layout, Menu, Space, Tag, Typography } from 'antd'
import { DashboardOutlined, FileTextOutlined, SafetyOutlined, ThunderboltOutlined } from '@ant-design/icons'
import styles from './DashboardLayout.module.scss'

const { Header, Content, Sider } = Layout

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation()

  return (
    <Layout className={styles.shell}>
      <Sider width={232} className={styles.sider}>
        <div className={styles.brand}>
          <ThunderboltOutlined className={styles.brandIcon} />
          <div>
            <Typography.Text className={styles.brandTitle}>Web3 Monitor</Typography.Text>
            <Typography.Text className={styles.brandSubTitle}>自动交易台</Typography.Text>
          </div>
        </div>
        <Menu
          mode='inline'
          selectedKeys={[location.pathname]}
          className={styles.menu}
          items={[
            { key: '/overview', icon: <DashboardOutlined />, label: <Link to='/overview'>总览</Link> },
            { key: '/rules', icon: <ThunderboltOutlined />, label: <Link to='/rules'>交易计划</Link> },
            { key: '/trade-logs', icon: <FileTextOutlined />, label: <Link to='/trade-logs'>成交与日志</Link> },
            { key: '/risk-config', icon: <SafetyOutlined />, label: <Link to='/risk-config'>风控配置</Link> },
          ]}
        />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <Space>
            <Tag color='processing'>模拟下单默认开启</Tag>
            <Tag color='default'>OKX 可用</Tag>
            <Tag color='default'>Binance 预留</Tag>
          </Space>
        </Header>
        <Content>{children}</Content>
      </Layout>
    </Layout>
  )
}
