import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { App as AntApp, Button, Col, Empty, Row, Segmented, Select, Skeleton, Space, Tooltip, Typography } from 'antd'
import { LineChartOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { PageContainer, ProCard, ProTable, type ProColumns } from '@ant-design/pro-components'
import { createMarketCandleConnection } from '../api/realtime'
import { tradingApi } from '../api/trading'
import { OverviewTradeDrawer, type TradeDrawerPreset, type TradeDrawerRow } from '../components/OverviewTradeDrawer'
import { TradePortfolioOverviewSection } from '../components/TradePortfolioOverviewSection'
import { DEFAULT_MARKET_SYMBOL, MARKET_EXCHANGE_OPTIONS, getCoinMeta, getCoinSymbol, getMarketSymbolOptions } from '../constants/market'
import { useTickerSnapshot } from '../hooks/useTickerSnapshot'
import { useTradingStore } from '../stores/tradingStore'
import type { ExchangeCode, MarketCandle, MarketTickerSnapshot, TickerPrice, TradePositionView } from '../types'
import { createMarketPriceSnapshot, shouldAcceptMarketPrice } from '../utils/marketPrice'
import styles from './page.module.scss'

type MarketCandleBar = '1s' | '10s' | '1m' | '5m' | '15m'

const CANDLE_REST_CALIBRATION_INTERVAL_MS = 60_000
const OVERVIEW_CANDLE_BAR_STORAGE_KEY = 'overview.marketCandleBar'

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

function isMarketCandleBar(value: string): value is MarketCandleBar {
  return CANDLE_BAR_OPTIONS.some(option => option.value === value)
}

function getInitialMarketCandleBar() {
  if (typeof window === 'undefined') {
    return '10s' as MarketCandleBar
  }

  try {
    const storedBar = window.localStorage.getItem(OVERVIEW_CANDLE_BAR_STORAGE_KEY)
    return storedBar && isMarketCandleBar(storedBar) ? storedBar : ('10s' as MarketCandleBar)
  } catch {
    return '10s' as MarketCandleBar
  }
}

function parseSortableMarketCap(value?: string) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : Number.NEGATIVE_INFINITY
}

function sortMarketRows(rows: MarketTickerSnapshot[]) {
  return [...rows].sort((left, right) => {
    const marketCapDiff = parseSortableMarketCap(right.marketCap) - parseSortableMarketCap(left.marketCap)
    if (marketCapDiff !== 0) {
      return marketCapDiff
    }

    return left.symbol.localeCompare(right.symbol)
  })
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1 ? 2 : 6,
  }).format(value)
}

function formatPriceAxis(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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

function resolvePreferredTicker(snapshotTicker?: TickerPrice, realtimeTicker?: TickerPrice) {
  if (!snapshotTicker) {
    return realtimeTicker
  }

  if (!realtimeTicker) {
    return snapshotTicker
  }

  return shouldAcceptMarketPrice(createMarketPriceSnapshot(snapshotTicker, 'rest'), createMarketPriceSnapshot(realtimeTicker, 'realtime'))
    ? realtimeTicker
    : snapshotTicker
}

function RealtimeMarketPriceCell({ row }: { row: MarketTickerSnapshot }) {
  const realtimeTicker = useTickerSnapshot(row.exchange, row.symbol)
  const displayTicker = useMemo(() => resolvePreferredTicker(row, realtimeTicker), [realtimeTicker, row])
  const displayPrice = displayTicker?.price ?? row.price

  return (
    <div className={styles.marketPriceCell}>
      <Typography.Text className={styles.marketPrice}>{displayPrice}</Typography.Text>
      <Typography.Text className={styles.marketSubPrice}>{formatUsd(Number(displayPrice))}</Typography.Text>
    </div>
  )
}

function MarketOverviewTable({
  exchange,
  onSelectSymbol,
  onOpenTrade,
}: {
  exchange: ExchangeCode
  onSelectSymbol: (symbol: string) => void
  onOpenTrade: (row: TradeDrawerRow, preset?: TradeDrawerPreset) => void
}) {
  const { message } = AntApp.useApp()
  const [overviewRows, setOverviewRows] = useState<MarketTickerSnapshot[]>([])
  const [loading, setLoading] = useState(false)

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const nextRows = await tradingApi.getMarketOverview(exchange)
      setOverviewRows(sortMarketRows(nextRows))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '最新行情加载失败')
    } finally {
      setLoading(false)
    }
  }, [exchange, message])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

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
        render: (_, row) => <RealtimeMarketPriceCell row={row} />,
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
          <Space size={4} className={styles.marketActionGroup}>
            <Tooltip title='查看走势'>
              <Button size='small' type='text' icon={<LineChartOutlined />} aria-label={`查看 ${row.symbol} 走势`} onClick={() => onSelectSymbol(row.symbol)} />
            </Tooltip>
            <Button
              size='small'
              type='text'
              className={styles.tradeActionButton}
              icon={<ThunderboltOutlined />}
              title='交易'
              aria-label={`打开 ${row.symbol} 交易面板`}
              onClick={() => onOpenTrade(row)}
            >
              交易
            </Button>
          </Space>
        ),
      },
    ],
    [onOpenTrade, onSelectSymbol],
  )

  return (
    <ProTable<MarketTickerSnapshot>
      rowKey={row => `${row.exchange}-${row.symbol}`}
      className={styles.marketTable}
      columns={marketColumns}
      dataSource={overviewRows}
      loading={loading}
      search={false}
      options={false}
      pagination={false}
      toolBarRender={false}
    />
  )
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

