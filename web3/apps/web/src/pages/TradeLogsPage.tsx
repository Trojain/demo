import { useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Tabs, Tag, Tooltip, Typography } from 'antd'
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import { useProfitDisplay } from '../hooks/useProfitDisplay'
import type { AuditLog, TradeAccountType, TradeFill, TradeOperationLog } from '../types'
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

export function TradeLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const fillActionRef = useRef<ActionType | undefined>(undefined)
  const logActionRef = useRef<ActionType | undefined>(undefined)
  const auditActionRef = useRef<ActionType | undefined>(undefined)
  const profitDisplay = useProfitDisplay()
  const activeTab = searchParams.get('tab') === 'logs'
    ? 'logs'
    : searchParams.get('tab') === 'audits'
      ? 'audits'
      : 'fills'

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
                request={async () => toTableRequestResult(await tradingApi.getAuditLogs(200, ['order.submitted', 'order.failed', 'trigger.failed', 'trigger.confirmed']))}
                pagination={{ pageSize: 8 }}
                toolBarRender={() => [
                  <Button key='reload' icon={<ReloadOutlined />} onClick={() => auditActionRef.current?.reload()}>
                    刷新审计
                  </Button>,
                ]}
              />
            ),
          },
        ]}
      />
    </PageContainer>
  )
}
