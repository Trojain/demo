import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App as AntApp, Button, Drawer, Popconfirm, Segmented, Select, Tabs, Tag, Tooltip, Typography } from 'antd'
import { PageContainer, ProDescriptions, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { Decimal } from 'decimal.js'
import { tradingApi } from '../api/trading'
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
        : 'fills'

  // 交易日报：天数筛选和 Drawer 明细状态
  const [reportDays, setReportDays] = useState<number>(30)
  const [reportExchange, setReportExchange] = useState<ExchangeCode | undefined>(undefined)
  const [reportMode, setReportMode] = useState<'simulation' | 'real' | undefined>(undefined)
  const [reportDrawerRow, setReportDrawerRow] = useState<TradeDailyReport | undefined>(undefined)
  const [reportDrawerFills, setReportDrawerFills] = useState<TradeFill[]>([])
  const [reportDrawerLoading, setReportDrawerLoading] = useState(false)

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
        width: 90,
        render: (_, row) => (
          <span>
            <Tag color='success' style={{ marginRight: 2 }}>{row.filledOrderCount}</Tag>
            <Tag color='error'>{row.failedOrderCount}</Tag>
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
              setReportDrawerFills([])
              setReportDrawerLoading(true)
              // 拉取当日成交明细（最多 500 条），过滤 created_at 日期前缀匹配
              try {
                const allFills = await tradingApi.getTradeFills(reportMode, reportExchange, 500)
                setReportDrawerFills(allFills.filter(f => f.createdAt.startsWith(row.date)))
              } finally {
                setReportDrawerLoading(false)
              }
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
                        rowKey='id'
                        search={false}
                        loading={reportDrawerLoading}
                        dataSource={reportDrawerFills}
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
        ]}
      />
    </PageContainer>
  )
}
