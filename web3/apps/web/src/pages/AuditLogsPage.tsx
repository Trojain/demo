import { useEffect, useMemo, useState } from 'react'
import { Button, Space, Tag, Tooltip, Typography } from 'antd'
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import type { AuditLog, AuditLogAction, AuditLogLevel } from '../types'

const levelMeta: Record<AuditLogLevel, { text: string; color: string }> = {
  info: { text: '信息', color: 'processing' },
  warning: { text: '警告', color: 'warning' },
  error: { text: '错误', color: 'error' },
}

const actionMeta: Record<AuditLogAction, string> = {
  'signal.created': '信号生成',
  'signal.converted': '信号转换',
  'signal.duplicated': '信号重复',
  'risk.passed': '风控通过',
  'risk.rejected': '风控拒绝',
  'trigger.created': '触发生成',
  'trigger.confirmed': '触发确认',
  'trigger.ignored': '触发忽略',
  'order.submitted': '订单提交',
  'order.failed': '下单失败',
  'strategy.error': '策略异常',
}

function renderPayload(payloadJson?: string) {
  if (!payloadJson) {
    return '-'
  }

  try {
    return JSON.stringify(JSON.parse(payloadJson), null, 2)
  } catch {
    return payloadJson
  }
}

export function AuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)

  const refreshAuditLogs = async () => {
    setLoading(true)
    try {
      const logs = await tradingApi.getAuditLogs(200)
      setAuditLogs(logs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshAuditLogs()
  }, [])

  const columns = useMemo<ProColumns<AuditLog>[]>(
    () => [
      {
        title: '级别',
        dataIndex: 'level',
        width: 100,
        filters: Object.entries(levelMeta).map(([value, meta]) => ({ text: meta.text, value })),
        onFilter: (value, row) => row.level === value,
        render: (_, row) => <Tag color={levelMeta[row.level].color}>{levelMeta[row.level].text}</Tag>,
      },
      {
        title: '动作',
        dataIndex: 'action',
        width: 130,
        filters: Object.entries(actionMeta).map(([value, text]) => ({ text, value })),
        onFilter: (value, row) => row.action === value,
        render: (_, row) => <Tag>{actionMeta[row.action]}</Tag>,
      },
      {
        title: '消息',
        dataIndex: 'message',
        ellipsis: true,
      },
      {
        title: '关联',
        dataIndex: 'entityType',
        width: 220,
        render: (_, row) => (
          <Space size={4} wrap>
            {row.ruleId ? <Tag>规则 {row.ruleId}</Tag> : null}
            {row.triggerId ? <Tag>触发 {row.triggerId}</Tag> : null}
            {row.orderId ? <Tag>订单 {row.orderId}</Tag> : null}
            {!row.ruleId && !row.triggerId && !row.orderId ? <Typography.Text type='secondary'>-</Typography.Text> : null}
          </Space>
        ),
      },
      {
        title: '详情',
        dataIndex: 'payloadJson',
        width: 90,
        render: (_, row) => (
          <Tooltip title={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{renderPayload(row.payloadJson)}</pre>}>
            <Typography.Link disabled={!row.payloadJson}>查看</Typography.Link>
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
      <ProTable<AuditLog>
        rowKey='id'
        search={false}
        loading={loading}
        columns={columns}
        dataSource={auditLogs}
        pagination={{ pageSize: 12 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} onClick={() => void refreshAuditLogs()}>
            刷新
          </Button>,
        ]}
      />
    </PageContainer>
  )
}
