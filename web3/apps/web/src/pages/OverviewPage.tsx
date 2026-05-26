import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { App as AntApp, Button, Col, Empty, Row, Select, Skeleton, Statistic, Tooltip, Typography } from 'antd'
import { LineChartOutlined } from '@ant-design/icons'
import { PageContainer, ProCard, ProTable, type ProColumns } from '@ant-design/pro-components'
import { tradingApi } from '../api/trading'
import { useTradingStore } from '../stores/tradingStore'
import type { MarketCandle, MarketTickerSnapshot } from '../types'
import styles from './page.module.scss'

const overviewSymbols = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT', 'OKB-USDT', 'BNB-USDT']

const coinMeta: Record<string, { name: string; icon: string }> = {
  BTC: { name: 'Bitcoin', icon: '/coin-icons/BTC.png' },
  ETH: { name: 'Ethereum', icon: '/coin-icons/ETH.png' },
  SOL: { name: 'Solana', icon: '/coin-icons/SOL.png' },
  DOGE: { name: 'Dogecoin', icon: '/coin-icons/DOGE.png' },
  OKB: { name: 'OKB', icon: '/coin-icons/OKB.png' },
  BNB: { name: 'Build and Build', icon: '/coin-icons/BNB.png' },
}

function formatMoneyCompact(value?: string) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return '-'
  }

  if (numberValue >= 1_000_000_000_000) {
    return `$${(numberValue / 1_000_000_000_000).toFixed(2)}T`
  }

  if (numberValue >= 1_000_000_000) {
    return `$${(numberValue / 1_000_000_000).toFixed(2)}B`
  }

  if (numberValue >= 1_000_000) {
    return `$${(numberValue / 1_000_000).toFixed(2)}M`
  }

  return formatUsd(numberValue)
}

