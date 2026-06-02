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

const privateStreamStatusColorMap: Record<MarketHealth['privateTradeStream']['status'], string> = {
  idle: 'default',
  connecting: 'processing',
  connected: 'success',
  reconnecting: 'warning',
  disconnected: 'default',
  error: 'error',
  stopped: 'default',
}

const privateStreamStatusTextMap: Record<MarketHealth['privateTradeStream']['status'], string> = {
  idle: '未启动',
  connecting: '连接中',
  connected: '已连接',
  reconnecting: '重连中',
  disconnected: '已断开',
  error: '异常',
  stopped: '已停止',
}

export function MarketHealthPage() {
  const actionRef = useRef<ActionType | undefined>(undefined)
  const [health, setHealth] = useState<MarketHealth>()
  const [exchange, setExchange] = useState<ExchangeCode>('okx')
  const healthDataSource = health ?? ({
    exchange,
    // 页面首屏先显示等待服务返回，避免本地占位文案和后端真实环境不一致。
    tradingEnvironment: '等待服务返回',
    restBackoffActive: false,
    subscribedSymbols: [],
    tickers: [],
    privateTradeStream: {
      exchange,
      enabled: false,
      status: 'idle',
      reconnectCount: 0,
    },
  } as MarketHealth)

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
        title: '交易环境',
        dataIndex: 'tradingEnvironment',
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
      {
        title: '私有推送',
        dataIndex: ['privateTradeStream', 'status'],
        render: (_, row) => (
          <Tag color={privateStreamStatusColorMap[row.privateTradeStream.status]}>
            {privateStreamStatusTextMap[row.privateTradeStream.status]}
          </Tag>
        ),
      },
      {
        title: '是否可用',
        dataIndex: ['privateTradeStream', 'enabled'],
        render: (_, row) => <Tag color={row.privateTradeStream.enabled ? 'success' : 'default'}>{row.privateTradeStream.enabled ? '已配置' : '未配置'}</Tag>,
      },
      {
        title: '重连次数',
        dataIndex: ['privateTradeStream', 'reconnectCount'],
      },
      {
        title: '最近连接成功',
        dataIndex: ['privateTradeStream', 'lastConnectedAt'],
        render: (_, row) => row.privateTradeStream.lastConnectedAt ?? '-',
      },
      {
        title: '最近订单推送',
        dataIndex: ['privateTradeStream', 'lastOrderUpdateAt'],
        render: (_, row) => row.privateTradeStream.lastOrderUpdateAt ?? '-',
      },
      {
        title: '最近余额推送',
        dataIndex: ['privateTradeStream', 'lastBalanceUpdateAt'],
        render: (_, row) => row.privateTradeStream.lastBalanceUpdateAt ?? '-',
      },
    ],
    [],
  )

  return (
    <PageContainer subTitle='查看交易所行情缓存、订阅和 REST 退避状态'>
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        {health?.lastRestError ? <Alert type='warning' message='最近 REST 错误' description={health.lastRestError} showIcon /> : null}
        {health?.privateTradeStream.lastErrorMessage ? (
          <Alert type='error' message='最近私有推送错误' description={health.privateTradeStream.lastErrorMessage} showIcon />
        ) : null}
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
