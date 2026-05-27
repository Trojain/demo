import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Descriptions, Select, Space, Tag } from 'antd'
import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import { MARKET_EXCHANGE_OPTIONS } from '../constants/market'
import type { ExchangeCode, MarketHealth, MarketHealthTicker } from '../types'

function formatAge(ageMs: number) {
  if (ageMs < 1000) {
    return `${ageMs}ms`
  }

  return `${Math.round(ageMs / 1000)}s`
}

export function MarketHealthPage() {
  const [health, setHealth] = useState<MarketHealth>()
  const [exchange, setExchange] = useState<ExchangeCode>('okx')
  const [loading, setLoading] = useState(false)

  const refreshHealth = async () => {
    setLoading(true)
    try {
      const nextHealth = await tradingApi.getMarketHealth(exchange)
      setHealth(nextHealth)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshHealth()
  }, [exchange])

  const columns = useMemo<ProColumns<MarketHealthTicker>[]>(
    () => [
      {
        title: '交易对',
        dataIndex: 'symbol',
      },
      {
        title: '价格',
        dataIndex: 'price',
      },
      {
        title: '缓存年龄',
        dataIndex: 'ageMs',
        render: (_, row) => <Tag color={row.ageMs <= 10_000 ? 'success' : 'warning'}>{formatAge(row.ageMs)}</Tag>,
      },
      {
        title: '行情时间',
        dataIndex: 'eventTime',
        valueType: 'dateTime',
      },
    ],
    [],
  )

  return (
    <PageContainer subTitle='查看交易所行情缓存、订阅和 REST 退避状态'>
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        {health?.lastRestError ? <Alert type='warning' message='最近 REST 错误' description={health.lastRestError} showIcon /> : null}
        <Descriptions bordered size='small' column={2}>
          <Descriptions.Item label='交易所'>{health?.exchange.toUpperCase() ?? '-'}</Descriptions.Item>
          <Descriptions.Item label='REST 状态'>
            <Tag color={health?.restBackoffActive ? 'warning' : 'success'}>{health?.restBackoffActive ? '退避中' : '正常'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label='退避结束'>{health?.restBackoffUntil ?? '-'}</Descriptions.Item>
          <Descriptions.Item label='总览刷新'>{health?.overviewRefreshedAt ?? '-'}</Descriptions.Item>
          <Descriptions.Item label='订阅交易对' span={2}>
            <Space size={4} wrap>
              {health?.subscribedSymbols.length ? health.subscribedSymbols.map(symbol => <Tag key={symbol}>{symbol}</Tag>) : <Tag>暂无订阅</Tag>}
            </Space>
          </Descriptions.Item>
        </Descriptions>
        <ProTable<MarketHealthTicker>
          rowKey={row => `${row.exchange}-${row.symbol}`}
          search={false}
          loading={loading}
          columns={columns}
          dataSource={health?.tickers ?? []}
          pagination={{ pageSize: 10 }}
          toolBarRender={() => [
            <Select
              key='exchange'
              value={exchange}
              options={MARKET_EXCHANGE_OPTIONS}
              onChange={setExchange}
              style={{ width: 140 }}
            />,
            <Button key='reload' icon={<ReloadOutlined />} onClick={() => void refreshHealth()}>
              刷新
            </Button>,
          ]}
        />
      </Space>
    </PageContainer>
  )
}
