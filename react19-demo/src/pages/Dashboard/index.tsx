// 首页 仪表盘
import { Card, Col, Empty, Row, Skeleton } from 'antd'
import { AppstoreOutlined, FileTextOutlined, MoneyCollectOutlined, TeamOutlined } from '@ant-design/icons'
import { Area, Bar } from '@ant-design/plots'
import { StatisticCard } from '@ant-design/pro-components'
import { useRequest } from 'ahooks'
import { useThemeStore } from '@/store/theme'
import styles from './index.module.scss'

// 统计卡片数据（暂用静态数据，后续可改为接口）
const statsData = [
  { title: '用户数', value: 14966, total: 16236, icon: <TeamOutlined /> },
  { title: '充值数', value: 4286, total: 6142, icon: <MoneyCollectOutlined /> },
  { title: '订单数', value: 5649, total: 5232, icon: <FileTextOutlined /> },
  { title: '游戏数', value: 619, total: 2132, icon: <AppstoreOutlined /> },
]

// 模拟接口请求（实际项目中替换为真实接口）
const fetchLineChartData = async () => {
  return [
    { date: '07-11', value: 120, type: '充值数' },
    { date: '07-12', value: 100, type: '充值数' },
    { date: '07-13', value: 120, type: '充值数' },
    { date: '07-14', value: 130, type: '充值数' },
    { date: '07-15', value: 110, type: '充值数' },
    { date: '07-16', value: 280, type: '充值数' },
    { date: '07-17', value: 150, type: '充值数' },
    { date: '07-11', value: 80, type: '用户数' },
    { date: '07-12', value: 110, type: '用户数' },
    { date: '07-13', value: 90, type: '用户数' },
    { date: '07-14', value: 60, type: '用户数' },
    { date: '07-15', value: 70, type: '用户数' },
    { date: '07-16', value: 100, type: '用户数' },
    { date: '07-17', value: 85, type: '用户数' },
  ]
}

const fetchRankingData = async () => {
  return [
    { name: '西班牙', value: 2100 },
    { name: '安曼切达', value: 1850 },
    { name: '永泊麻花', value: 1700 },
    { name: '修修你好', value: 1600 },
    { name: '菊麦', value: 1500 },
    { name: '六月蜂包', value: 1350 },
    { name: '闲兴夏', value: 1300 },
    { name: '反裴典屋来何犬', value: 1200 },
    { name: 'DY建议', value: 1100 },
    { name: '莫王牢玉', value: 1000 },
    { name: '漫云万犬', value: 900 },
    { name: '孤独舍雷气', value: 850 },
  ]
}

// 图表通用配置
const CHART_HEIGHT = 350
const AXIS_SPACING = { labelSpacing: 10 }

export default function Dashboard() {
  const { theme } = useThemeStore()
  const chartTheme = theme === 'dark' ? 'classicDark' : 'classic'

  // 获取图表数据
  const { data: lineChartData = [], loading: lineLoading } = useRequest(fetchLineChartData)
  const { data: rankingData = [], loading: rankLoading } = useRequest(fetchRankingData)

  // 折线图配置
  const areaConfig = {
    data: lineChartData,
    height: CHART_HEIGHT,
    xField: 'date',
    yField: 'value',
    colorField: 'type',
    shapeField: 'smooth',
    theme: chartTheme,
    style: { fillOpacity: 0.4 },
    axis: { x: AXIS_SPACING, y: AXIS_SPACING },
    scale: {
      color: {
        range: ['linear-gradient(-90deg, #fff 0%, #1890ff 100%)', 'linear-gradient(-90deg, #fff 0%, #87d068 100%)'],
      },
    },
  }

  // 柱状图配置
  const barConfig = {
    data: rankingData,
    height: CHART_HEIGHT,
    xField: 'name',
    yField: 'value',
    theme: chartTheme,
    legend: false as const,
    coordinate: { transform: [{ type: 'transpose' }] },
    axis: {
      x: { ...AXIS_SPACING, tick: false },
      y: { ...AXIS_SPACING, grid: true, gridLineDash: [0] },
    },
    tooltip: { items: [{ channel: 'y', name: '充值数' }] },
    style: {
      fill: 'linear-gradient(0deg, rgba(91, 143, 249, 0.5) 0%, rgba(91, 143, 249, 1) 100%)',
      radius: 4,
    },
    scale: { x: { padding: 0.4 } },
  }

  // 渲染图表内容（处理加载和空状态）
  const renderChartContent = (loading: boolean, data: unknown[], chart: React.ReactNode) => {
    if (loading) {
      return (
        <div style={{ height: CHART_HEIGHT }}>
          <Skeleton active paragraph={{ rows: 8 }} title={false} />
        </div>
      )
    }
    if (data.length === 0) {
      return (
        <div style={{ height: CHART_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无数据" />
        </div>
      )
    }
    return chart
  }

  return (
    <div className={styles.dashboard}>
      {/* 统计卡片 */}
      <Row gutter={16} className={styles.statsRow}>
        {statsData.map((stat) => (
          <Col span={6} key={stat.title}>
            <StatisticCard
              statistic={{
                title: stat.title,
                value: stat.value,
                icon: stat.icon,
                description: <span>总数: {stat.total.toLocaleString()}</span>,
              }}
            />
          </Col>
        ))}
      </Row>

      {/* 图表区域 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="有效充值占比" bordered={false} hoverable>
            {renderChartContent(lineLoading, lineChartData, <Area {...areaConfig} />)}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="当日充值排行" bordered={false} hoverable>
            {renderChartContent(rankLoading, rankingData, <Bar {...barConfig} />)}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
