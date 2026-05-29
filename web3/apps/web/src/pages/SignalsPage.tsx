import { useMemo, useRef, useState } from 'react'
import { App as AntApp, Button, Drawer, Empty, Popconfirm, Space, Tag, Timeline, Typography } from 'antd'
import { PageContainer, ProDescriptions, ProTable, type ActionType, type ProColumns, type ProDescriptionsItemProps } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import type { RiskCheck, RiskCheckStatus, SignalStatus, TradingSignal } from '../types'
import { toTableRequestResult } from '../utils/proTable'

const statusMeta: Record<SignalStatus, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'processing' },
  converted: { text: '已转换', color: 'success' },
  rejected: { text: '已拒绝', color: 'error' },
  expired: { text: '已过期', color: 'default' },
}

const riskStatusMeta: Record<RiskCheckStatus, { text: string; color: string }> = {
  passed: { text: '通过', color: 'success' },
  rejected: { text: '拒绝', color: 'error' },
}

interface RiskItem {
  /** 风控项编码 */
  code: string
  /** 是否通过 */
  passed: boolean
  /** 风控项说明 */
  message: string
}

function parseRiskItems(itemsJson?: string): RiskItem[] {
  if (!itemsJson) {
    return []
  }

  try {
    const parsed = JSON.parse(itemsJson) as RiskItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function SignalsPage() {
  const { message } = AntApp.useApp()
  const actionRef = useRef<ActionType | undefined>(undefined)
  const [riskDrawerOpen, setRiskDrawerOpen] = useState(false)
  const [selectedSignal, setSelectedSignal] = useState<TradingSignal>()
  const [selectedRiskCheck, setSelectedRiskCheck] = useState<RiskCheck>()
  const [riskLoading, setRiskLoading] = useState(false)

  const openRiskDrawer = async (signal: TradingSignal) => {
    setSelectedSignal(signal)
    setSelectedRiskCheck(undefined)
    setRiskDrawerOpen(true)
    setRiskLoading(true)
    try {
      const riskChecks = await tradingApi.getRiskChecks(500)
      const matched = riskChecks.find(item => item.signalId === signal.id)
      setSelectedRiskCheck(matched)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '风控检查加载失败')
    } finally {
      setRiskLoading(false)
    }
  }

  const riskDescriptionColumns = useMemo<ProDescriptionsItemProps<RiskCheck>[]>(
    () => [
      {
        title: '风控结论',
        dataIndex: 'status',
        render: (_, row) => <Tag color={riskStatusMeta[row.status].color}>{riskStatusMeta[row.status].text}</Tag>,
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
        title: '计价金额',
        dataIndex: 'quoteExposure',
        render: (_, row) => `${row.quoteExposure} USDT`,
      },
      {
        title: '市场价',
        dataIndex: 'marketPrice',
      },
      {
        title: '关联信号',
        dataIndex: 'signalId',
        render: (_, row) => <Typography.Text copyable>{row.signalId}</Typography.Text>,
      },
      {
        title: '关联规则',
        dataIndex: 'ruleId',
        render: (_, row) => <Typography.Text copyable>{row.ruleId}</Typography.Text>,
      },
      {
        title: '检查时间',
        dataIndex: 'createdAt',
        valueType: 'dateTime',
      },
      {
        title: '结论说明',
        dataIndex: 'reason',
        span: 2,
      },
    ],
    [],
  )

  const columns = useMemo<ProColumns<TradingSignal>[]>(
    () => [
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
        title: '状态',
        dataIndex: 'status',
        filters: Object.entries(statusMeta).map(([value, meta]) => ({ text: meta.text, value })),
        onFilter: (value, row) => row.status === value,
        render: (_, row) => <Tag color={statusMeta[row.status].color}>{statusMeta[row.status].text}</Tag>,
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
        render: (_, row) => [
          <Button key='risk' type='link' onClick={() => openRiskDrawer(row)}>
            风控检查
          </Button>,
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

      <Drawer
        title='风控检查'
        width={920}
        open={riskDrawerOpen}
        onClose={() => {
          setRiskDrawerOpen(false)
          setSelectedSignal(undefined)
          setSelectedRiskCheck(undefined)
        }}
      >
        {selectedSignal ? (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            {selectedRiskCheck ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 0.9fr)', gap: 24, alignItems: 'start' }}>
                <ProDescriptions<RiskCheck> column={1} bordered loading={riskLoading} dataSource={selectedRiskCheck} columns={riskDescriptionColumns} />
                <div style={{ minWidth: 0 }}>
                  <Typography.Text strong>风控明细</Typography.Text>
                  <Timeline
                    style={{ marginTop: 12 }}
                    items={parseRiskItems(selectedRiskCheck.itemsJson).map(item => ({
                      color: item.passed ? 'green' : 'red',
                      children: (
                        <Space direction='vertical' size={2}>
                          <Tag color={item.passed ? 'success' : 'error'}>{item.passed ? '通过' : '拒绝'}</Tag>
                          <Typography.Text>{item.message}</Typography.Text>
                          <Typography.Text type='secondary'>{item.code}</Typography.Text>
                        </Space>
                      ),
                    }))}
                  />
                </div>
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={riskLoading ? '风控检查加载中' : '暂无关联风控检查'} />
            )}
          </Space>
        ) : null}
      </Drawer>
    </PageContainer>
  )
}
