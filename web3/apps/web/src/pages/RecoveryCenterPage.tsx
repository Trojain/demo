import { useCallback, useEffect, useMemo, useRef, useState, type Key } from 'react'
import { App as AntApp, Button, Card, Col, Empty, Popconfirm, Row, Segmented, Select, Skeleton, Space, Tag, Typography } from 'antd'
import { PageContainer, ProCard, ProTable, StatisticCard, type ActionType, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import {
  tradingApi,
  type OrderRecoveryAnalysisResult,
  type RetryOrderRecoveryBatchPayload,
  type RetryOrderRecoveryBatchResult,
} from '../api/trading'
import type {
  ExchangeCode,
  OrderRecoveryFailureStage,
  OrderRecoveryRecord,
  OrderRecoverySource,
  OrderRecoveryStatus,
  TradeAccountType,
} from '../types'

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
  balance_refresh: '账户余额刷新',
}

const recoverySourceMeta: Record<OrderRecoverySource, { text: string; color: string }> = {
  manual: { text: '快捷交易', color: 'processing' },
  rule: { text: '策略计划', color: 'warning' },
  system: { text: '系统任务', color: 'default' },
}

function formatDurationSeconds(durationMs?: number) {
  if (!durationMs || durationMs <= 0) {
    return '0.00 秒'
  }

  return `${(durationMs / 1000).toFixed(2)} 秒`
}

function hasBatchFilter(payload: RetryOrderRecoveryBatchPayload) {
  return Boolean(
    payload.statuses?.length
    || payload.stages?.length
    || payload.exchanges?.length
    || payload.modes?.length
    || payload.sources?.length,
  )
}