function formatPriceAxis(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(2)}K`
  }

  if (Math.abs(value) >= 1) {
    return value.toFixed(2)
  }

  return value.toFixed(5)
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1 ? 2 : 6,
  }).format(value)
}

export function OverviewPage() {
  const { message } = AntApp.useApp()
  const [selectedSymbol, setSelectedSymbol] = useState('BTC-USDT')
  const [candles, setCandles] = useState<MarketCandle[]>([])
  const [candlesLoading, setCandlesLoading] = useState(false)
  const enabledRuleCount = useTradingStore(state => state.rules.filter(rule => rule.enabled).length)
  const ruleCount = useTradingStore(state => state.rules.length)
  const pendingTriggerCount = useTradingStore(state => state.triggers.filter(item => item.status === 'pending').length)
  const orderCount = useTradingStore(state => state.orders.length)
  const tickerCount = useTradingStore(state => state.tickers.length)
  const marketOverview = useTradingStore(state => state.marketOverview)
  const [candleError, setCandleError] = useState('')
  const candleSeries = useMemo(
    () =>
      candles.map(item => ({
        time: item.time,
        price: Number(item.close),
      })),
    [candles],
  )

  const handleSelectSymbol = useCallback((symbol: string) => {
    setSelectedSymbol(symbol)
    // 切换币种时先清空旧 K 线，避免请求期间继续显示上一个币种的走势。
    setCandles([])
    setCandleError('')
  }, [])

  const marketColumns = useMemo<ProColumns<MarketTickerSnapshot>[]>(
    () => [
      {
        title: '名称',
        dataIndex: 'symbol',
        render: (_, row) => {
          const coin = row.symbol.replace('-USDT', '')
          const meta = coinMeta[coin] ?? { name: coin, icon: '' }
          return (
            <div className={styles.coinCell}>
              <img className={styles.coinIcon} src={meta.icon} alt={coin} />
              <div className={styles.coinNameWrap}>
                <Typography.Text className={styles.coinSymbol}>{coin}</Typography.Text>
                <Typography.Text className={styles.coinName}>{meta.name}</Typography.Text>
              </div>
            </div>
          )
        },
      },
      {
        title: '价格',
        dataIndex: 'price',
        align: 'right',
        render: (_, row) => (
          <div className={styles.marketPriceCell}>
            <Typography.Text className={styles.marketPrice}>{row.price}</Typography.Text>
            <Typography.Text className={styles.marketSubPrice}>{formatUsd(Number(row.price))}</Typography.Text>
          </div>
        ),
      },
      {
        title: '24小时涨跌',
        dataIndex: 'changePercent24h',
        align: 'right',
        render: (_, row) => {
          const change = Number(row.changePercent24h)
          return (
            <Typography.Text className={change >= 0 ? styles.positiveChange : styles.negativeChange}>
              {change >= 0 ? '+' : ''}
              {row.changePercent24h}%
            </Typography.Text>
          )
        },
      },
      {
        title: '24h成交量',
        dataIndex: 'volumeCurrency24h',
        align: 'right',
        render: (_, row) => <Typography.Text className={styles.marketMetric}>{formatMoneyCompact(row.volumeCurrency24h)}</Typography.Text>,
      },
      // {
      //   title: '市值',
      //   dataIndex: 'marketCap',
      //   align: 'right',
      //   render: (_, row) => <Typography.Text className={styles.marketMetric}>{row.marketCap ? formatMoneyCompact(row.marketCap) : '待接入'}</Typography.Text>,
      // },
      {
        title: '操作',
        valueType: 'option',
        align: 'right',
        width: 92,
        render: (_, row) => (
          <div>
            <Tooltip title='查看走势'>
              <Button
                size='small'
                type='text'
                icon={<LineChartOutlined />}
                aria-label={`查看 ${row.symbol} 走势`}
                onClick={() => handleSelectSymbol(row.symbol)}
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    [handleSelectSymbol],
  )

  useEffect(() => {
    let ignore = false

    const loadCandles = async () => {
      setCandlesLoading(true)
      setCandleError('')
      try {
        const nextCandles = await tradingApi.getMarketCandles(selectedSymbol, '1m')
        if (!ignore) {
          setCandles(nextCandles)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'K 线数据加载失败'
        if (!ignore) {
          setCandles([])
          setCandleError(errorMessage)
          message.error(`${selectedSymbol} 走势加载失败`)
        }
      } finally {
        if (!ignore) {
          setCandlesLoading(false)
        }
      }
    }

    void loadCandles()

    return () => {
      ignore = true
    }
  }, [message, selectedSymbol])

  const option = useMemo(
    () => ({
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#eef1f5',
        borderWidth: 1,
        padding: [14, 16],
        textStyle: { color: '#111827' },
        extraCssText: 'box-shadow: 0 10px 26px rgba(15, 23, 42, 0.12); border-radius: 8px;',
        formatter: (params: Array<{ data: [number, number] }>) => {
          const point = params[0]
          const [time, price] = point.data
          const date = new Date(time)
          return [
            `<div style="display:flex;gap:72px;color:#64748b;font-size:12px;margin-bottom:10px;">`,
            `<span>${date.toISOString().slice(0, 10)}</span>`,
            `<span>${date.toLocaleTimeString()}</span>`,
            `</div>`,
            `<div style="font-weight:700;font-size:14px;">${formatUsd(price)}</div>`,
          ].join('')
        },
      },
      grid: { left: 56, right: 24, top: 28, bottom: 38 },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#94a3b8',
          formatter: (value: number) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        position: 'left',
        axisLabel: {
          color: '#94a3b8',
          formatter: formatPriceAxis,
        },
        splitLine: {
          lineStyle: {
            color: '#e8edf4',
            type: 'dotted',
          },
        },
      },
      series: [
        {
          name: selectedSymbol,
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: candleSeries.map(item => [new Date(item.time).getTime(), item.price]),
          lineStyle: { width: 2, color: '#f5b400' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245, 180, 0, 0.18)' },
                { offset: 1, color: 'rgba(245, 180, 0, 0.01)' },
              ],
            },
          },
        },
      ],
    }),
    [candleSeries, selectedSymbol],
  )

  return (
    <PageContainer>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <ProCard>
            <Statistic title='启用规则' value={enabledRuleCount} suffix={`/ ${ruleCount}`} />
          </ProCard>
        </Col>
        <Col xs={24} md={6}>
          <ProCard>
            <Statistic title='待确认触发' value={pendingTriggerCount} />
          </ProCard>
        </Col>
        <Col xs={24} md={6}>
          <ProCard>
            <Statistic title='订单记录' value={orderCount} />
          </ProCard>
        </Col>
        <Col xs={24} md={6}>
          <ProCard>
            <Statistic title='行情缓存' value={tickerCount} />
          </ProCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className={styles.section}>
        <Col xs={24} lg={24}>
          <ProCard title='最新行情' bodyStyle={{ minHeight: 360, padding: 0 }}>
            {marketOverview.length === 0 ? (
              <Empty description='暂无行情缓存' />
            ) : (
              <ProTable<MarketTickerSnapshot>
                rowKey={row => `${row.exchange}-${row.symbol}`}
                className={styles.marketTable}
                columns={marketColumns}
                dataSource={marketOverview}
                search={false}
                options={false}
                pagination={false}
                toolBarRender={false}
              />
            )}
          </ProCard>
        </Col>
        <Col xs={24} lg={24}>
          <ProCard
            title={`实时价格曲线 ${selectedSymbol}`}
            extra={
              <Select
                value={selectedSymbol}
                options={overviewSymbols.map(symbol => ({ label: symbol.replace('-USDT', ''), value: symbol }))}
                onChange={handleSelectSymbol}
                style={{ width: 128 }}
              />
            }
            bodyStyle={{ height: 360 }}
          >
            {candlesLoading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : candleSeries.length > 0 ? (
              <ReactECharts option={option} notMerge={false} lazyUpdate style={{ height: 320 }} />
            ) : (
              <Empty description={candleError || '暂无 24 小时行情'} />
            )}
          </ProCard>
        </Col>
      </Row>
    </PageContainer>
  )
}
