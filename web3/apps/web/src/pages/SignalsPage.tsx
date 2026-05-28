import { useMemo, useRef } from 'react'
import { App as AntApp, Button, Popconfirm, Tag, Typography } from 'antd'
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import type { SignalStatus, TradingSignal } from '../types'
import { toTableRequestResult } from '../utils/proTable'

const statusMeta: Record<SignalStatus, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'processing' },
  converted: { text: '已转换', color: 'success' },
  rejected: { text: '已拒绝', color: 'error' },
  expired: { text: '已过期', color: 'default' },
}

export function SignalsPage() {
  const { message } = AntApp.useApp()
  const actionRef = useRef<ActionType | undefined>(undefined)

  const columns = useMemo<ProColumns<TradingSignal>[]>(
    () => [
      {
        title: '状态',
        dataIndex: 'status',
        filters: Object.entries(statusMeta).map(([value, meta]) => ({ text: meta.text, value })),
        onFilter: (value, row) => row.status === value,
        render: (_, row) => <Tag color={statusMeta[row.status].color}>{statusMeta[row.status].text}</Tag>,
      },
      {
        title: '交易所',
        dataIndex: 'exchange',
        render: (_, row) => <Tag>{row.exchange.toUpperCase()}</Tag>,
      },
      {
        title: '交易对',
        dataIndex: 'symbol',
      },
      {
        title: '方向',
        dataIndex: 'side',
        render: (_, row) => <Tag color={row.side === 'buy' ? 'success' : 'warning'}>{row.side === 'buy' ? '买入' : '卖出'}</Tag>,
      },
      {
        title: '类型',
        dataIndex: 'orderType',
        render: (_, row) => (row.orderType === 'limit' ? '限价' : '市价'),
      },
      {
        title: '市场价',
        dataIndex: 'marketPrice',
      },
      {
        title: '目标价',
        dataIndex: 'targetPrice',
      },
      {
        title: '数量或金额',
        dataIndex: 'quoteAmount',
        render: (_, row) => (row.quoteAmount ? `${row.quoteAmount} USDT` : `${row.baseQuantity ?? '-'} 基础币`),
      },
      {
        title: '模式',
        dataIndex: 'simulationMode',
        render: (_, row) => <Tag color={row.simulationMode ? 'processing' : 'error'}>{row.simulationMode ? '模拟' : '真实'}</Tag>,
      },
      {
        title: '原因',
        dataIndex: 'reason',
        ellipsis: true,
      },
      {
        title: '关联规则',
        dataIndex: 'ruleId',
        render: (_, row) => <Typography.Text copyable>{row.ruleId}</Typography.Text>,
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        valueType: 'dateTime',
      },
      {
        title: '转换时间',
        dataIndex: 'convertedAt',
        valueType: 'dateTime',
        render: (_, row) => row.convertedAt ?? '-',
      },
      {
        title: '操作',
        dataIndex: 'operate',
        valueType: 'option',
        fixed: 'right',
        width: 'auto',
        render: (_, row) => [
          <Popconfirm
            key='delete'
            title='删除交易信号'
            description='将直接从数据库删除该交易信号记录，不影响已生成的触发事件'
            onConfirm={async () => {
              await tradingApi.deleteSignal(row.id)
              message.success('交易信号已删除')
              actionRef.current?.reload()
            }}
          >
            <Button danger type='link'>
              删除
            </Button>
          </Popconfirm>,
        ],
      },
    ],
    [message],
  )

  return (
    <PageContainer subTitle='展示规则命中后生成的交易意图和转换结果'>
      <ProTable<TradingSignal>
        actionRef={actionRef}
        rowKey='id'
        search={false}
        columns={columns}
        request={async () => toTableRequestResult(await tradingApi.getSignals(200))}
        onReset={() => actionRef.current?.reload()}
        pagination={{ pageSize: 12 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>
            刷新
          </Button>,
        ]}
      />
    </PageContainer>
  )
}
