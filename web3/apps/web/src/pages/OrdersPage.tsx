import { useMemo } from 'react'
import { App as AntApp, Button, Popconfirm, Space, Tag } from 'antd'
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import { useTradingStore } from '../stores/tradingStore'
import type { OrderRecord } from '../types'

export function OrdersPage() {
  const { message } = AntApp.useApp()
  const orders = useTradingStore(state => state.orders)
  const loading = useTradingStore(state => state.ordersLoading)
  const refreshOrders = useTradingStore(state => state.refreshOrders)

  const columns = useMemo<ProColumns<OrderRecord>[]>(
    () => [
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
      {
        title: '操作',
        valueType: 'option',
        width: 100,
        render: (_, row) => (
          <Space>
            <Popconfirm
              title='删除订单记录'
              description='将直接从数据库删除该订单记录，不会撤销交易所订单'
              onConfirm={async () => {
                await tradingApi.deleteOrder(row.id)
                message.success('订单记录已删除')
                await refreshOrders()
              }}
            >
              <Button danger type='link'>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [message, refreshOrders],
  )

  return (
    <PageContainer subTitle='查看确认后生成的模拟或真实订单记录'>
      <ProTable<OrderRecord>
        rowKey='id'
        search={false}
        loading={loading}
        columns={columns}
        dataSource={orders}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} onClick={() => void refreshOrders()}>
            刷新
          </Button>,
        ]}
      />
    </PageContainer>
  )
}
