import { useEffect, useMemo, useState } from 'react'
import { Button, Space, Tag, Tooltip, Typography } from 'antd'
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import type { RiskCheck, RiskCheckStatus } from '../types'

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
  const [riskChecks, setRiskChecks] = useState<RiskCheck[]>([])
  const [loading, setLoading] = useState(false)

  const refreshRiskChecks = async () => {
    setLoading(true)
    try {
      const checks = await tradingApi.getRiskChecks(200)
      setRiskChecks(checks)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshRiskChecks()
  }, [])

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
    ],
    [],
  )

  return (
    <PageContainer>
      <ProTable<RiskCheck>
        rowKey='id'
        search={false}
        loading={loading}
        columns={columns}
        dataSource={riskChecks}
        pagination={{ pageSize: 12 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} onClick={() => void refreshRiskChecks()}>
            刷新
          </Button>,
        ]}
      />
    </PageContainer>
  )
}
