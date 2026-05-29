import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Layout, Menu, Space, Tag, Typography } from 'antd'
import { AuditOutlined, BellOutlined, DashboardOutlined, LineChartOutlined, SafetyOutlined, ThunderboltOutlined, WalletOutlined } from '@ant-design/icons'
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
            <Typography.Text className={styles.brandSubTitle}>半自动交易台</Typography.Text>
          </div>
        </div>
        <Menu
          mode='inline'
          selectedKeys={[location.pathname]}
          className={styles.menu}
          items={[
            { key: '/overview', icon: <DashboardOutlined />, label: <Link to='/overview'>监控总览</Link> },
            { key: '/signals', icon: <ThunderboltOutlined />, label: <Link to='/signals'>交易信号</Link> },
            { key: '/triggers', icon: <BellOutlined />, label: <Link to='/triggers'>触发确认</Link> },
            { key: '/trade-positions', icon: <WalletOutlined />, label: <Link to='/trade-positions'>持仓收益</Link> },
            { key: '/trade-logs', icon: <AuditOutlined />, label: <Link to='/trade-logs'>交易日志</Link> },
            { key: '/audit-logs', icon: <AuditOutlined />, label: <Link to='/audit-logs'>审计日志</Link> },
            { key: '/risk-config', icon: <SafetyOutlined />, label: <Link to='/risk-config'>风控配置</Link> },
            { key: '/market-health', icon: <LineChartOutlined />, label: <Link to='/market-health'>行情健康</Link> },
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