export function RecoveryCenterPage() {
  const { message } = AntApp.useApp()
  const actionRef = useRef<ActionType | undefined>(undefined)
  const [analysisDays, setAnalysisDays] = useState<number>(30)
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [statusFilters, setStatusFilters] = useState<OrderRecoveryStatus[]>([])
  const [stageFilters, setStageFilters] = useState<OrderRecoveryFailureStage[]>([])
  const [exchangeFilters, setExchangeFilters] = useState<ExchangeCode[]>([])
  const [modeFilters, setModeFilters] = useState<TradeAccountType[]>([])
  const [sourceFilters, setSourceFilters] = useState<OrderRecoverySource[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [lastBatchResult, setLastBatchResult] = useState<RetryOrderRecoveryBatchResult>()
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysis, setAnalysis] = useState<OrderRecoveryAnalysisResult>()

  useEffect(() => {
    setSelectedRowKeys([])
    setLastBatchResult(undefined)
    actionRef.current?.reloadAndRest?.()
  }, [statusFilters, stageFilters, exchangeFilters, modeFilters, sourceFilters])

  const loadAnalysis = useCallback(async () => {
    setAnalysisLoading(true)
    try {
      const result = await tradingApi.getOrderRecoveryAnalysis(
        analysisDays,
        statusFilters.length > 0 ? statusFilters : undefined,
        stageFilters.length > 0 ? stageFilters : undefined,
        exchangeFilters.length > 0 ? exchangeFilters : undefined,
        modeFilters.length > 0 ? modeFilters : undefined,
        sourceFilters.length > 0 ? sourceFilters : undefined,
      )
      setAnalysis(result)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取恢复统计失败')
    } finally {
      setAnalysisLoading(false)
    }
  }, [analysisDays, exchangeFilters, message, modeFilters, sourceFilters, stageFilters, statusFilters])

  useEffect(() => {
    void loadAnalysis()
  }, [loadAnalysis])

  const columns = useMemo<ProColumns<OrderRecoveryRecord>[]>(() => [
    {
      title: '状态',
      dataIndex: 'recoveryStatus',
      width: 120,
      render: (_, row) => <Tag color={recoveryStatusMeta[row.recoveryStatus].color}>{recoveryStatusMeta[row.recoveryStatus].text}</Tag>,
    },
    {
      title: '阶段',
      dataIndex: 'failureStage',
      width: 140,
      render: (_, row) => recoveryStageMeta[row.failureStage],
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 110,
      render: (_, row) => <Tag color={recoverySourceMeta[row.source].color}>{recoverySourceMeta[row.source].text}</Tag>,
    },
    {
      title: '模式',
      dataIndex: 'mode',
      width: 110,
      render: (_, row) => <Tag color={row.mode === 'simulation' ? 'processing' : 'error'}>{row.mode === 'simulation' ? '模拟交易' : '真实交易'}</Tag>,
    },
    {
      title: '交易所',
      dataIndex: 'exchange',
      width: 90,
      render: (_, row) => <Tag>{row.exchange.toUpperCase()}</Tag>,
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      width: 120,
      render: (_, row) => row.symbol ?? '-',
    },
    {
      title: '交易所订单号',
      dataIndex: 'exchangeOrderId',
      ellipsis: true,
      render: (_, row) => row.exchangeOrderId ?? '-',
    },
    {
      title: '重试次数',
      key: 'retryCount',
      width: 110,
      render: (_, row) => `${row.retryCount}/${row.maxRetryCount}`,
    },
    {
      title: '最近错误',
      dataIndex: 'lastErrorMessage',
      ellipsis: true,
      render: (_, row) => row.lastErrorMessage ?? '-',
    },
    {
      title: '下次重试',
      dataIndex: 'nextRetryAt',
      valueType: 'dateTime',
      width: 170,
      render: (_, row) => row.nextRetryAt ?? '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      width: 170,
    },
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
            actionRef.current?.reload()
            void loadAnalysis()
          }}
        >
          <Button type='link' disabled={row.recoveryStatus === 'recovering' || row.recoveryStatus === 'recovered'}>
            重试
          </Button>
        </Popconfirm>,
      ],
    },
  ], [loadAnalysis, message])

  const buildFilterPayload = (): RetryOrderRecoveryBatchPayload => ({
    statuses: statusFilters.length > 0 ? statusFilters : undefined,
    stages: stageFilters.length > 0 ? stageFilters : undefined,
    exchanges: exchangeFilters.length > 0 ? exchangeFilters : undefined,
    modes: modeFilters.length > 0 ? modeFilters : undefined,
    sources: sourceFilters.length > 0 ? sourceFilters : undefined,
    limit: 100,
  })

  const statusPieOption = useMemo(() => ({
    title: { text: '恢复状态分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: '0', left: 'center' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
        data: analysis?.statusDistribution ?? [],
      },
    ],
  }), [analysis])

  const stageBarOption = useMemo(() => {
    const items = analysis?.stageDistribution ?? []
    return {
      title: { text: '失败阶段分布', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '4%', right: '4%', bottom: '8%', containLabel: true },
      xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
      yAxis: { type: 'category', data: [...items].reverse().map(item => item.name) },
      series: [
        {
          type: 'bar',
          data: [...items].reverse().map(item => item.value),
          itemStyle: { color: '#1677ff', borderRadius: [0, 4, 4, 0] },
        },
      ],
    }
  }, [analysis])

  const stageRecoverySourceOption = useMemo(() => {
    const items = analysis?.stageRecoveryBreakdown ?? []
    return {
      title: { text: '分来源恢复阶段分布', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: '0' },
      grid: { left: '4%', right: '4%', bottom: '12%', containLabel: true },
      xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
      yAxis: { type: 'category', data: [...items].reverse().map(item => item.stage) },
      series: [
        {
          name: '自动恢复成功',
          type: 'bar',
          stack: 'resolved',
          data: [...items].reverse().map(item => item.autoRetryRecoveredCount),
          itemStyle: { color: '#1677ff' },
        },
        {
          name: '人工重试成功',
          type: 'bar',
          stack: 'resolved',
          data: [...items].reverse().map(item => item.manualRetryRecoveredCount),
          itemStyle: { color: '#52c41a' },
        },
        {
          name: '正常链路恢复',
          type: 'bar',
          stack: 'resolved',
          data: [...items].reverse().map(item => item.normalPathRecoveredCount),
          itemStyle: { color: '#faad14' },
        },
      ],
    }
  }, [analysis])

  const trendOption = useMemo(() => ({
    title: { text: '恢复趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增任务', '自动恢复成功', '人工重试成功', '正常链路恢复', '转人工处理'], bottom: '0' },
    grid: { left: '4%', right: '4%', bottom: '12%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: analysis?.dailyTrend.map(item => item.date) ?? [] },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      {
        name: '新增任务',
        type: 'line',
        smooth: true,
        data: analysis?.dailyTrend.map(item => item.createdCount) ?? [],
        lineStyle: { color: '#1677ff', width: 2 },
        itemStyle: { color: '#1677ff' },
      },
      {
        name: '自动恢复成功',
        type: 'line',
        smooth: true,
        data: analysis?.dailyTrend.map(item => item.autoRetryRecoveredCount) ?? [],
        lineStyle: { color: '#52c41a', width: 2 },
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '人工重试成功',
        type: 'line',
        smooth: true,
        data: analysis?.dailyTrend.map(item => item.manualRetryRecoveredCount) ?? [],
        lineStyle: { color: '#13c2c2', width: 2 },
        itemStyle: { color: '#13c2c2' },
      },
      {
        name: '正常链路恢复',
        type: 'line',
        smooth: true,
        data: analysis?.dailyTrend.map(item => item.normalPathRecoveredCount) ?? [],
        lineStyle: { color: '#faad14', width: 2 },
        itemStyle: { color: '#faad14' },
      },
      {
        name: '转人工处理',
        type: 'line',
        smooth: true,
        data: analysis?.dailyTrend.map(item => item.manualReviewCount) ?? [],
        lineStyle: { color: '#ff4d4f', width: 2 },
        itemStyle: { color: '#ff4d4f' },
      },
    ],
  }), [analysis])

  const stageDurationOption = useMemo(() => {
    const items = analysis?.stageDurationBreakdown ?? []
    return {
      title: { text: '恢复耗时分析', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: number) => `${(value / 1000).toFixed(2)} 秒`,
      },
      legend: { bottom: '0' },
      grid: { left: '4%', right: '4%', bottom: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: items.map(item => item.stage),
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => `${(value / 1000).toFixed(1)}s`,
        },
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      series: [
        {
          name: '整体平均耗时',
          type: 'bar',
          data: items.map(item => item.avgRecoveredDurationMs),
          itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '自动恢复平均耗时',
          type: 'bar',
          data: items.map(item => item.avgAutoRetryRecoveredDurationMs),
          itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '人工重试平均耗时',
          type: 'bar',
          data: items.map(item => item.avgManualRetryRecoveredDurationMs),
          itemStyle: { color: '#13c2c2', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '正常链路平均耗时',
          type: 'bar',
          data: items.map(item => item.avgNormalPathRecoveredDurationMs),
          itemStyle: { color: '#faad14', borderRadius: [4, 4, 0, 0] },
        },
      ],
    }
  }, [analysis])

  const stageAttemptOption = useMemo(() => {
    const items = analysis?.stageAttemptBreakdown ?? []
    return {
      title: { text: '恢复尝试次数分析', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: number) => `${value.toFixed(2)} 次`,
      },
      legend: { bottom: '0' },
      grid: { left: '4%', right: '4%', bottom: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: items.map(item => item.stage),
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => `${value.toFixed(1)} 次`,
        },
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      series: [
        {
          name: '整体平均尝试次数',
          type: 'bar',
          data: items.map(item => item.avgRecoveredAttemptCount),
          itemStyle: { color: '#722ed1', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '自动恢复平均尝试次数',
          type: 'bar',
          data: items.map(item => item.avgAutoRetryRecoveredAttemptCount),
          itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '人工重试平均尝试次数',
          type: 'bar',
          data: items.map(item => item.avgManualRetryRecoveredAttemptCount),
          itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '正常链路平均尝试次数',
          type: 'bar',
          data: items.map(item => item.avgNormalPathRecoveredAttemptCount),
          itemStyle: { color: '#faad14', borderRadius: [4, 4, 0, 0] },
        },
      ],
    }
  }, [analysis])

  const sourceSummaryText = useMemo(() => {
    if (!analysis) {
      return '暂无来源分布数据'
    }

    const taskSourceSummary = analysis.sourceDistribution.length > 0
      ? analysis.sourceDistribution.map(item => `${item.name} ${item.value} 条`).join('，')
      : '暂无任务来源数据'
    const recoveryActionSummary = analysis.recoveryActionDistribution.length > 0
      ? analysis.recoveryActionDistribution.map(item => `${item.name} ${item.value} 条`).join('，')
      : '暂无恢复动作来源数据'

    return `任务来源：${taskSourceSummary}。恢复动作：${recoveryActionSummary}`
  }, [analysis])

  const handleBatchRetry = async (payload: RetryOrderRecoveryBatchPayload) => {
    setBatchLoading(true)
    try {
      const result = await tradingApi.retryOrderRecoveryBatch(payload)
      setLastBatchResult(result)
      setSelectedRowKeys([])
      actionRef.current?.reload()
      void loadAnalysis()
      message.success(`批量恢复完成，成功 ${result.successCount} 条，失败 ${result.failedCount} 条，跳过 ${result.skippedCount} 条`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '批量恢复失败')
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <PageContainer subTitle='集中查看恢复任务、批量重试可恢复项，并追踪异常恢复执行结果'>
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        <Card size='small' bordered={false}>
          <Row justify='space-between' align='middle'>
            <Col>
              <Segmented
                value={analysisDays}
                options={[
                  { label: '近 7 天', value: 7 },
                  { label: '近 30 天', value: 30 },
                  { label: '近 90 天', value: 90 },
                ]}
                onChange={value => setAnalysisDays(value as number)}
              />
            </Col>
            <Col>
              <Button icon={<ReloadOutlined />} onClick={() => void loadAnalysis()} loading={analysisLoading}>
                刷新恢复统计
              </Button>
            </Col>
          </Row>
        </Card>

        {analysisLoading && !analysis ? (
          <Card bordered={false}>
            <Skeleton active paragraph={{ rows: 10 }} />
          </Card>
        ) : (
          <>
            <StatisticCard.Group direction='row'>
              <StatisticCard statistic={{ title: '恢复任务总数', value: analysis?.summary.totalRecoveryCount ?? 0 }} />
              <StatisticCard statistic={{ title: '恢复成功率', value: `${(((analysis?.summary.recoverySuccessRate ?? 0) * 100)).toFixed(2)}%` }} />
              <StatisticCard statistic={{ title: '人工介入率', value: `${(((analysis?.summary.manualReviewRate ?? 0) * 100)).toFixed(2)}%` }} />
              <StatisticCard statistic={{ title: '任务平均重试次数', value: (analysis?.summary.avgRetryCount ?? 0).toFixed(2) }} />
            </StatisticCard.Group>
            <StatisticCard.Group direction='row'>
              <StatisticCard statistic={{ title: '自动恢复成功率', value: `${(((analysis?.summary.autoRetryRecoverySuccessRate ?? 0) * 100)).toFixed(2)}%` }} />
              <StatisticCard statistic={{ title: '人工重试成功率', value: `${(((analysis?.summary.manualRetryRecoverySuccessRate ?? 0) * 100)).toFixed(2)}%` }} />
              <StatisticCard statistic={{ title: '自动恢复成功数', value: analysis?.summary.autoRetryRecoveredCount ?? 0 }} />
              <StatisticCard statistic={{ title: '人工重试成功数', value: analysis?.summary.manualRetryRecoveredCount ?? 0 }} />
              <StatisticCard statistic={{ title: '正常链路恢复数', value: analysis?.summary.normalPathRecoveredCount ?? 0 }} />
            </StatisticCard.Group>
            <StatisticCard.Group direction='row'>
              <StatisticCard statistic={{ title: '恢复成功平均尝试次数', value: (analysis?.summary.avgRecoveredAttemptCount ?? 0).toFixed(2) }} />
              <StatisticCard statistic={{ title: '自动恢复平均尝试次数', value: (analysis?.summary.avgAutoRetryRecoveredAttemptCount ?? 0).toFixed(2) }} />
              <StatisticCard statistic={{ title: '人工重试平均尝试次数', value: (analysis?.summary.avgManualRetryRecoveredAttemptCount ?? 0).toFixed(2) }} />
              <StatisticCard statistic={{ title: '正常链路平均尝试次数', value: (analysis?.summary.avgNormalPathRecoveredAttemptCount ?? 0).toFixed(2) }} />
            </StatisticCard.Group>
            <StatisticCard.Group direction='row'>
              <StatisticCard statistic={{ title: '整体平均恢复耗时', value: formatDurationSeconds(analysis?.summary.avgRecoveredDurationMs) }} />
              <StatisticCard statistic={{ title: '自动恢复平均耗时', value: formatDurationSeconds(analysis?.summary.avgAutoRetryRecoveredDurationMs) }} />
              <StatisticCard statistic={{ title: '人工重试平均耗时', value: formatDurationSeconds(analysis?.summary.avgManualRetryRecoveredDurationMs) }} />
              <StatisticCard statistic={{ title: '正常链路平均耗时', value: formatDurationSeconds(analysis?.summary.avgNormalPathRecoveredDurationMs) }} />
            </StatisticCard.Group>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={10}>
                <ProCard title='恢复状态与来源' split='horizontal' bordered>
                  <ProCard bodyStyle={{ height: 260 }}>
                    {analysis && analysis.statusDistribution.length > 0 ? (
                      <ReactECharts option={statusPieOption} style={{ height: '100%', width: '100%' }} />
                    ) : (
                      <Empty description='暂无恢复状态数据' image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </ProCard>
                  <ProCard title='来源摘要' headerBordered bodyStyle={{ minHeight: 96 }}>
                    <Typography.Text type='secondary'>{sourceSummaryText}</Typography.Text>
                  </ProCard>
                </ProCard>
              </Col>
              <Col xs={24} md={14}>
                <ProCard title='失败阶段分布' bordered bodyStyle={{ height: 390 }}>
                  {analysis && analysis.stageDistribution.length > 0 ? (
                    <ReactECharts option={stageBarOption} style={{ height: '100%', width: '100%' }} />
                  ) : (
                    <Empty description='暂无失败阶段数据' image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </ProCard>
              </Col>
            </Row>

            <Card bordered={false}>
              {analysis && analysis.dailyTrend.length > 0 ? (
                <ReactECharts option={trendOption} style={{ height: 320 }} />
              ) : (
                <Empty description='暂无恢复趋势数据' image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            <Card bordered={false}>
              {analysis && analysis.stageRecoveryBreakdown.length > 0 ? (
                <ReactECharts option={stageRecoverySourceOption} style={{ height: 360 }} />
              ) : (
                <Empty description='暂无分来源恢复阶段数据' image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            <Card bordered={false}>
              {analysis && analysis.stageDurationBreakdown.length > 0 ? (
                <ReactECharts option={stageDurationOption} style={{ height: 360 }} />
              ) : (
                <Empty description='暂无恢复耗时数据' image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            <Card bordered={false}>
              {analysis && analysis.stageAttemptBreakdown.length > 0 ? (
                <ReactECharts option={stageAttemptOption} style={{ height: 360 }} />
              ) : (
                <Empty description='暂无恢复尝试次数数据' image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </>
        )}

        <Space wrap>
          <Select
            mode='multiple'
            value={statusFilters}
            onChange={value => setStatusFilters(value as OrderRecoveryStatus[])}
            placeholder='恢复状态'
            style={{ width: 180 }}
            options={Object.entries(recoveryStatusMeta).map(([value, meta]) => ({ label: meta.text, value }))}
          />
          <Select
            mode='multiple'
            value={stageFilters}
            onChange={value => setStageFilters(value as OrderRecoveryFailureStage[])}
            placeholder='失败阶段'
            style={{ width: 180 }}
            options={Object.entries(recoveryStageMeta).map(([value, label]) => ({ label, value }))}
          />
          <Select
            mode='multiple'
            value={exchangeFilters}
            onChange={value => setExchangeFilters(value as ExchangeCode[])}
            placeholder='交易所'
            style={{ width: 140 }}
            options={[
              { label: 'OKX', value: 'okx' },
              { label: 'Binance', value: 'binance' },
            ]}
          />
          <Select
            mode='multiple'
            value={modeFilters}
            onChange={value => setModeFilters(value as TradeAccountType[])}
            placeholder='下单模式'
            style={{ width: 150 }}
            options={[
              { label: '模拟交易', value: 'simulation' },
              { label: '真实交易', value: 'real' },
            ]}
          />
          <Select
            mode='multiple'
            value={sourceFilters}
            onChange={value => setSourceFilters(value as OrderRecoverySource[])}
            placeholder='来源'
            style={{ width: 160 }}
            options={Object.entries(recoverySourceMeta).map(([value, meta]) => ({ label: meta.text, value }))}
          />
        </Space>

        {lastBatchResult ? (
          <Typography.Text type='secondary'>
            最近一次批量恢复结果：共处理 {lastBatchResult.totalCount} 条，成功 {lastBatchResult.successCount} 条，失败 {lastBatchResult.failedCount} 条，跳过 {lastBatchResult.skippedCount} 条。
          </Typography.Text>
        ) : null}

        <ProTable<OrderRecoveryRecord>
          actionRef={actionRef}
          rowKey='id'
          search={false}
          columns={columns}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            preserveSelectedRowKeys: false,
          }}
          request={async params => {
            const pageResult = await tradingApi.getOrderRecoveryPage(
              params.current ?? 1,
              params.pageSize ?? 12,
              statusFilters.length > 0 ? statusFilters : undefined,
              stageFilters.length > 0 ? stageFilters : undefined,
              exchangeFilters.length > 0 ? exchangeFilters : undefined,
              modeFilters.length > 0 ? modeFilters : undefined,
              sourceFilters.length > 0 ? sourceFilters : undefined,
            )

            return {
              data: pageResult.items,
              success: true,
              total: pageResult.total,
            }
          }}
          pagination={{ pageSize: 12 }}
          toolBarRender={() => [
            <Button key='reload' icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>
              刷新
            </Button>,
            <Popconfirm
              key='retry-selected'
              title='批量重试选中恢复任务'
              description='将立即重试当前选中的恢复任务'
              disabled={selectedRowKeys.length === 0 || batchLoading}
              onConfirm={() => void handleBatchRetry({
                ids: selectedRowKeys.map(key => String(key)),
                limit: selectedRowKeys.length,
              })}
            >
              <Button disabled={selectedRowKeys.length === 0 || batchLoading} loading={batchLoading}>
                重试选中项
              </Button>
            </Popconfirm>,
            <Popconfirm
              key='retry-filtered'
              title='批量重试当前筛选结果'
              description='将按当前筛选条件批量重试可恢复任务，最多处理 100 条'
              disabled={!hasBatchFilter(buildFilterPayload()) || batchLoading}
              onConfirm={() => void handleBatchRetry(buildFilterPayload())}
            >
              <Button type='primary' disabled={!hasBatchFilter(buildFilterPayload()) || batchLoading} loading={batchLoading}>
                重试当前筛选
              </Button>
            </Popconfirm>,
          ]}
        />
      </Space>
    </PageContainer>
  )
}
