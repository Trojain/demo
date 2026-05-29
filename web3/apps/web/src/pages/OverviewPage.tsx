import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import ReactECharts from 'echarts-for-react'
import { App as AntApp, Button, Col, Empty, Row, Segmented, Select, Skeleton, Space, Tooltip, Typography } from 'antd'
import { LineChartOutlined, ThunderboltOutlined } from '@ant-design/icons'
import {
  DrawerForm,
  PageContainer,
  ProCard,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProTable,
  StatisticCard,
  type ProColumns,
} from '@ant-design/pro-components'
import { createMarketCandleConnection } from '../api/realtime'
import { tradingApi } from '../api/trading'
import { DEFAULT_MARKET_SYMBOL, MARKET_EXCHANGE_OPTIONS, getCoinMeta, getCoinSymbol, getMarketSymbolOptions } from '../constants/market'
import { useBootstrapTrading } from '../hooks/useBootstrapTrading'
import { useTradingStore } from '../stores/tradingStore'
import type { CreateRulePayload, ExchangeCode, MarketCandle, MarketTickerSnapshot, OrderSide, OrderType, TickerPrice, TriggerOperator } from '../types'
import { createMarketPriceSnapshot, eventTimestamp, shouldAcceptMarketPrice } from '../utils/marketPrice'
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

const ORDER_TYPE_OPTIONS: Array<{ label: string; value: OrderType }> = [
  { label: '市价', value: 'market' },
  { label: '限价', value: 'limit' },
]

const ORDER_SIDE_OPTIONS: Array<{ label: string; value: OrderSide }> = [
  { label: '买入', value: 'buy' },
  { label: '卖出', value: 'sell' },
]

