import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App as AntApp, Button, Card, Col, Drawer, Empty, List, Popconfirm, Row, Segmented, Select, Skeleton, Space, Tabs, Tag, Tooltip, Typography } from 'antd'
import { PageContainer, ProCard, ProDescriptions, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { Decimal } from 'decimal.js'
import ReactECharts from 'echarts-for-react'
import { tradingApi, type TradeQualityAnalysisResult } from '../api/trading'
import { useProfitDisplay } from '../hooks/useProfitDisplay'
import type {
  AuditLog,
  ExchangeCode,
  OrderRecoveryFailureStage,
  OrderRecoveryRecord,
  OrderRecoveryStatus,
  TradeDailyReport,
  TradeAccountType,
  TradeFill,
  TradeOperationLog,
} from '../types'
import { toTableRequestResult } from '../utils/proTable'

function renderMode(mode: TradeAccountType) {
  return <Tag color={mode === 'simulation' ? 'processing' : 'error'}>{mode === 'simulation' ? '模拟下单' : '真实下单'}</Tag>
}

function renderPayload(payloadJson?: string) {
  if (!payloadJson) {
    return '-'
  }

  try {
    return JSON.stringify(JSON.parse(payloadJson), null, 2)
  } catch {
    return payloadJson
  }
}

function parseAuditPayload(payloadJson?: string) {
  if (!payloadJson) {
    return undefined
  }

  try {
    return JSON.parse(payloadJson) as Record<string, unknown>
  } catch {
    return undefined
  }
}

const recoveryStatusMeta: Record<OrderRecoveryStatus, { text: string; color: string }> = {
  pending_recovery: { text: '待恢复', color: 'processing' },
  recovering: { text: '恢复中', color: 'warning' },
  recovered: { text: '已恢复', color: 'success' },
  manual_review_required: { text: '需人工处理', color: 'error' },
  recovery_failed: { text: '恢复失败', color: 'error' },
}

const recoveryStageMeta: Record<OrderRecoveryFailureStage, string> = {
  order_submit_finalize: '订单提交落库',
  rule_trigger_finalize: '规则确认收尾',
  order_sync: '订单状态同步',
  private_stream: '私有推送',
  trade_fill_sync: '成交补全',
  balance_refresh: '余额刷新',
}

function QualityAnalysisPanel() {
  const { message } = AntApp.useApp()
  const profitDisplay = useProfitDisplay()

  const [days, setDays] = useState<number>(30)
  const [exchange, setExchange] = useState<ExchangeCode | undefined>(undefined)
  const [mode, setMode] = useState<'simulation' | 'real' | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(false)
  const [data, setData] = useState<TradeQualityAnalysisResult | undefined>(undefined)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await tradingApi.getQualityAnalysis(days, exchange, mode)
      setData(res)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取质量分析数据失败')
    } finally {
      setLoading(false)
    }
  }, [days, exchange, mode, message])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // ECharts Option 定义
  const pieOption = useMemo(() => {
    if (!data) return {}
    return {
      title: { text: '订单状态分布', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: '0', left: 'center' },
      series: [
        {
          name: '订单状态',
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
          data: data.statusDistribution,
        },
      ],
    }
  }, [data])

  const barOption = useMemo(() => {
    if (!data || data.topSymbols.length === 0) return {}
    const reversed = [...data.topSymbols].reverse()
    return {
      title: { text: '成交额 Top 排行 (USDT)', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '8%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
      yAxis: { type: 'category', data: reversed.map(d => d.symbol) },
      series: [
        {
          name: '成交额',
          type: 'bar',
          data: reversed.map(d => Number(d.volume)),
          itemStyle: { color: '#1890ff', borderRadius: [0, 4, 4, 0] },
        },
      ],
    }
  }, [data])

  const trendOption = useMemo(() => {
    if (!data || data.dailyTrend.length === 0) return {}
    const sorted = [...data.dailyTrend].sort((a, b) => a.date.localeCompare(b.date))
    return {
      title: { text: '滑点与撮合延迟趋势', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      legend: { data: ['滑点 (%)', '撮合延迟 (ms)'], bottom: '0' },
      grid: { left: '5%', right: '5%', bottom: '12%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: sorted.map(d => d.date) },
      yAxis: [
        {
          type: 'value',
          name: '滑点 (%)',
          axisLabel: { formatter: '{value}%' },
          splitLine: { show: false },
        },
        {
          type: 'value',
          name: '撮合延迟 (ms)',
          splitLine: { lineStyle: { type: 'dashed' } },
        },
      ],
      series: [
        {
          name: '滑点 (%)',
          type: 'line',
          smooth: true,
          data: sorted.map(d => Number(d.avgSlippagePercent.toFixed(4))),
          lineStyle: { color: '#ff4d4f', width: 2 },
          itemStyle: { color: '#ff4d4f' },
        },
        {
          name: '撮合延迟 (ms)',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          data: sorted.map(d => Math.round(d.avgExecutionLatencyMs)),
          lineStyle: { color: '#52c41a', width: 2 },
          itemStyle: { color: '#52c41a' },
        },
      ],
    }
  }, [data])

  if (loading && !data) {
    return (
      <Card bordered={false}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </Card>
    )
  }

  const summary = data?.summary

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部筛选栏 */}
      <Card size="small" bordered={false}>
        <Row justify="space-between" align="middle">
          <Col>
            <Segmented
              value={days}
              options={[
                { label: '近 7 天', value: 7 },
                { label: '近 30 天', value: 30 },
                { label: '近 90 天', value: 90 },
              ]}
              onChange={val => setDays(val as number)}
            />
          </Col>
          <Col>
            <Space>
              <Select
                value={exchange}
                onChange={setExchange}
                options={[
                  { label: '全部交易所', value: undefined },
                  { label: 'OKX', value: 'okx' },
                  { label: 'Binance', value: 'binance' },
                ]}
                style={{ width: 120 }}
                placeholder="选择交易所"
                allowClear
              />
              <Select
                value={mode}
                onChange={setMode}
                options={[
                  { label: '全部模式', value: undefined },
                  { label: '模拟交易', value: 'simulation' },
                  { label: '真实交易', value: 'real' },
                ]}
                style={{ width: 110 }}
                placeholder="下单模式"
                allowClear
              />
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新分析
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 指标卡片行 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <ProCard
            title="订单成交率"
            tooltip="已成交订单占所有订单的比例"
            boxShadow
            bordered
            bodyStyle={{ padding: '12px 24px' }}
          >
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>
              {summary ? `${(summary.fillRate * 100).toFixed(2)}%` : '0.00%'}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
              成交 / 总单：{summary ? `${summary.filledOrderCount} / ${summary.totalOrderCount}` : '0 / 0'}
            </div>
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard
            title="交易胜率"
            tooltip="平仓盈利单占总平仓单的比例"
            boxShadow
            bordered
            bodyStyle={{ padding: '12px 24px' }}
          >
            <div style={{ fontSize: 24, fontWeight: 'bold', color: summary && summary.winRate >= 0.5 ? '#52c41a' : '#ff4d4f' }}>
              {summary ? `${(summary.winRate * 100).toFixed(2)}%` : '0.00%'}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
              盈亏比：{summary ? (summary.profitLossRatio === 999 ? '∞' : summary.profitLossRatio.toFixed(2)) : '0.00'}
            </div>
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard
            title="平均撮合延迟"
            tooltip="订单提交到交易所最终完全成交的平均网络与撮合时间"
            boxShadow
            bordered
            bodyStyle={{ padding: '12px 24px' }}
          >
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>
              {summary ? `${Math.round(summary.avgExecutionLatencyMs)} ms` : '0 ms'}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
              触发响应延迟：{summary ? `${Math.round(summary.avgTriggerLatencyMs)} ms` : '0 ms'}
            </div>
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard
            title="平均成交滑点"
            tooltip="成交均价相较于触发价格的平均偏离程度"
            boxShadow
            bordered
            bodyStyle={{ padding: '12px 24px' }}
          >
            <div style={{ fontSize: 24, fontWeight: 'bold', color: summary && summary.avgSlippagePercent > 0.5 ? '#faad14' : 'inherit' }}>
              {summary ? `${summary.avgSlippagePercent.toFixed(4)}%` : '0.0000%'}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
              滑点越低，执行质量越优
            </div>
          </ProCard>
        </Col>
      </Row>

      {/* 分布与排行 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={10}>
          <ProCard title="订单状态及失败诊断" split="horizontal" bordered>
            <ProCard bodyStyle={{ height: 260 }}>
              {data && data.statusDistribution.some(item => item.value > 0) ? (
                <ReactECharts option={pieOption} style={{ height: '100%', width: '100%' }} />
              ) : (
                <Empty description="暂无状态数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </ProCard>
            <ProCard title="失败原因排行" headerBordered bodyStyle={{ maxHeight: 200, overflowY: 'auto' }}>
              {data && data.failedReasons.length > 0 ? (
                <List
                  size="small"
                  dataSource={data.failedReasons}
                  renderItem={(item, index) => (
                    <List.Item extra={<Tag color="error">{item.count} 次</Tag>}>
                      <Typography.Text ellipsis style={{ width: '80%' }}>
                        {index + 1}. {item.reason}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              ) : (
                <div style={{ color: '#8c8c8c', textAlign: 'center', padding: 16 }}>暂无失败记录</div>
              )}
            </ProCard>
          </ProCard>
        </Col>
        <Col xs={24} md={14}>
          <ProCard title="交易对活跃度与盈利分析" bordered bodyStyle={{ height: 494 }}>
            {data && data.topSymbols.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, minHeight: 280 }}>
                  <ReactECharts option={barOption} style={{ height: '100%', width: '100%' }} />
                </div>
                <div style={{ padding: '8px 24px', borderTop: '1px solid #f0f0f0' }}>
                  <Typography.Text strong style={{ fontSize: 13 }}>交易对已实现盈亏列表：</Typography.Text>
                  <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                    {data.topSymbols.map(s => {
                      return (
                        <Col key={s.symbol} span={12}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: 12 }}>
                            <span style={{ color: '#595959' }}>{s.symbol}:</span>
                            <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
                              {profitDisplay.renderMoney(s.realizedPnl, 'USDT')}
                            </span>
                          </div>
                        </Col>
                      )
                    })}
                  </Row>
                </div>
              </div>
            ) : (
              <Empty description="暂无成交对分析" />
            )}
          </ProCard>
        </Col>
      </Row>

      {/* 执行趋势折线图 */}
      <Card bordered={false}>
        {data && data.dailyTrend.some(d => d.avgSlippagePercent > 0 || d.avgExecutionLatencyMs > 0) ? (
          <ReactECharts option={trendOption} style={{ height: 320 }} />
        ) : (
          <Empty description="暂无趋势数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </div>
  )
}

export function TradeLogsPage() {
  const { message } = AntApp.useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const fillActionRef = useRef<ActionType | undefined>(undefined)
  const logActionRef = useRef<ActionType | undefined>(undefined)
  const auditActionRef = useRef<ActionType | undefined>(undefined)
  const recoveryActionRef = useRef<ActionType | undefined>(undefined)
  const reportActionRef = useRef<ActionType | undefined>(undefined)
  const profitDisplay = useProfitDisplay()
  const activeTab = searchParams.get('tab') === 'logs'
    ? 'logs'
    : searchParams.get('tab') === 'audits'
      ? 'audits'
      : searchParams.get('tab') === 'recoveries'
        ? 'recoveries'
        : searchParams.get('tab') === 'report'
          ? 'report'
          : searchParams.get('tab') === 'analysis'
            ? 'analysis'
            : 'fills'

  // 交易日报：天数筛选和 Drawer 明细状态
  const [reportDays, setReportDays] = useState<number>(30)
  const [reportExchange, setReportExchange] = useState<ExchangeCode | undefined>(undefined)
  const [reportMode, setReportMode] = useState<'simulation' | 'real' | undefined>(undefined)
  const [reportDrawerRow, setReportDrawerRow] = useState<TradeDailyReport | undefined>(undefined)
  const reportDrawerActionRef = useRef<ActionType | undefined>(undefined)

  const fillColumns = useMemo<ProColumns<TradeFill>[]>(
    () => [
      { title: '下单模式', dataIndex: 'accountType', width: 110, render: (_, row) => renderMode(row.accountType) },
      { title: '交易所', dataIndex: 'exchange', width: 90, render: (_, row) => <Tag>{row.exchange.toUpperCase()}</Tag> },
      { title: '交易对', dataIndex: 'symbol', width: 120 },
      { title: '方向', dataIndex: 'side', width: 90, render: (_, row) => <Tag color={row.side === 'buy' ? 'success' : 'warning'}>{row.side === 'buy' ? '买入' : '卖出'}</Tag> },
      { title: '成交价', dataIndex: 'price' },
      { title: '数量', dataIndex: 'baseQuantity' },
      { title: '成交额', dataIndex: 'quoteAmount' },
      { title: '手续费', dataIndex: 'feeAmount', render: (_, row) => `${row.feeAmount} ${row.feeCurrency}` },
      { title: '已实现盈亏', dataIndex: 'realizedPnl', render: (_, row) => profitDisplay.renderMoney(row.realizedPnl, row.feeCurrency) },
      { title: '成交时间', dataIndex: 'createdAt', valueType: 'dateTime' },
    ],
    [profitDisplay],
  )

  const logColumns = useMemo<ProColumns<TradeOperationLog>[]>(
    () => [
      { title: '下单模式', dataIndex: 'accountType', width: 110, render: (_, row) => renderMode(row.accountType) },
      { title: '交易所', dataIndex: 'exchange', width: 90, render: (_, row) => <Tag>{row.exchange.toUpperCase()}</Tag> },
      { title: '级别', dataIndex: 'level', width: 90, render: (_, row) => <Tag color={row.level === 'error' ? 'error' : row.level === 'warning' ? 'warning' : 'processing'}>{row.level}</Tag> },
      { title: '动作', dataIndex: 'action', width: 150 },
      { title: '消息', dataIndex: 'message', ellipsis: true },
      {
        title: '详情',
        dataIndex: 'payloadJson',
        width: 90,
        render: (_, row) => (
          <Tooltip title={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{renderPayload(row.payloadJson)}</pre>}>
            <Typography.Link disabled={!row.payloadJson}>查看</Typography.Link>
          </Tooltip>
        ),
      },
      { title: '时间', dataIndex: 'createdAt', valueType: 'dateTime' },
    ],
    [],
  )

  const auditColumns = useMemo<ProColumns<AuditLog>[]>(
    () => [
      {
        title: '级别',
        dataIndex: 'level',
        width: 90,
        render: (_, row) => <Tag color={row.level === 'error' ? 'error' : row.level === 'warning' ? 'warning' : 'processing'}>{row.level}</Tag>,
      },
      { title: '动作', dataIndex: 'action', width: 150 },
      {
        title: '来源',
        key: 'source',
        width: 100,
        render: (_, row) => {
          const payload = parseAuditPayload(row.payloadJson)
          const source = payload?.source
          if (source === 'manual') {
            return <Tag color='processing'>快捷交易</Tag>
          }
          if (source === 'rule') {
            return <Tag color='warning'>策略计划</Tag>
          }
          return '-'
        },
      },
      {
        title: '交易环境',
        key: 'tradingEnvironment',
        width: 130,
        render: (_, row) => {
          const payload = parseAuditPayload(row.payloadJson)
          return typeof payload?.tradingEnvironment === 'string' ? payload.tradingEnvironment : '-'
        },
      },
      {
        title: '交易所订单号',
        key: 'exchangeOrderId',
        width: 160,
        ellipsis: true,
        render: (_, row) => {
          const payload = parseAuditPayload(row.payloadJson)
          return typeof payload?.exchangeOrderId === 'string' ? payload.exchangeOrderId : '-'
        },
      },
      {
        title: '失败原因',
        key: 'errorMessage',
        ellipsis: true,
        render: (_, row) => {
          const payload = parseAuditPayload(row.payloadJson)
          if (typeof payload?.errorMessage === 'string') {
            return payload.errorMessage
          }

          return row.action === 'order.failed' ? row.message : '-'
        },
      },
      {
        title: '错误码',
        key: 'errorCode',
        width: 110,
        render: (_, row) => {
          const payload = parseAuditPayload(row.payloadJson)
          return typeof payload?.errorCode === 'string' ? payload.errorCode : '-'
        },
      },
      { title: '摘要', dataIndex: 'message', ellipsis: true },
      {
        title: '详情',
        dataIndex: 'payloadJson',
        width: 90,
        render: (_, row) => (
          <Tooltip title={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{renderPayload(row.payloadJson)}</pre>}>
            <Typography.Link disabled={!row.payloadJson}>查看</Typography.Link>
          </Tooltip>
        ),
      },
      { title: '时间', dataIndex: 'createdAt', valueType: 'dateTime' },
    ],
    [],
  )

  const recoveryColumns = useMemo<ProColumns<OrderRecoveryRecord>[]>(
    () => [
      {
        title: '状态',
        dataIndex: 'recoveryStatus',
        width: 120,
        render: (_, row) => <Tag color={recoveryStatusMeta[row.recoveryStatus].color}>{recoveryStatusMeta[row.recoveryStatus].text}</Tag>,
      },
      {
        title: '阶段',
        dataIndex: 'failureStage',
        width: 130,
        render: (_, row) => recoveryStageMeta[row.failureStage],
      },
      {
        title: '来源',
        dataIndex: 'source',
        width: 100,
        render: (_, row) => row.source === 'manual' ? <Tag color='processing'>快捷交易</Tag> : row.source === 'rule' ? <Tag color='warning'>策略计划</Tag> : <Tag>系统</Tag>,
      },
      { title: '模式', dataIndex: 'mode', width: 100, render: (_, row) => renderMode(row.mode) },
      { title: '交易所', dataIndex: 'exchange', width: 90, render: (_, row) => <Tag>{row.exchange.toUpperCase()}</Tag> },
      { title: '交易对', dataIndex: 'symbol', width: 120, render: (_, row) => row.symbol ?? '-' },
      { title: '订单号', dataIndex: 'exchangeOrderId', width: 180, ellipsis: true, render: (_, row) => row.exchangeOrderId ?? '-' },
      { title: '重试次数', key: 'retryCount', width: 100, render: (_, row) => `${row.retryCount}/${row.maxRetryCount}` },
      { title: '最近错误', dataIndex: 'lastErrorMessage', ellipsis: true, render: (_, row) => row.lastErrorMessage ?? '-' },
      { title: '下次重试', dataIndex: 'nextRetryAt', valueType: 'dateTime', width: 170, render: (_, row) => row.nextRetryAt ?? '-' },
      { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', width: 170 },
      {
        title: '操作',
        valueType: 'option',
        width: 100,
        render: (_, row) => [
          <Popconfirm
            key='retry'
            title='重试恢复任务'
            description='将立即触发一次人工恢复重试'
            disabled={row.recoveryStatus === 'recovering' || row.recoveryStatus === 'recovered'}
            onConfirm={async () => {
              await tradingApi.retryOrderRecovery(row.id)
              message.success('恢复任务已触发重试')
              recoveryActionRef.current?.reload()
              auditActionRef.current?.reload()
            }}
          >
            <Button type='link' disabled={row.recoveryStatus === 'recovering' || row.recoveryStatus === 'recovered'}>
              重试
            </Button>
          </Popconfirm>,
        ],
      },
    ],
    [message],
  )

  // 交易日报：日期维度统计列定义
  const reportColumns = useMemo<ProColumns<TradeDailyReport>[]>(
    () => [
      {
        title: '日期',
        dataIndex: 'date',
        width: 120,
        render: (_, row) => <Typography.Text strong>{row.date}</Typography.Text>,
      },
      { title: '订单数', dataIndex: 'orderCount', width: 80 },
      {
        title: '成交',
        key: 'filled',
        width: 150,
        render: (_, row) => (
          <span>
            <Tag color='success' style={{ marginRight: 2 }}>{row.filledOrderCount}</Tag>
            <Tag color='error' style={{ marginRight: 2 }}>{row.failedOrderCount}</Tag>
            <Tag>{row.cancelledOrderCount}</Tag>
          </span>
        ),
      },
      {
        title: '成交额 (USDT)',
        dataIndex: 'totalQuoteAmount',
        render: (_, row) => new Decimal(row.totalQuoteAmount).toFixed(4),
      },
      {
        title: '手续费',
        dataIndex: 'totalFeeAmount',
        render: (_, row) => new Decimal(row.totalFeeAmount).toFixed(6),
      },
      {
        title: '已实现盈亏',
        dataIndex: 'totalRealizedPnl',
        render: (_, row) => profitDisplay.renderMoney(row.totalRealizedPnl, 'USDT'),
      },
      {
        title: '买/卖笔数',
        key: 'buySell',
        width: 100,
        render: (_, row) => `${row.buyCount} / ${row.sellCount}`,
      },
      {
        title: '信号数',
        dataIndex: 'signalCount',
        width: 80,
      },
      {
        title: '风控通过/拒绝',
        key: 'risk',
        width: 120,
        render: (_, row) => (
          <span>
            <Tag color='success'>{row.riskPassCount}</Tag>
            <Tag color='error'>{row.riskRejectCount}</Tag>
          </span>
        ),
      },
      {
        title: '操作',
        valueType: 'option',
        width: 80,
        render: (_, row) => [
          <Button
            key='detail'
            type='link'
            onClick={async () => {
              setReportDrawerRow(row)
              setTimeout(() => reportDrawerActionRef.current?.reload(), 0)
            }}
          >
            明细
          </Button>,
        ],
      },
    ],
    [profitDisplay, reportMode, reportExchange],
  )

  return (
    <PageContainer subTitle='查看模拟和真实交易共用的成交记录与操作日志'>
      <Tabs
        activeKey={activeTab}
        onChange={tab => setSearchParams({ tab })}
        items={[
          {
            key: 'fills',
            label: '成交记录',
            children: (
              <ProTable<TradeFill>
                actionRef={fillActionRef}
                rowKey='id'
                search={false}
                columns={fillColumns}
                request={async () => toTableRequestResult(await tradingApi.getTradeFills(undefined, undefined, 200))}
                pagination={{ pageSize: 8 }}
                toolBarRender={() => [
                  <Button key='reload' icon={<ReloadOutlined />} onClick={() => fillActionRef.current?.reload()}>
                    刷新成交
                  </Button>,
                ]}
              />
            ),
          },
          {
            key: 'logs',
            label: '操作日志',
            children: (
              <ProTable<TradeOperationLog>
                actionRef={logActionRef}
                rowKey='id'
                search={false}
                columns={logColumns}
                request={async () => toTableRequestResult(await tradingApi.getTradeLogs(undefined, undefined, 200))}
                pagination={{ pageSize: 8 }}
                toolBarRender={() => [
                  <Button key='reload' icon={<ReloadOutlined />} onClick={() => logActionRef.current?.reload()}>
                    刷新日志
                  </Button>,
                ]}
              />
            ),
          },
          {
            key: 'audits',
            label: '审计日志',
            children: (
              <ProTable<AuditLog>
                actionRef={auditActionRef}
                rowKey='id'
                search={false}
                columns={auditColumns}
                request={async params => {
                  const pageResult = await tradingApi.getAuditLogPage(
                    params.current ?? 1,
                    params.pageSize ?? 8,
                    [
                      'order.submitted',
                      'order.synced',
                      'order.failed',
                      'order.sync_failed',
                      'private_stream.error',
                      'trigger.failed',
                      'trigger.confirmed',
                      'recovery.created',
                      'recovery.retry_started',
                      'recovery.retry_succeeded',
                      'recovery.retry_failed',
                      'recovery.manual_review_required',
                    ],
                  )

                  return {
                    data: pageResult.items,
                    success: true,
                    total: pageResult.total,
                  }
                }}
                pagination={{ pageSize: 8 }}
                toolBarRender={() => [
                  <Button key='reload' icon={<ReloadOutlined />} onClick={() => auditActionRef.current?.reload()}>
                    刷新审计
                  </Button>,
                ]}
              />
            ),
          },
          {
            key: 'recoveries',
            label: '恢复任务',
            children: (
              <ProTable<OrderRecoveryRecord>
                actionRef={recoveryActionRef}
                rowKey='id'
                search={false}
                columns={recoveryColumns}
                request={async params => {
                  const pageResult = await tradingApi.getOrderRecoveryPage(
                    params.current ?? 1,
                    params.pageSize ?? 8,
                  )
                  return {
                    data: pageResult.items,
                    success: true,
                    total: pageResult.total,
                  }
                }}
                pagination={{ pageSize: 8 }}
                toolBarRender={() => [
                  <Button key='reload' icon={<ReloadOutlined />} onClick={() => recoveryActionRef.current?.reload()}>
                    刷新恢复
                  </Button>,
                ]}
              />
            ),
          },
          {
            key: 'report',
            label: '交易日报',
            children: (
              <>
                <ProTable<TradeDailyReport>
                  actionRef={reportActionRef}
                  rowKey='date'
                  search={false}
                  columns={reportColumns}
                  request={async () => {
                    const items = await tradingApi.getDailyReport(reportDays, reportExchange, reportMode)
                    return { data: items, success: true, total: items.length }
                  }}
                  pagination={{ pageSize: 15, showSizeChanger: false }}
                  toolBarRender={() => [
                    <Segmented
                      key='days'
                      value={reportDays}
                      options={[
                        { label: '近 7 天', value: 7 },
                        { label: '近 30 天', value: 30 },
                        { label: '近 90 天', value: 90 },
                      ]}
                      onChange={val => {
                        setReportDays(val as number)
                        // 切换后立即重新加载
                        setTimeout(() => reportActionRef.current?.reload(), 0)
                      }}
                    />,
                    <Select
                      key='exchange'
                      value={reportExchange}
                      onChange={val => {
                        setReportExchange(val)
                        setTimeout(() => reportActionRef.current?.reload(), 0)
                      }}
                      options={[
                        { label: '全部交易所', value: undefined },
                        { label: 'OKX', value: 'okx' },
                        { label: 'Binance', value: 'binance' },
                      ]}
                      style={{ width: 120 }}
                      placeholder="选择交易所"
                      allowClear
                    />,
                    <Select
                      key='mode'
                      value={reportMode}
                      onChange={val => {
                        setReportMode(val)
                        setTimeout(() => reportActionRef.current?.reload(), 0)
                      }}
                      options={[
                        { label: '全部模式', value: undefined },
                        { label: '模拟交易', value: 'simulation' },
                        { label: '真实交易', value: 'real' },
                      ]}
                      style={{ width: 110 }}
                      placeholder="下单模式"
                      allowClear
                    />,
                    <Button key='reload' icon={<ReloadOutlined />} onClick={() => reportActionRef.current?.reload()}>
                      刷新日报
                    </Button>,
                  ]}
                />
                {/* 当日成交明细 Drawer */}
                <Drawer
                  title={reportDrawerRow ? `${reportDrawerRow.date} 成交明细` : '成交明细'}
                  open={!!reportDrawerRow}
                  onClose={() => setReportDrawerRow(undefined)}
                  width={860}
                  destroyOnHidden
                >
                  {reportDrawerRow && (
                    <>
                      <ProDescriptions<TradeDailyReport>
                        dataSource={reportDrawerRow}
                        columns={[
                          { label: '订单数', dataIndex: 'orderCount' },
                          { label: '成交订单', dataIndex: 'filledOrderCount' },
                          { label: '失败订单', dataIndex: 'failedOrderCount' },
                          { label: '取消订单', dataIndex: 'cancelledOrderCount' },
                          { label: '成交额', dataIndex: 'totalQuoteAmount', render: v => new Decimal(String(v)).toFixed(4) + ' USDT' },
                          { label: '手续费', dataIndex: 'totalFeeAmount', render: v => new Decimal(String(v)).toFixed(6) },
                          { label: '已实现盈亏', dataIndex: 'totalRealizedPnl', render: (_, row) => profitDisplay.renderMoney(row.totalRealizedPnl, 'USDT') },
                          { label: '买入笔数', dataIndex: 'buyCount' },
                          { label: '卖出笔数', dataIndex: 'sellCount' },
                          { label: '信号数', dataIndex: 'signalCount' },
                          { label: '风控通过', dataIndex: 'riskPassCount' },
                          { label: '风控拒绝', dataIndex: 'riskRejectCount' },
                        ]}
                        column={3}
                        style={{ marginBottom: 16 }}
                      />
                      <ProTable<TradeFill>
                        actionRef={reportDrawerActionRef}
                        rowKey='id'
                        search={false}
                        request={async params => {
                          if (!reportDrawerRow) {
                            return { data: [], success: true, total: 0 }
                          }
                          const pageResult = await tradingApi.getTradeFillPage(
                            params.current ?? 1,
                            params.pageSize ?? 10,
                            reportMode,
                            reportExchange,
                            reportDrawerRow.date,
                          )
                          return {
                            data: pageResult.items,
                            success: true,
                            total: pageResult.total,
                          }
                        }}
                        pagination={{ pageSize: 10 }}
                        columns={fillColumns}
                        toolBarRender={false}
                      />
                    </>
                  )}
                </Drawer>
              </>
            ),
          },
          {
            key: 'analysis',
            label: '执行分析',
            children: <QualityAnalysisPanel />,
          },
        ]}
      />
    </PageContainer>
  )
}
