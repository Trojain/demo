import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { App as AntApp, Button, Col, Empty, Row, Segmented, Select, Skeleton, Space, Tooltip, Typography } from 'antd'
import { LineChartOutlined } from '@ant-design/icons'
import { PageContainer, ProCard, ProTable, StatisticCard, type ProColumns } from '@ant-design/pro-components'
import { createMarketCandleConnection } from '../api/realtime'
import { tradingApi } from '../api/trading'
import { DEFAULT_MARKET_SYMBOL, MARKET_EXCHANGE_OPTIONS, getCoinMeta, getCoinSymbol, getMarketSymbolOptions } from '../constants/market'
import { useBootstrapTrading } from '../hooks/useBootstrapTrading'
import { useTradingStore } from '../stores/tradingStore'
import type { ExchangeCode, MarketCandle, MarketTickerSnapshot } from '../types'
import { toTableRequestResult } from '../utils/proTable'
import styles from './page.module.scss'

type MarketCandleBar = '1s' | '10s' | '1m' | '5m' | '15m'
const CANDLE_REST_CALIBRATION_INTERVAL_MS = 60_000

const CANDLE_BAR_OPTIONS: Array<{ label: string; value: MarketCandleBar }> = [
  { label: '1秒', value: '1s' },
  { label: '10秒', value: '10s' },
  { label: '1分', value: '1m' },
  { label: '5分', value: '5m' },
  { label: '15分', value: '15m' },
]

const CANDLE_POINT_LIMIT_BY_BAR: Record<MarketCandleBar, number> = {
  '1s': 300,
  '10s': 120,
  '1m': 1440,
  '5m': 288,
  '15m': 96,
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
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1 ? 2 : 6,
  }).format(value)
}

function mergeRealtimeCandle(candles: MarketCandle[], candle: MarketCandle, bar: MarketCandleBar) {
  const bucketTime = new Date(candle.time).getTime()
  if (!Number.isFinite(bucketTime)) {
    return candles
  }

  const bucketIsoTime = new Date(bucketTime).toISOString()
  const pointLimit = CANDLE_POINT_LIMIT_BY_BAR[bar]
  const candleIndex = candles.findIndex(item => item.time === bucketIsoTime)

  if (candleIndex >= 0) {
    const nextCandle = { ...candle, time: bucketIsoTime }
    const currentCandle = candles[candleIndex]
    if (
      currentCandle.open === nextCandle.open &&
      currentCandle.high === nextCandle.high &&
      currentCandle.low === nextCandle.low &&
      currentCandle.close === nextCandle.close &&
      currentCandle.volume === nextCandle.volume &&
      currentCandle.volumeCurrency === nextCandle.volumeCurrency
    ) {
      return candles
    }

    return [...candles.slice(0, candleIndex), nextCandle, ...candles.slice(candleIndex + 1)]
  }

  return [
    ...candles,
    {
      ...candle,
      time: bucketIsoTime,
    },
  ]
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
    .slice(-pointLimit)
}