const TRADING_MODE_OPTIONS = [
  { label: '模拟', value: true },
  { label: '真实', value: false },
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

function formatTickerTime(ticker?: TickerPrice) {
  if (!ticker?.eventTime) {
    return '-'
  }

  return new Date(ticker.eventTime).toLocaleTimeString()
}

function formatLivePrice(price?: string) {
  return price ? `${price} USDT` : '等待实时行情'
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

function buildRulePayload(values: Partial<CreateRulePayload>, row: MarketTickerSnapshot, currentPrice?: string): CreateRulePayload {
  const orderType = (values.orderType ?? 'market') as OrderType
  const side = (values.side ?? 'buy') as OrderSide
  const targetPrice = orderType === 'limit' ? values.targetPrice?.trim() || currentPrice || '' : currentPrice || ''
  const quoteAmount = side === 'buy' ? values.quoteAmount?.trim() || undefined : undefined
  const baseQuantity = side === 'sell' ? values.baseQuantity?.trim() || undefined : undefined

  return {
    exchange: (values.exchange ?? row.exchange) as ExchangeCode,
    symbol: row.symbol,
    // 简化交易计划入口中，买入默认等价于低于计划价触发，卖出默认等价于高于计划价触发。
    operator: (side === 'buy' ? 'lte' : 'gte') as TriggerOperator,
    targetPrice,
    checkIntervalMs: values.checkIntervalMs ?? 3000,
    side,
    orderType,
    quoteAmount,
    baseQuantity,
    // 普通限价计划使用同一个计划价格作为触发价格和委托限价；市价计划按当前价触发，后续仍走人工确认。
    limitPrice: orderType === 'limit' ? targetPrice : undefined,
    maxSlippagePercent: values.maxSlippagePercent?.trim() || '0.5',
    cooldownMs: values.cooldownMs ?? 60000,
    maxTriggerCount: values.maxTriggerCount ?? 1,
    simulationMode: values.simulationMode ?? true,
    enabled: true,
  }
}

function TradePlanDrawer({
  row,
  trigger,
  onCreated,
}: {
  row: MarketTickerSnapshot
  trigger: ReactElement
  onCreated: () => void
}) {
  const { message } = AntApp.useApp()
  const [selectedPlanExchange, setSelectedPlanExchange] = useState<ExchangeCode>(row.exchange)
  const liveTicker = useTradingStore(state => state.tickers.find(ticker => ticker.exchange === selectedPlanExchange && ticker.symbol === row.symbol))
  const snapshotTicker = selectedPlanExchange === row.exchange ? row : undefined
  const currentTicker = resolvePreferredTicker(snapshotTicker, liveTicker)
  const currentPrice = currentTicker?.price
  const currentPriceText = formatLivePrice(currentPrice)
  const coin = getCoinSymbol(row.symbol)

  return (
    <DrawerForm<Partial<CreateRulePayload>>
      title={`创建 ${row.symbol} 交易计划`}
      width={520}
      trigger={trigger}
      drawerProps={{ destroyOnHidden: true }}
      initialValues={{
        exchange: row.exchange,
        side: 'buy',
        orderType: 'market',
        maxSlippagePercent: '0.5',
        cooldownMs: 60000,
        checkIntervalMs: 3000,
        maxTriggerCount: 1,
        simulationMode: true,
      }}
      submitter={{
        searchConfig: {
          submitText: '创建交易计划',
        },
      }}
      onFinish={async values => {
        const orderType = (values.orderType ?? 'market') as OrderType
        if (orderType === 'market' && !currentPrice) {
          message.error('当前交易所还没有实时行情，暂不能创建市价计划')
          return false
        }

        await tradingApi.createRule(buildRulePayload(values, row, currentPrice))
        const submittedSide = values.side === 'sell' ? '卖出' : '买入'
        message.success(`${row.symbol} ${submittedSide}计划已创建`)
        onCreated()
        return true
      }}
    >
      <div className={styles.tradePlanMarketInfo}>
        <span>当前价</span>
        <strong>{currentPriceText}</strong>
        <span>更新时间 {formatTickerTime(currentTicker)}</span>
      </div>
      <ProFormSelect
        name='exchange'
        label='交易所'
        options={MARKET_EXCHANGE_OPTIONS}
        fieldProps={{
          onChange: exchange => setSelectedPlanExchange(exchange as ExchangeCode),
        }}
        rules={[{ required: true, message: '请选择交易所' }]}
      />
      <ProFormSelect
        name='side'
        label='交易方向'
        options={ORDER_SIDE_OPTIONS}
        rules={[{ required: true, message: '请选择交易方向' }]}
      />
      <ProFormSelect
        name='orderType'
        label='订单类型'
        options={ORDER_TYPE_OPTIONS}
        rules={[{ required: true, message: '请选择订单类型' }]}
      />
      <ProFormDependency name={['orderType', 'side']}>
        {({ orderType, side }) => {
          const dependencyIsBuy = side !== 'sell'
          const dependencyPlanPriceLabel = dependencyIsBuy ? '计划买入价' : '计划卖出价'
          const dependencyPlanPricePlaceholder = dependencyIsBuy
            ? `当前市价 ${currentPriceText}，价格到达或低于该价格时触发`
            : `当前市价 ${currentPriceText}，价格到达或高于该价格时触发`
          return (
          orderType === 'limit' ? (
            <ProFormText
              name='targetPrice'
              label={dependencyPlanPriceLabel}
              placeholder={dependencyPlanPricePlaceholder}
              rules={[{ required: true, message: `请输入${dependencyPlanPriceLabel}` }]}
            />
          ) : null
          )
        }}
      </ProFormDependency>
      <ProFormDependency name={['side']}>
        {({ side }) => {
          const dependencyIsBuy = side !== 'sell'
          const dependencyAmountFieldName = dependencyIsBuy ? 'quoteAmount' : 'baseQuantity'
          const dependencyAmountLabel = dependencyIsBuy ? '买入金额' : '卖出数量'
          const dependencyAmountPlaceholder = dependencyIsBuy ? `当前市价 ${currentPriceText}，输入计划投入金额` : `当前市价 ${currentPriceText}，输入计划卖出数量`
          return (
            <ProFormText
              name={dependencyAmountFieldName}
              label={dependencyAmountLabel}
              placeholder={dependencyAmountPlaceholder}
              fieldProps={{ suffix: dependencyIsBuy ? 'USDT' : coin }}
              rules={[{ required: true, message: `请输入${dependencyAmountLabel}` }]}
            />
          )
        }}
      </ProFormDependency>
      <ProFormSelect
        name='simulationMode'
        label='下单模式'
        options={TRADING_MODE_OPTIONS}
        rules={[{ required: true, message: '请选择下单模式' }]}
        extra='真实下单仍受后端总开关、风控配置和账户预检限制'
      />
      <ProCard title='高级策略' collapsible defaultCollapsed bordered={false} className={styles.tradePlanAdvancedCard}>
        <ProFormText name='maxSlippagePercent' label='最大滑点百分比' fieldProps={{ suffix: '%' }} rules={[{ required: true, message: '请输入最大滑点百分比' }]} />
        <ProFormDigit name='cooldownMs' label='冷却时间毫秒' min={1000} fieldProps={{ precision: 0 }} rules={[{ required: true, message: '请输入冷却时间' }]} />
        <ProFormDigit name='checkIntervalMs' label='检测频率毫秒' min={1000} fieldProps={{ precision: 0 }} rules={[{ required: true, message: '请输入检测频率' }]} />
        <ProFormDigit name='maxTriggerCount' label='最大触发次数' min={1} fieldProps={{ precision: 0 }} rules={[{ required: true, message: '请输入最大触发次数' }]} />
      </ProCard>
    </DrawerForm>
  )
}

function MarketOverviewTable({
  exchange,
  onSelectSymbol,
}: {
  exchange: ExchangeCode
  onSelectSymbol: (symbol: string) => void
}) {
  const { message } = AntApp.useApp()
  const refreshSummary = useTradingStore(state => state.refreshSummary)
  const realtimeTickers = useTradingStore(state => state.tickers)
  const [rows, setRows] = useState<MarketTickerSnapshot[]>([])
  const [loading, setLoading] = useState(false)

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const nextRows = await tradingApi.getMarketOverview(exchange)
      const realtimeTickerMap = useTradingStore
        .getState()
        .tickers
        .filter(ticker => ticker.exchange === exchange)
        .reduce<Record<string, TickerPrice>>((acc, ticker) => {
          acc[ticker.symbol] = ticker
          return acc
        }, {})

      setRows(nextRows.map(row => {
        const realtimeTicker = realtimeTickerMap[row.symbol]
        if (!realtimeTicker) {
          return row
        }

        return shouldAcceptMarketPrice(createMarketPriceSnapshot(row, 'rest'), createMarketPriceSnapshot(realtimeTicker, 'realtime'))
          ? { ...row, price: realtimeTicker.price, eventTime: realtimeTicker.eventTime }
          : row
      }))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '最新行情加载失败')
    } finally {
      setLoading(false)
    }
  }, [exchange, message])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    const tickerMap = realtimeTickers
      .filter(ticker => ticker.exchange === exchange)
      .reduce<Record<string, TickerPrice>>((acc, ticker) => {
        acc[ticker.symbol] = ticker
        return acc
      }, {})

    if (Object.keys(tickerMap).length === 0) {
      return
    }

    setRows(currentRows => {
      let changed = false
      const nextRows = currentRows.map(row => {
        const ticker = tickerMap[row.symbol]
        if (!ticker || !shouldAcceptMarketPrice(createMarketPriceSnapshot(row, 'rest'), createMarketPriceSnapshot(ticker, 'realtime'))) {
          return row
        }

        changed = true
        return {
          ...row,
          price: ticker.price,
          eventTime: ticker.eventTime,
        }
      })

      return changed ? nextRows : currentRows
    })
  }, [exchange, realtimeTickers])

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
          <Space size={4} className={styles.marketActionGroup}>
            <Tooltip title='查看走势'>
              <Button
                size='small'
                type='text'
                icon={<LineChartOutlined />}
                aria-label={`查看 ${row.symbol} 走势`}
                onClick={() => onSelectSymbol(row.symbol)}
              />
            </Tooltip>
            <TradePlanDrawer
              row={row}
              onCreated={() => void refreshSummary()}
              trigger={
                <Button size='small' type='text' className={styles.tradeActionButton} icon={<ThunderboltOutlined />} title='创建交易计划' aria-label={`创建 ${row.symbol} 交易计划`}>
                  交易
                </Button>
              }
            />
          </Space>
        ),
      },
    ],
    [onSelectSymbol, refreshSummary],
  )

  return (
    <ProTable<MarketTickerSnapshot>
      rowKey={row => `${row.exchange}-${row.symbol}`}
      className={styles.marketTable}
      columns={marketColumns}
      dataSource={rows}
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
      // REST 低频校准可能命中旧缓存，最新桶优先保留 WebSocket 推送数据，避免曲线回退。
      candleMap.set(candle.time, candle)
    }
  })

  return [...candleMap.values()]
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
    .slice(-CANDLE_POINT_LIMIT_BY_BAR[bar])
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
            <MarketOverviewTable exchange={selectedExchange} onSelectSymbol={handleSelectSymbol} />
          </ProCard>
        </Col>
      </Row>
    </PageContainer>
  )
}