function mergeCalibrationCandles(currentCandles: MarketCandle[], nextCandles: MarketCandle[], bar: MarketCandleBar) {
  if (currentCandles.length === 0 || nextCandles.length === 0) {
    return nextCandles
  }

  const latestNextTime = nextCandles.reduce((latest, candle) => {
    const time = new Date(candle.time).getTime()
    return Number.isFinite(time) ? Math.max(latest, time) : latest
  }, 0)

  const candleMap = new Map(nextCandles.map(candle => [candle.time, candle]))
  currentCandles.forEach(candle => {
    const time = new Date(candle.time).getTime()
    if (Number.isFinite(time) && time >= latestNextTime) {
      // 低频 REST 校准只补全旧桶，最新桶继续以 WebSocket 为准，避免曲线回退。
      candleMap.set(candle.time, candle)
    }
  })

  return [...candleMap.values()].sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime()).slice(-CANDLE_POINT_LIMIT_BY_BAR[bar])
}

export function OverviewPage() {
  const { message } = AntApp.useApp()
  const refreshSummary = useTradingStore(state => state.refreshSummary)
  const candleRequestingRef = useRef(false)
  const candleRequestTokenRef = useRef(0)
  const pendingRealtimeCandleRef = useRef<MarketCandle | undefined>(undefined)
  const realtimeCandleFrameRef = useRef<number | undefined>(undefined)
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false)
  const [tradeDrawerRow, setTradeDrawerRow] = useState<TradeDrawerRow>()
  const [tradeDrawerPreset, setTradeDrawerPreset] = useState<TradeDrawerPreset>()
  const [portfolioRefreshSignal, setPortfolioRefreshSignal] = useState(0)
  const [selectedExchange, setSelectedExchange] = useState<ExchangeCode>('okx')
  const [selectedSymbol, setSelectedSymbol] = useState<string>(DEFAULT_MARKET_SYMBOL)
  const [selectedBar, setSelectedBar] = useState<MarketCandleBar>(() => getInitialMarketCandleBar())
  const [candles, setCandles] = useState<MarketCandle[]>([])
  const [candlesLoading, setCandlesLoading] = useState(false)
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
    // 切换币种后先清空旧数据，避免图表在请求期间显示错误上下文。
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
    setCandles([])
    setCandleError('')
  }, [])

  const handleOpenTradeDrawer = useCallback((row: TradeDrawerRow, preset?: TradeDrawerPreset) => {
    setTradeDrawerRow(row)
    setTradeDrawerPreset(preset)
    setTradeDrawerOpen(true)
  }, [])

  const handleOpenPositionSellDrawer = useCallback(
    (position: TradePositionView) => {
      handleOpenTradeDrawer(
        {
          exchange: position.exchange,
          symbol: position.symbol,
          price: position.marketPrice,
          eventTime: position.marketEventTime ?? new Date().toISOString(),
        },
        {
          quickQuoteAmount: position.marketValue,
          quickMode: position.accountType,
          readonlyExchange: true,
          readonlyMode: true,
          hideBuyAction: true,
          hidePlanTab: true,
        },
      )
    },
    [handleOpenTradeDrawer],
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(OVERVIEW_CANDLE_BAR_STORAGE_KEY, selectedBar)
    } catch {
      // 本地缓存失败不影响实时图表功能。
    }
  }, [selectedBar])

  const loadCandles = useCallback(
    async (options?: { silent?: boolean }) => {
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
          setCandles(currentCandles => (options?.silent ? mergeCalibrationCandles(currentCandles, nextCandles, selectedBar) : nextCandles))
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
    },
    [message, selectedBar, selectedExchange, selectedSymbol],
  )

  useEffect(() => {
    void loadCandles()
  }, [loadCandles])

  useEffect(() => {
    pendingRealtimeCandleRef.current = undefined
    if (realtimeCandleFrameRef.current !== undefined) {
      window.cancelAnimationFrame(realtimeCandleFrameRef.current)
      realtimeCandleFrameRef.current = undefined
    }
  }, [selectedBar, selectedExchange, selectedSymbol])

  useEffect(() => {
    return createMarketCandleConnection({
      exchange: selectedExchange,
      symbol: selectedSymbol,
      bar: selectedBar,
      onCandle: candle => {
        pendingRealtimeCandleRef.current = candle
        if (realtimeCandleFrameRef.current !== undefined) {
          return
        }

        // 高频推送只在下一帧提交一次状态，避免图表在短时间内重复重绘。
        realtimeCandleFrameRef.current = window.requestAnimationFrame(() => {
          realtimeCandleFrameRef.current = undefined
          const pendingCandle = pendingRealtimeCandleRef.current
          pendingRealtimeCandleRef.current = undefined
          if (!pendingCandle) {
            return
          }

          setCandles(currentCandles => mergeRealtimeCandle(currentCandles, pendingCandle, selectedBar))
        })
      },
      onConnectionLost: () => {
        message.error('K 线推送连接异常，请检查后端服务是否启动')
      },
    })
  }, [message, selectedBar, selectedExchange, selectedSymbol])

  useEffect(
    () => () => {
      if (realtimeCandleFrameRef.current !== undefined) {
        window.cancelAnimationFrame(realtimeCandleFrameRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadCandles({ silent: true })
      }
    }

    // 实时推进继续靠 WebSocket，REST 只负责低频校准。
    const timer = window.setInterval(refreshWhenVisible, CANDLE_REST_CALIBRATION_INTERVAL_MS)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [loadCandles])

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
    <PageContainer subTitle='查看行情、持仓、交易计划和执行记录的整体运行概况'>
      <Row gutter={[16, 16]} className={styles.section}>
        <Col xs={24} lg={14}>
          <ProCard
            title={`实时价格曲线 ${selectedSymbol}`}
            extra={
              <Space>
                <Select value={selectedExchange} options={MARKET_EXCHANGE_OPTIONS} onChange={value => handleSelectExchange(value as ExchangeCode)} style={{ width: 120 }} />
                <Select value={selectedSymbol} options={getMarketSymbolOptions(selectedExchange)} onChange={value => handleSelectSymbol(String(value))} style={{ width: 160 }} />
              </Space>
            }
          >
            <Space direction='vertical' size={12} style={{ width: '100%' }}>
              <Segmented size='small' value={selectedBar} options={CANDLE_BAR_OPTIONS} onChange={handleSelectBar} />
              {candlesLoading ? (
                <Skeleton active paragraph={{ rows: 8 }} />
              ) : candleSeries.length > 0 ? (
                <ReactECharts option={option} notMerge={false} lazyUpdate style={{ height: 368 }} />
              ) : (
                <Empty description={candleError || '暂无行情数据'} />
              )}
            </Space>
          </ProCard>
        </Col>
        <Col xs={24} lg={10}>
          <ProCard title='最新行情' bodyStyle={{ padding: 0 }}>
            <MarketOverviewTable exchange={selectedExchange} onSelectSymbol={handleSelectSymbol} onOpenTrade={handleOpenTradeDrawer} />
          </ProCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className={styles.section}>
        <Col span={24}>
          <TradePortfolioOverviewSection onSellPosition={handleOpenPositionSellDrawer} refreshSignal={portfolioRefreshSignal} />
        </Col>
      </Row>

      <OverviewTradeDrawer
        open={tradeDrawerOpen}
        row={tradeDrawerRow}
        preset={tradeDrawerPreset}
        onCreated={() => {
          void refreshSummary()
          setPortfolioRefreshSignal(current => current + 1)
        }}
        onOpenChange={nextOpen => {
          setTradeDrawerOpen(nextOpen)
          if (!nextOpen) {
            setTradeDrawerRow(undefined)
            setTradeDrawerPreset(undefined)
          }
        }}
      />
    </PageContainer>
  )
}
