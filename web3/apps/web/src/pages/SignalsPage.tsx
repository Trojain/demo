import { useEffect, useMemo, useState } from 'react'
import { Button, Space, Tag, Typography } from 'antd'
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import type { SignalStatus, TradingSignal } from '../types'

const statusMeta: Record<SignalStatus, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'processing' },
  converted: { text: '已转换', color: 'success' },
  rejected: { text: '已拒绝', color: 'error' },
  expired: { text: '已过期', color: 'default' },
}

export function SignalsPage() {
  const [signals, setSignals] = useState<TradingSignal[]>([])
  const [loading, setLoading] = useState(false)

  const refreshSignals = async () => {
    setLoading(true)
    try {
      const nextSignals = await tradingApi.getSignals(200)
      setSignals(nextSignals)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshSignals()
  }, [])

  const columns = useMemo<ProColumns<TradingSignal>[]>(
    () => [
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        filters: Object.entries(statusMeta).map(([value, meta]) => ({ text: meta.text, value })),
        onFilter: (value, row) => row.status === value,
        render: (_, row) => <Tag color={statusMeta[row.status].color}>{statusMeta[row.status].text}</Tag>,
      },
      {
        title: '交易所',
        dataIndex: 'exchange',
        width: 96,
        render: (_, row) => <Tag>{row.exchange.toUpperCase()}</Tag>,
      },
      {
        title: '交易对',
        dataIndex: 'symbol',
        width: 130,
      },
      {
        title: '方向',
        dataIndex: 'side',
        width: 90,
        render: (_, row) => <Tag color={row.side === 'buy' ? 'success' : 'warning'}>{row.side === 'buy' ? '买入' : '卖出'}</Tag>,
      },
      {
        title: '类型',
        dataIndex: 'orderType',
        width: 90,
        render: (_, row) => (row.orderType === 'limit' ? '限价' : '市价'),
      },
      {
        title: '市场价',
        dataIndex: 'marketPrice',
        width: 130,
      },
      {
        title: '目标价',
        dataIndex: 'targetPrice',
        width: 130,
      },
      {
        title: '数量或金额',
        dataIndex: 'quoteAmount',
        width: 150,
        render: (_, row) => (row.quoteAmount ? `${row.quoteAmount} USDT` : `${row.baseQuantity ?? '-'} 基础币`),
      },
      {
        title: '模式',
        dataIndex: 'simulationMode',
        width: 90,
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
        width: 150,
        render: (_, row) => <Typography.Text copyable>{row.ruleId}</Typography.Text>,
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 180,
        valueType: 'dateTime',
      },
      {
        title: '转换时间',
        dataIndex: 'convertedAt',
        width: 180,
        valueType: 'dateTime',
        render: (_, row) => row.convertedAt ?? '-',
      },
    ],
    [],
  )

  return (
    <PageContainer>
      <ProTable<TradingSignal>
        rowKey='id'
        search={false}
        loading={loading}
        columns={columns}
        dataSource={signals}
        pagination={{ pageSize: 12 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} onClick={() => void refreshSignals()}>
            刷新
          </Button>,
        ]}
      />
    </PageContainer>
  )
}
