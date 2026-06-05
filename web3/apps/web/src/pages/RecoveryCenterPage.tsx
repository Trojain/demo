import { useEffect, useMemo, useRef, useState, type Key } from 'react'
import { App as AntApp, Button, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import {
  tradingApi,
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [statusFilters, setStatusFilters] = useState<OrderRecoveryStatus[]>([])
  const [stageFilters, setStageFilters] = useState<OrderRecoveryFailureStage[]>([])
  const [exchangeFilters, setExchangeFilters] = useState<ExchangeCode[]>([])
  const [modeFilters, setModeFilters] = useState<TradeAccountType[]>([])
  const [sourceFilters, setSourceFilters] = useState<OrderRecoverySource[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [lastBatchResult, setLastBatchResult] = useState<RetryOrderRecoveryBatchResult>()

  useEffect(() => {
    setSelectedRowKeys([])
    setLastBatchResult(undefined)
    actionRef.current?.reloadAndRest?.()
  }, [statusFilters, stageFilters, exchangeFilters, modeFilters, sourceFilters])

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
          }}
        >
          <Button type='link' disabled={row.recoveryStatus === 'recovering' || row.recoveryStatus === 'recovered'}>
            重试
          </Button>
        </Popconfirm>,
      ],
    },
  ], [message])

  const buildFilterPayload = (): RetryOrderRecoveryBatchPayload => ({
    statuses: statusFilters.length > 0 ? statusFilters : undefined,
    stages: stageFilters.length > 0 ? stageFilters : undefined,
    exchanges: exchangeFilters.length > 0 ? exchangeFilters : undefined,
    modes: modeFilters.length > 0 ? modeFilters : undefined,
    sources: sourceFilters.length > 0 ? sourceFilters : undefined,
    limit: 100,
  })

  const handleBatchRetry = async (payload: RetryOrderRecoveryBatchPayload) => {
    setBatchLoading(true)
    try {
      const result = await tradingApi.retryOrderRecoveryBatch(payload)
      setLastBatchResult(result)
      setSelectedRowKeys([])
      actionRef.current?.reload()
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
