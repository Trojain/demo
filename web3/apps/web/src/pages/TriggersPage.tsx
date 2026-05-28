import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, App as AntApp, Button, Modal, Popconfirm, Space, Spin, Tag, Typography } from 'antd'
import { PageContainer, ProDescriptions, ProTable, type ActionType, type ProColumns, type ProDescriptionsItemProps } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import axios from 'axios'
import { Decimal } from 'decimal.js'
import { tradingApi } from '../api/trading'
import { TriggerStatusTag } from '../components/StatusTag'
import type { OrderPreview, OrderPreviewCheckItem, TriggerEvent } from '../types'
import { toTableRequestResult } from '../utils/proTable'

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
  const actionRef = useRef<ActionType | undefined>(undefined)
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
      actionRef.current?.reload()
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
        dataIndex: 'operate',
        valueType: 'option',
        fixed: 'right',
        width: 'auto',
        render: (_, row) => {
          const deleteAction = (
            <Popconfirm
              key='delete'
              title='删除触发事件'
              description='将直接从数据库删除该触发事件记录，不影响已生成的订单记录'
              onConfirm={async () => {
                try {
                  await tradingApi.deleteTrigger(row.id)
                  message.success('触发事件已删除')
                  actionRef.current?.reload()
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
            return [<Tag key='processed'>已处理</Tag>, deleteAction]
          }

          return [
            <Button
              key='confirm'
              type='link'
              onClick={() => {
                setSelectedTrigger(row)
                setPreviewOpen(true)
              }}
            >
              确认
            </Button>,
            <Popconfirm
              key='ignore'
              title='忽略触发事件'
              description='忽略后不会生成订单，适合处理重复或不需要下单的触发'
              onConfirm={async () => {
                try {
                  await tradingApi.ignoreTrigger(row.id)
                  message.success('触发事件已忽略')
                  actionRef.current?.reload()
                } catch (error) {
                  message.error(getErrorMessage(error))
                }
              }}
            >
              <Button type='link'>忽略</Button>
            </Popconfirm>,
            deleteAction,
          ]
        },
      },
    ],
    [message],
  )

  const previewColumns = useMemo<ProDescriptionsItemProps<OrderPreview>[]>(
    () => [
      {
        title: '交易对',
        dataIndex: 'symbol',
      },
      {
        title: '目标价',
        dataIndex: 'targetPrice',
        render: (_, row) => `${formatDecimalText(row.targetPrice)} USDT`,
      },
      {
        title: '触发价',
        dataIndex: 'triggerPrice',
        render: (_, row) => `${formatDecimalText(row.triggerPrice)} USDT`,
      },
      {
        title: '执行参考价',
        dataIndex: 'executionPrice',
        render: (_, row) => `${formatDecimalText(row.executionPrice)} USDT`,
      },
      {
        title: '数量',
        dataIndex: 'baseQuantity',
        render: (_, row) => getQuantityLabel(row),
      },
      {
        title: '预估金额',
        dataIndex: 'estimatedQuoteAmount',
        render: (_, row) => `${formatDecimalText(row.estimatedQuoteAmount)} USDT`,
      },
      {
        title: '最大滑点',
        dataIndex: 'maxSlippagePercent',
        render: (_, row) => `${formatDecimalText(row.maxSlippagePercent)}%`,
      },
      {
        title: '下单方向',
        dataIndex: 'side',
        render: (_, row) => (row.side === 'sell' ? '卖出' : '买入'),
      },
      {
        title: '订单类型',
        dataIndex: 'orderType',
        render: (_, row) => (row.orderType === 'limit' ? '限价' : '市价'),
      },
      {
        title: '交易模式',
        dataIndex: 'simulationMode',
        render: (_, row) => (row.simulationMode ? '模拟' : '真实'),
      },
      {
        title: '交易规则',
        dataIndex: 'tradingRulePassed',
        render: (_, row) => (
          <Space direction='vertical' size={4}>
            <Tag color={row.tradingRulePassed ? 'success' : 'error'}>{row.tradingRulePassed ? '通过' : '未通过'}</Tag>
            {renderCheckItems(row.tradingRuleItems)}
          </Space>
        ),
      },
      {
        title: '风控预览',
        dataIndex: 'riskPassed',
        render: (_, row) => (
          <Space direction='vertical' size={4}>
            <Tag color={row.riskPassed ? 'success' : 'error'}>{row.riskPassed ? '通过' : '未通过'}</Tag>
            {renderCheckItems(row.riskItems)}
          </Space>
        ),
      },
    ],
    [],
  )

  return (
    <PageContainer subTitle='人工确认或忽略已通过风控的待执行触发'>
      <ProTable<TriggerEvent>
        actionRef={actionRef}
        rowKey='id'
        search={false}
        columns={columns}
        request={async () => toTableRequestResult(await tradingApi.getTriggers())}
        onReset={() => actionRef.current?.reload()}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>
            刷新
          </Button>,
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
                <ProDescriptions<OrderPreview> size='small' column={1} bordered dataSource={orderPreview} columns={previewColumns} />
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
