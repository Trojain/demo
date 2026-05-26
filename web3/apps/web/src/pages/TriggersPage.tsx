import { useMemo } from 'react'
import { App as AntApp, Button, Descriptions, Modal, Popconfirm, Space, Tag, Typography } from 'antd'
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { CheckCircleOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons'
import axios from 'axios'
import { Decimal } from 'decimal.js'
import { tradingApi } from '../api/trading'
import { TriggerStatusTag } from '../components/StatusTag'
import { useTradingStore } from '../stores/tradingStore'
import type { MonitorRule, TriggerEvent } from '../types'
import styles from './page.module.scss'

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

function getOrderPreview(trigger: TriggerEvent, rule?: MonitorRule) {
  const targetPrice = new Decimal(trigger.targetPrice)

  if (rule?.baseQuantity) {
    const quantity = new Decimal(rule.baseQuantity)
    return {
      quantityLabel: `${quantity.toFixed()} ${trigger.symbol.replace('-USDT', '')}`,
      estimatedAmountLabel: `${targetPrice.mul(quantity).toFixed()} USDT`,
    }
  }

  if (rule?.quoteAmount) {
    return {
      quantityLabel: `${new Decimal(rule.quoteAmount).toFixed()} USDT`,
      estimatedAmountLabel: `${new Decimal(rule.quoteAmount).toFixed()} USDT`,
    }
  }

  return {
    quantityLabel: '-',
    estimatedAmountLabel: '-',
  }
}

export function TriggersPage() {
  const { message } = AntApp.useApp()
  const triggers = useTradingStore(state => state.triggers)
  const rules = useTradingStore(state => state.rules)
  const loading = useTradingStore(state => state.triggersLoading)
  const refreshTriggers = useTradingStore(state => state.refreshTriggers)
  const refreshOrders = useTradingStore(state => state.refreshOrders)

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      return error.response?.data?.message ?? error.message
    }

    return error instanceof Error ? error.message : '操作失败'
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
        width: 220,
        render: (_, row) => {
          if (row.status !== 'pending') {
            return <Tag>已处理</Tag>
          }

          const relatedRule = rules.find(rule => rule.id === row.ruleId)
          const preview = getOrderPreview(row, relatedRule)

          return (
            <Space>
              <Button
                type='primary'
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '确认模拟下单',
                    width: 560,
                    content: (
                      <Space direction='vertical' size={12} style={{ width: '100%' }}>
                        <Typography.Text type='secondary'>以下为前端预估展示，最终下单计算以后端校验结果为准。</Typography.Text>
                        <Descriptions size='small' column={1} bordered>
                          <Descriptions.Item label='交易对'>{row.symbol}</Descriptions.Item>
                          <Descriptions.Item label='目标价'>{`${formatDecimalText(row.targetPrice)} USDT`}</Descriptions.Item>
                          <Descriptions.Item label='触发价'>{`${formatDecimalText(row.marketPrice)} USDT`}</Descriptions.Item>
                          <Descriptions.Item label='数量'>{preview.quantityLabel}</Descriptions.Item>
                          <Descriptions.Item label='预估金额'>{preview.estimatedAmountLabel}</Descriptions.Item>
                          <Descriptions.Item label='下单方向'>{relatedRule ? (relatedRule.side === 'sell' ? '卖出' : '买入') : '-'}</Descriptions.Item>
                          <Descriptions.Item label='订单类型'>{relatedRule ? (relatedRule.orderType === 'limit' ? '限价' : '市价') : '-'}</Descriptions.Item>
                        </Descriptions>
                        {!relatedRule ? <Typography.Text type='warning'>未在前端缓存中找到关联规则，请刷新规则数据后再确认。</Typography.Text> : null}
                      </Space>
                    ),
                    okText: '确认下单',
                    cancelText: '取消',
                    onOk: async () => {
                      try {
                        await tradingApi.confirmOrder(row.id)
                        message.success('订单已提交')
                        await Promise.all([refreshTriggers(), refreshOrders()])
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
                    await refreshTriggers()
                  } catch (error) {
                    message.error(getErrorMessage(error))
                  }
                }}
              >
                <Button icon={<StopOutlined />}>忽略</Button>
              </Popconfirm>
            </Space>
          )
        },
      },
    ],
    [message, refreshOrders, refreshTriggers, rules],
  )

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
            <Button icon={<ReloadOutlined />} onClick={() => void refreshTriggers()}>
              刷新
            </Button>
          </Space>,
        ]}
      />
    </PageContainer>
  )
}
