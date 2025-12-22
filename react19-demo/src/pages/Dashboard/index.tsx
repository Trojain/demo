import { Card, Col, Row, Statistic } from 'antd'
import { ArrowUpOutlined, UserOutlined } from '@ant-design/icons'

export default function Dashboard() {
  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={11280}
              prefix={<UserOutlined />}
              styles={{ value: { color: '#3f8600' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={9320}
              prefix={<ArrowUpOutlined />}
              styles={{ value: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="今日订单" value={532} styles={{ value: { color: '#cf1322' } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月收入"
              value={128500}
              prefix="¥"
              precision={2}
              styles={{ value: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