export function OverviewPage() {
  const { message } = AntApp.useApp()
  useBootstrapTrading()
  const candleRequestingRef = useRef(false)
  const candleRequestTokenRef = useRef(0)
  const [selectedExchange, setSelectedExchange] = useState<ExchangeCode>('okx')
  const [selectedSymbol, setSelectedSymbol] = useState<string>(DEFAULT_MARKET_SYMBOL)
  const [selectedBar, setSelectedBar] = useState<MarketCandleBar>('10s')
  const [candles, setCandles] = useState<MarketCandle[]>([])
  const [candlesLoading, setCandlesLoading] = useState(false)
  const dashboardSummary = useTradingStore(state => state.dashboardSummary)
  const [candleError, setCandleError] = useState('')
  const candleSeries = useMemo(
    () =>
      candles.map(item => ({
        time: item.time,
        price: Number(item.close),
      })),
    [candles],
  )
  const realtimePrice = candleSeries.length > 0 ? candleSeries[candleSeries.length - 1].price : undefined
  const firstPrice = candleSeries.length > 0 ? candleSeries[0].price : undefined
  const trendUp = Number.isFinite(realtimePrice) && Number.isFinite(firstPrice) ? (realtimePrice ?? 0) >= (firstPrice ?? 0) : true
  const trendColor = trendUp ? '#16a34a' : '#ff4d6d'

  const handleSelectSymbol = useCallback((symbol: string) => {
    setSelectedSymbol(symbol)
    // 切换币种时先清空旧 K 线，避免请求期间继续显示上一个币种的走势。
    setCandles([])
    setCandleError('')
  }, [])

  const handleSelectExchange = useCallback((exchange: ExchangeCode) => {
    const options = getMarketSymbolOptions(exchange)
    setSelectedExchange(exchange)
    setSelectedSymbol(options[0]?.value ?? DEFAULT_MARKET_SYMBOL)
    setCandles([])
    setCandleError('')
  }, [])

  const handleSelectBar = useCallback((bar: string | number) => {
    setSelectedBar(bar as MarketCandleBar)
    // 切换周期时重新查询对应 K 线，避免旧周期数据和新周期标签混在一起。
    setCandles([])
    setCandleError('')
  }, [])

  const marketColumns = useMemo<ProColumns<MarketTickerSnapshot>[]>(
    () => [
      {
        title: '名称',
        dataIndex: 'symbol',
        render: (_, row) => {
          const coin = getCoinSymbol(row.symbol)
          const meta = getCoinMeta(row.symbol)
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
      {
        title: '市值',
        dataIndex: 'marketCap',
        align: 'right',
        render: (_, row) => <Typography.Text className={styles.marketMetric}>{row.marketCap ? formatMoneyCompact(row.marketCap) : '待接入'}</Typography.Text>,
      },
      {
        title: '操作',
        valueType: 'option',
        align: 'right',
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

  const loadCandles = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent && candleRequestingRef.current) {
      return
    }

    const requestToken = candleRequestTokenRef.current + 1
    candleRequestTokenRef.current = requestToken
    candleRequestingRef.current = true
    if (!options?.silent) {
      setCandlesLoading(true)
    }
    setCandleError('')
    try {
      const nextCandles = await tradingApi.getMarketCandles(selectedSymbol, selectedBar, selectedExchange)
      if (requestToken === candleRequestTokenRef.current) {
        setCandles(nextCandles)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'K 线数据加载失败'
      if (requestToken === candleRequestTokenRef.current) {
        setCandles([])
        setCandleError(errorMessage)
        message.error(`${selectedSymbol} ${selectedBar} 走势加载失败`)
      }
    } finally {
      if (requestToken === candleRequestTokenRef.current) {
        candleRequestingRef.current = false
        if (!options?.silent) {
          setCandlesLoading(false)
        }
      }
    }
  }, [message, selectedBar, selectedExchange, selectedSymbol])

  useEffect(() => {
    void loadCandles()
  }, [loadCandles])

  useEffect(() => {
    return createMarketCandleConnection({
      exchange: selectedExchange,
      symbol: selectedSymbol,
      bar: selectedBar,
      onCandle: candle => {
        setCandles(currentCandles => mergeRealtimeCandle(currentCandles, candle, selectedBar))
      },
      onConnectionLost: () => {
        message.error('K 线推送连接异常，请检查后端服务是否启动')
      },
    })
  }, [message, selectedBar, selectedExchange, selectedSymbol])


  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadCandles({ silent: true })
      }
    }

    // WebSocket 负责实时推进图表，REST K 线只做低频校准，避免 Network 中持续刷 candles 请求。
    const timer = window.setInterval(refreshWhenVisible, CANDLE_REST_CALIBRATION_INTERVAL_MS)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [loadCandles, selectedBar])

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
      grid: { left: 24, right: 82, top: 28, bottom: 38 },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#94a3b8',
          formatter: (value: number) =>
            selectedBar.endsWith('s')
              ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
              : new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        position: 'right',
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
          markLine: Number.isFinite(realtimePrice)
            ? {
                symbol: 'none',
                silent: true,
                lineStyle: {
                  color: trendColor,
                  type: 'dashed',
                  width: 1,
                },
                label: {
                  show: true,
                  position: 'end',
                  formatter: () => formatPriceAxis(realtimePrice ?? 0),
                  color: '#ffffff',
                  backgroundColor: trendColor,
                  borderRadius: 4,
                  padding: [4, 6],
                  fontWeight: 700,
                },
                data: [{ yAxis: realtimePrice }],
              }
            : undefined,
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
    [candleSeries, realtimePrice, selectedBar, selectedSymbol, trendColor],
  )

  return (
    <PageContainer subTitle='查看行情、规则、触发和订单的整体运行概况'>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <StatisticCard statistic={{ title: '启用规则', value: dashboardSummary.enabledRuleCount, suffix: `/ ${dashboardSummary.ruleCount}` }} />
        </Col>
        <Col xs={24} md={6}>
          <StatisticCard statistic={{ title: '待确认触发', value: dashboardSummary.pendingTriggerCount }} />
        </Col>
        <Col xs={24} md={6}>
          <StatisticCard statistic={{ title: '订单记录', value: dashboardSummary.orderCount }} />
        </Col>
        <Col xs={24} md={6}>
          <StatisticCard statistic={{ title: '行情缓存', value: dashboardSummary.tickerCount }} />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className={styles.section}>
        <Col xs={24} lg={14}>
          <ProCard
            title={`实时价格曲线 ${selectedSymbol}`}
            extra={
              <Space>
                <Select value={selectedExchange} options={MARKET_EXCHANGE_OPTIONS} onChange={handleSelectExchange} style={{ width: 120 }} />
                <Select value={selectedSymbol} options={getMarketSymbolOptions(selectedExchange)} onChange={handleSelectSymbol} style={{ width: 160 }} />
              </Space>
            }
          >
            <Space direction='vertical' size={12} style={{ width: '100%' }}>
              <Segmented size='small' value={selectedBar} options={CANDLE_BAR_OPTIONS} onChange={handleSelectBar} />
              {candlesLoading ? (
                <Skeleton active paragraph={{ rows: 8 }} />
              ) : candleSeries.length > 0 ? (
                <ReactECharts option={option} notMerge={false} lazyUpdate style={{ height: 405 }} />
              ) : (
                <Empty description={candleError || '暂无行情数据'} />
              )}
            </Space>
          </ProCard>
        </Col>
        <Col xs={24} lg={10}>
          <ProCard title='最新行情' bodyStyle={{ padding: 0 }}>
            <ProTable<MarketTickerSnapshot>
              rowKey={row => `${row.exchange}-${row.symbol}`}
              className={styles.marketTable}
              columns={marketColumns}
              params={{ exchange: selectedExchange }}
              request={async params => {
                const exchange = (params.exchange as ExchangeCode) ?? selectedExchange
                return toTableRequestResult(await tradingApi.getMarketOverview(exchange))
              }}
              search={false}
              options={false}
              pagination={false}
              toolBarRender={false}
            />
          </ProCard>
        </Col>
      </Row>
    </PageContainer>
  )
}
