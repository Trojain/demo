import { useMemo, useRef } from 'react'
import { App as AntApp, Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd'
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import type { RiskCheck, RiskCheckStatus } from '../types'
import { toTableRequestResult } from '../utils/proTable'

const statusMeta: Record<RiskCheckStatus, { text: string; color: string }> = {
  passed: { text: '通过', color: 'success' },
  rejected: { text: '拒绝', color: 'error' },
}

function renderItems(itemsJson: string) {
  try {
    return JSON.stringify(JSON.parse(itemsJson), null, 2)
  } catch {
    return itemsJson
  }
}

export function RiskChecksPage() {
  const { message } = AntApp.useApp()
  const actionRef = useRef<ActionType | undefined>(undefined)

  const columns = useMemo<ProColumns<RiskCheck>[]>(
    () => [
      {
        title: '状态',
        dataIndex: 'status',
        width: 96,
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
        title: '计价金额',
        dataIndex: 'quoteExposure',
        width: 130,
        render: (_, row) => `${row.quoteExposure} USDT`,
      },
      {
        title: '市场价',
        dataIndex: 'marketPrice',
        width: 130,
      },
      {
        title: '原因',
        dataIndex: 'reason',
        ellipsis: true,
      },
      {
        title: '关联',
        dataIndex: 'signalId',
        width: 240,
        render: (_, row) => (
          <Space size={4} wrap>
            <Tag>规则 {row.ruleId}</Tag>
            <Tag>信号 {row.signalId}</Tag>
          </Space>
        ),
      },
      {
        title: '明细',
        dataIndex: 'itemsJson',
        width: 90,
        render: (_, row) => (
          <Tooltip title={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{renderItems(row.itemsJson)}</pre>}>
            <Typography.Link>查看</Typography.Link>
          </Tooltip>
        ),
      },
      {
        title: '时间',
        dataIndex: 'createdAt',
        width: 180,
        valueType: 'dateTime',
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
            title='删除风控检查'
            description='将直接从数据库删除该风控检查记录，不影响关联信号'
            onConfirm={async () => {
              await tradingApi.deleteRiskCheck(row.id)
              message.success('风控检查已删除')
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
    <PageContainer subTitle='展示信号进入触发确认前的风控结论和明细'>
      <ProTable<RiskCheck>
        actionRef={actionRef}
        rowKey='id'
        search={false}
        columns={columns}
        request={async () => toTableRequestResult(await tradingApi.getRiskChecks(200))}
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
