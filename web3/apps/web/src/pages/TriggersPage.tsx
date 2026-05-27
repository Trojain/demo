import { useEffect, useMemo, useState } from 'react'
import { Alert, App as AntApp, Button, Descriptions, Modal, Popconfirm, Space, Spin, Tag, Typography } from 'antd'
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { CheckCircleOutlined, DeleteOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons'
import axios from 'axios'
import { Decimal } from 'decimal.js'
import { tradingApi } from '../api/trading'
import { TriggerStatusTag } from '../components/StatusTag'
import { useTradingStore } from '../stores/tradingStore'
import type { OrderPreview, OrderPreviewCheckItem, TriggerEvent } from '../types'

function formatDecimalText(value?: string) {
  if (!value) {
    return '-'
  }

  try {
    return new Decimal(value).toFixed()
  } catch {
    return value
  }
}

function getQuantityLabel(preview?: OrderPreview) {
  if (!preview) {
    return '-'
  }

  if (preview.baseQuantity) {
    return `${formatDecimalText(preview.baseQuantity)} ${preview.symbol.replace('-USDT', '')}`
  }

  if (preview.quoteAmount) {
    return `${formatDecimalText(preview.quoteAmount)} USDT`
  }

  return '-'
}

function renderCheckItems(items: OrderPreviewCheckItem[]) {
  return (
    <Space direction='vertical' size={4}>
      {items.map(item => (
        <Typography.Text key={item.code} type={item.passed ? 'success' : 'danger'}>
          {item.passed ? '通过' : '拒绝'}：{item.message}
        </Typography.Text>
      ))}
    </Space>
  )
}

export function TriggersPage() {
  const { message } = AntApp.useApp()
  const triggers = useTradingStore(state => state.triggers)
  const loading = useTradingStore(state => state.triggersLoading)
  const refreshTriggers = useTradingStore(state => state.refreshTriggers)
  const refreshOrders = useTradingStore(state => state.refreshOrders)
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerEvent>()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [orderPreview, setOrderPreview] = useState<OrderPreview>()
  const [previewError, setPreviewError] = useState('')

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      return error.response?.data?.message ?? error.message
    }

    return error instanceof Error ? error.message : '操作失败'
  }

  useEffect(() => {
    if (!previewOpen || !selectedTrigger) {
      return
    }

    let ignored = false
    setPreviewLoading(true)
    setPreviewError('')
    setOrderPreview(undefined)

    void tradingApi
      .previewOrder(selectedTrigger.id)
      .then(preview => {
        if (!ignored) {
          setOrderPreview(preview)
        }
      })
      .catch(error => {
        if (!ignored) {
          setPreviewError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (!ignored) {
          setPreviewLoading(false)
        }
      })

    return () => {
      ignored = true
    }
  }, [previewOpen, selectedTrigger])

  const closePreview = () => {
    setPreviewOpen(false)
    setSelectedTrigger(undefined)
    setOrderPreview(undefined)
    setPreviewError('')
  }

  const confirmSelectedOrder = async () => {
    if (!selectedTrigger) {
      return
    }

    try {
      await tradingApi.confirmOrder(selectedTrigger.id)
      message.success('订单已提交')
      closePreview()
      await Promise.all([refreshTriggers(), refreshOrders()])
    } catch (error) {
      message.error(getErrorMessage(error))
      throw error
    }
  }

  const columns = useMemo<ProColumns<TriggerEvent>[]>(
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
        width: 300,
        render: (_, row) => {
          const deleteAction = (
            <Popconfirm
              title='删除触发事件'
              description='将直接从数据库删除该触发事件记录，不影响已生成的订单记录'
              onConfirm={async () => {
                try {
                  await tradingApi.deleteTrigger(row.id)
                  message.success('触发事件已删除')
                  await refreshTriggers()
                } catch (error) {
                  message.error(getErrorMessage(error))
                }
              }}
            >
              <Button danger type='link'>
                删除
              </Button>
            </Popconfirm>
          )

          if (row.status !== 'pending') {
            return (
              <Space>
                <Tag>已处理</Tag>
                {deleteAction}
              </Space>
            )
          }

          return (
            <Space>
              <Button
                type='link'
                onClick={() => {
                  setSelectedTrigger(row)
                  setPreviewOpen(true)
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
                    await refreshTriggers()
                  } catch (error) {
                    message.error(getErrorMessage(error))
                  }
                }}
              >
                <Button type='link'>忽略</Button>
              </Popconfirm>
              {deleteAction}
            </Space>
          )
        },
      },
    ],
    [message, refreshTriggers],
  )

  return (
    <PageContainer subTitle='人工确认或忽略已通过风控的待执行触发'>
      <ProTable<TriggerEvent>
        rowKey='id'
        search={false}
        loading={loading}
        columns={columns}
        dataSource={triggers}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Space key='toolbar'>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshTriggers()}>
              刷新
            </Button>
          </Space>,
        ]}
      />
      <Modal
        title='确认下单'
        open={previewOpen}
        width={680}
        okText='确认下单'
        cancelText='取消'
        onCancel={closePreview}
        onOk={confirmSelectedOrder}
        okButtonProps={{
          disabled: !orderPreview || !orderPreview.tradingRulePassed || !orderPreview.riskPassed,
        }}
      >
        <Spin spinning={previewLoading}>
          <Space direction='vertical' size={12} style={{ width: '100%' }}>
            <Typography.Text type='secondary'>以下为后端预览结果，确认后仍以后端最终下单校验为准。</Typography.Text>
            {previewError ? <Alert type='error' message={previewError} showIcon /> : null}
            {orderPreview ? (
              <>
                <Descriptions size='small' column={1} bordered>
                  <Descriptions.Item label='交易对'>{orderPreview.symbol}</Descriptions.Item>
                  <Descriptions.Item label='目标价'>{`${formatDecimalText(orderPreview.targetPrice)} USDT`}</Descriptions.Item>
                  <Descriptions.Item label='触发价'>{`${formatDecimalText(orderPreview.triggerPrice)} USDT`}</Descriptions.Item>
                  <Descriptions.Item label='执行参考价'>{`${formatDecimalText(orderPreview.executionPrice)} USDT`}</Descriptions.Item>
                  <Descriptions.Item label='数量'>{getQuantityLabel(orderPreview)}</Descriptions.Item>
                  <Descriptions.Item label='预估金额'>{`${formatDecimalText(orderPreview.estimatedQuoteAmount)} USDT`}</Descriptions.Item>
                  <Descriptions.Item label='最大滑点'>{`${formatDecimalText(orderPreview.maxSlippagePercent)}%`}</Descriptions.Item>
                  <Descriptions.Item label='下单方向'>{orderPreview.side === 'sell' ? '卖出' : '买入'}</Descriptions.Item>
                  <Descriptions.Item label='订单类型'>{orderPreview.orderType === 'limit' ? '限价' : '市价'}</Descriptions.Item>
                  <Descriptions.Item label='交易模式'>{orderPreview.simulationMode ? '模拟' : '真实'}</Descriptions.Item>
                  <Descriptions.Item label='交易规则'>
                    <Tag color={orderPreview.tradingRulePassed ? 'success' : 'error'}>{orderPreview.tradingRulePassed ? '通过' : '未通过'}</Tag>
                    {renderCheckItems(orderPreview.tradingRuleItems)}
                  </Descriptions.Item>
                  <Descriptions.Item label='风控预览'>
                    <Tag color={orderPreview.riskPassed ? 'success' : 'error'}>{orderPreview.riskPassed ? '通过' : '未通过'}</Tag>
                    {renderCheckItems(orderPreview.riskItems)}
                  </Descriptions.Item>
                </Descriptions>
                {!orderPreview.tradingRulePassed || !orderPreview.riskPassed ? (
                  <Alert type='warning' message='交易规则或风控未通过，暂不能确认下单。' showIcon />
                ) : null}
              </>
            ) : null}
          </Space>
        </Spin>
      </Modal>
    </PageContainer>
  )
}
