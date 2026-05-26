import { Button, Tag } from 'antd'
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { useTradingStore } from '../stores/tradingStore'
import type { OrderRecord } from '../types'
import styles from './page.module.scss'

export function OrdersPage() {
  const orders = useTradingStore(state => state.orders)
  const loading = useTradingStore(state => state.loading)
  const refreshAll = useTradingStore(state => state.refreshAll)

  const columns: ProColumns<OrderRecord>[] = [
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
      render: (_, row) => (row.orderType === 'market' ? '市价' : '限价'),
    },
    {
      title: '数量或金额',
      dataIndex: 'quoteAmount',
      render: (_, row) => (row.quoteAmount ? `${row.quoteAmount} 计价币` : `${row.baseQuantity ?? '-'} 基础币`),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_, row) => <Tag color={row.status === 'submitted' ? 'processing' : 'default'}>{row.status}</Tag>,
    },
    {
      title: '模式',
      dataIndex: 'simulationMode',
      width: 90,
      render: (_, row) => <Tag color={row.simulationMode ? 'processing' : 'error'}>{row.simulationMode ? '模拟' : '真实'}</Tag>,
    },
    {
      title: '订单号',
      dataIndex: 'exchangeOrderId',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
  ]

  return (
    <PageContainer>
      <ProTable<OrderRecord>
        rowKey='id'
        search={false}
        loading={loading}
        columns={columns}
        dataSource={orders}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
            刷新
          </Button>,
        ]}
      />
    </PageContainer>
  )
}
