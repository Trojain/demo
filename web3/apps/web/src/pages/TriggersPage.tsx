import { App as AntApp, Button, Modal, Popconfirm, Space, Tag } from 'antd'
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { CheckCircleOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons'
import axios from 'axios'
import { tradingApi } from '../api/trading'
import { TriggerStatusTag } from '../components/StatusTag'
import { useTradingStore } from '../stores/tradingStore'
import type { TriggerEvent } from '../types'
import styles from './page.module.scss'

export function TriggersPage() {
  const { message } = AntApp.useApp()
  const triggers = useTradingStore(state => state.triggers)
  const loading = useTradingStore(state => state.loading)
  const refreshAll = useTradingStore(state => state.refreshAll)

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      return error.response?.data?.message ?? error.message
    }

    return error instanceof Error ? error.message : '操作失败'
  }

  const columns: ProColumns<TriggerEvent>[] = [
    {
      title: '交易所',
      dataIndex: 'exchange',
      width: 96,
      render: (_, row) => <Tag>{row.exchange.toUpperCase()}</Tag>,
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      width: 140,
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
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_, row) => <TriggerStatusTag status={row.status} />,
    },
    {
      title: '触发时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      render: (_, row) =>
        row.status === 'pending' ? (
          <Space>
            <Button
              type='primary'
              icon={<CheckCircleOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认模拟下单',
                  content: `将按规则提交 ${row.symbol} 订单。第一版默认模拟下单，会写入订单记录。`,
                  okText: '确认下单',
                  cancelText: '取消',
                  onOk: async () => {
                    try {
                      await tradingApi.confirmOrder(row.id)
                      message.success('订单已提交')
                      await refreshAll()
                    } catch (error) {
                      message.error(getErrorMessage(error))
                      throw error
                    }
                  },
                })
              }}
            >
              确认
            </Button>
            <Popconfirm
              title='忽略触发事件'
              description='忽略后不会生成订单，适合处理重复或不需要下单的触发'
              onConfirm={async () => {
                try {
                  await tradingApi.ignoreTrigger(row.id)
                  message.success('触发事件已忽略')
                  await refreshAll()
                } catch (error) {
                  message.error(getErrorMessage(error))
                }
              }}
            >
              <Button icon={<StopOutlined />}>忽略</Button>
            </Popconfirm>
          </Space>
        ) : (
          <Tag>已处理</Tag>
        ),
    },
  ]

  return (
    <PageContainer>
      <ProTable<TriggerEvent>
        rowKey='id'
        search={false}
        loading={loading}
        columns={columns}
        dataSource={triggers}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Space key='toolbar'>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
              刷新
            </Button>
          </Space>,
        ]}
      />
    </PageContainer>
  )
}
