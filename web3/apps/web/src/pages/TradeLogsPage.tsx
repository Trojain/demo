import { useMemo, useRef } from 'react'
import { Button, Tag, Tooltip, Typography } from 'antd'
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import { useProfitDisplay } from '../hooks/useProfitDisplay'
import type { TradeAccountType, TradeFill, TradeOperationLog } from '../types'
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

export function TradeLogsPage() {
  const fillActionRef = useRef<ActionType | undefined>(undefined)
  const logActionRef = useRef<ActionType | undefined>(undefined)
  const profitDisplay = useProfitDisplay()

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

  return (
    <PageContainer subTitle='查看模拟和真实交易共用的成交记录与操作日志'>
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
    </PageContainer>
  )
}
