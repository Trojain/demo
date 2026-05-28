import { useMemo, useRef, useState } from 'react'
import { Alert, Button, Select, Space, Tag } from 'antd'
import { PageContainer, ProDescriptions, ProTable, type ActionType, type ProColumns, type ProDescriptionsItemProps } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import { MARKET_EXCHANGE_OPTIONS } from '../constants/market'
import type { ExchangeCode, MarketHealth, MarketHealthTicker } from '../types'
import { toTableRequestResult } from '../utils/proTable'

function formatAge(ageMs: number) {
  if (ageMs < 1000) {
    return `${ageMs}ms`
  }

  return `${Math.round(ageMs / 1000)}s`
}

export function MarketHealthPage() {
  const actionRef = useRef<ActionType | undefined>(undefined)
  const [health, setHealth] = useState<MarketHealth>()
  const [exchange, setExchange] = useState<ExchangeCode>('okx')
  const healthDataSource = health ?? ({ exchange, restBackoffActive: false, subscribedSymbols: [], tickers: [] } as MarketHealth)

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

  const healthColumns = useMemo<ProDescriptionsItemProps<MarketHealth>[]>(
    () => [
      {
        title: '交易所',
        dataIndex: 'exchange',
        render: (_, row) => row.exchange.toUpperCase(),
      },
      {
        title: 'REST 状态',
        dataIndex: 'restBackoffActive',
        render: (_, row) => <Tag color={row.restBackoffActive ? 'warning' : 'success'}>{row.restBackoffActive ? '退避中' : '正常'}</Tag>,
      },
      {
        title: '退避结束',
        dataIndex: 'restBackoffUntil',
        render: (_, row) => row.restBackoffUntil ?? '-',
      },
      {
        title: '总览刷新',
        dataIndex: 'overviewRefreshedAt',
        render: (_, row) => row.overviewRefreshedAt ?? '-',
      },
      {
        title: '订阅交易对',
        dataIndex: 'subscribedSymbols',
        span: 2,
        render: (_, row) => (
          <Space size={4} wrap>
            {row.subscribedSymbols.length ? row.subscribedSymbols.map(symbol => <Tag key={symbol}>{symbol}</Tag>) : <Tag>暂无订阅</Tag>}
          </Space>
        ),
      },
    ],
    [],
  )

  return (
    <PageContainer subTitle='查看交易所行情缓存、订阅和 REST 退避状态'>
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        {health?.lastRestError ? <Alert type='warning' message='最近 REST 错误' description={health.lastRestError} showIcon /> : null}
        <ProDescriptions<MarketHealth> bordered size='small' column={2} dataSource={healthDataSource} columns={healthColumns} />
        <ProTable<MarketHealthTicker>
          actionRef={actionRef}
          rowKey={row => `${row.exchange}-${row.symbol}`}
          search={false}
          columns={columns}
          params={{ exchange }}
          request={async params => {
            const currentExchange = (params.exchange as ExchangeCode) ?? exchange
            const nextHealth = await tradingApi.getMarketHealth(currentExchange)
            setHealth(nextHealth)
            return toTableRequestResult(nextHealth.tickers)
          }}
          onReset={() => actionRef.current?.reload()}
          pagination={{ pageSize: 10 }}
          toolBarRender={() => [
            <Select
              key='exchange'
              value={exchange}
              options={MARKET_EXCHANGE_OPTIONS}
              onChange={setExchange}
              style={{ width: 140 }}
            />,
            <Button key='reload' icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>
              刷新
            </Button>,
          ]}
        />
      </Space>
    </PageContainer>
  )
}
