import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Empty, Space, Tag } from 'antd'
import { Line } from '@ant-design/plots'
import { ProCard, ProTable, StatisticCard, type ProColumns } from '@ant-design/pro-components'
import { FileTextOutlined, ReloadOutlined } from '@ant-design/icons'
import { Decimal } from 'decimal.js'
import { tradingApi } from '../api/trading'
import { useProfitDisplay } from '../hooks/useProfitDisplay'
import { useTickerSnapshots } from '../hooks/useTickerSnapshot'
import type { TradeAccount, TradeAccountSummary, TradeAccountType, TradeEquityHistoryPoint, TradePosition, TradePositionView } from '../types'
import { createMarketPriceSnapshot, mergeMarketPriceMap, tickerKey, type MarketPriceSnapshot } from '../utils/marketPrice'
import styles from '../pages/page.module.scss'

const ASSET_TREND_AXIS_LABEL_INTERVAL = 6

function renderMode(mode: TradeAccountType) {
  return <Tag color={mode === 'simulation' ? 'processing' : 'error'}>{mode === 'simulation' ? '模拟下单' : '真实下单'}</Tag>
}

function money(value: string, suffix = ' USDT') {
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 })}${suffix}`
}

function numberValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function renderExchange(exchange: string) {
  return exchange === 'okx' ? '欧易' : exchange === 'binance' ? '币安' : exchange.toUpperCase()
}

function formatDateLabel(dateText: string) {
  return dateText.slice(5)
}

function buildVisibleAxisLabels(trend: Array<{ date: string; value: number }>) {
  return new Set(
    trend
      .filter((_, index) => index % ASSET_TREND_AXIS_LABEL_INTERVAL === 0)
      .map(item => item.date),
  )
}

function buildMarketPriceSnapshots(positionViews: TradePositionView[] = []) {
  return positionViews.map(position =>
    createMarketPriceSnapshot(
      {
        exchange: position.exchange,
        symbol: position.symbol,
        price: position.marketPrice,
        eventTime: position.marketEventTime ?? '',
      },
      'valuation',
    ),
  )
}

function calculatePositionViews(positions: TradePosition[], latestPriceByKey: Record<string, MarketPriceSnapshot>) {
  return positions.map(position => {
    const latestSnapshot = latestPriceByKey[tickerKey(position)]
    const marketPrice = latestSnapshot?.price ?? '0'
    const marketValue = new Decimal(position.quantity).mul(marketPrice)
    const unrealizedPnl = marketValue.minus(position.costAmount)
    const costAmount = new Decimal(position.costAmount)
    const unrealizedPnlPercent = costAmount.isZero() ? new Decimal(0) : unrealizedPnl.div(costAmount).mul(100)

    return {
      ...position,
      marketPrice,
      marketEventTime: latestSnapshot?.eventTime,
      marketValue: marketValue.toFixed(),
      unrealizedPnl: unrealizedPnl.toFixed(),
      unrealizedPnlPercent: unrealizedPnlPercent.toFixed(2),
    }
  })
}

function calculateSummaries(accounts: TradeAccount[], positionViews: TradePositionView[], calculatedAt: string): TradeAccountSummary[] {
  const accountPositionSummary = positionViews.reduce<Record<string, { positionMarketValue: Decimal; unrealizedPnl: Decimal; realizedPnl: Decimal }>>(
    (accumulator, position) => {
      const currentSummary = accumulator[position.accountId] ?? {
        positionMarketValue: new Decimal(0),
        unrealizedPnl: new Decimal(0),
        realizedPnl: new Decimal(0),
      }

      currentSummary.positionMarketValue = currentSummary.positionMarketValue.plus(position.marketValue)
      currentSummary.unrealizedPnl = currentSummary.unrealizedPnl.plus(position.unrealizedPnl)
      currentSummary.realizedPnl = currentSummary.realizedPnl.plus(position.realizedPnl)
      accumulator[position.accountId] = currentSummary
      return accumulator
    },
    {},
  )

  return accounts.map(account => {
    const accountSummary = accountPositionSummary[account.id] ?? {
      positionMarketValue: new Decimal(0),
      unrealizedPnl: new Decimal(0),
      realizedPnl: new Decimal(0),
    }
    const positionMarketValue = accountSummary.positionMarketValue
    const unrealizedPnl = accountSummary.unrealizedPnl
    const realizedPnl = accountSummary.realizedPnl
    const totalEquity = new Decimal(account.availableQuoteBalance).plus(account.lockedQuoteBalance).plus(positionMarketValue)
    const totalPnl = totalEquity.minus(account.initialEquity)
    const initialEquity = new Decimal(account.initialEquity)
    const totalPnlPercent = initialEquity.isZero() ? new Decimal(0) : totalPnl.div(initialEquity).mul(100)

    return {
      accountId: account.id,
      mode: account.accountType,
      exchange: account.exchange,
      quoteCurrency: account.quoteCurrency,
      initialEquity: account.initialEquity,
      availableQuoteBalance: account.availableQuoteBalance,
      lockedQuoteBalance: account.lockedQuoteBalance,
      positionMarketValue: positionMarketValue.toFixed(),
      totalEquity: totalEquity.toFixed(),
      realizedPnl: realizedPnl.toFixed(),
      unrealizedPnl: unrealizedPnl.toFixed(),
      totalPnl: totalPnl.toFixed(),
      totalPnlPercent: totalPnlPercent.toFixed(2),
      calculatedAt,
    }
  })
}

function buildAccountHistoryMap(history: TradeEquityHistoryPoint[]) {
  return history.reduce<Record<string, TradeEquityHistoryPoint[]>>((accumulator, item) => {
    if (!accumulator[item.accountId]) {
      accumulator[item.accountId] = []
    }

    accumulator[item.accountId].push(item)
    return accumulator
  }, {})
}

const AccountTrendChart = memo(function AccountTrendChart({
  fallbackEquity,
  history,
  quoteCurrency,
  trendColor,
}: {
  fallbackEquity?: string
  history: TradeEquityHistoryPoint[]
  quoteCurrency: string
  trendColor: string
}) {
  const assetTrend = useMemo(
    () =>
      history.length > 0
        ? history.map(item => ({
            date: formatDateLabel(item.date),
            value: numberValue(item.totalEquity),
          }))
        : [{ date: formatDateLabel(new Date().toISOString().slice(0, 10)), value: numberValue(fallbackEquity ?? '0') }],
    [fallbackEquity, history],
  )
  const visibleAxisLabels = useMemo(() => buildVisibleAxisLabels(assetTrend), [assetTrend])
  const firstAssetLabel = money(String(assetTrend[0]?.value ?? numberValue(fallbackEquity ?? '0')), ` ${quoteCurrency}`)
  const lastAssetLabel = money(String(assetTrend[assetTrend.length - 1]?.value ?? numberValue(fallbackEquity ?? '0')), ` ${quoteCurrency}`)

  return (
    <div className={styles.assetTrendChart}>
      <span className={styles.assetTrendStartLabel}>{firstAssetLabel}</span>
      <span className={styles.assetTrendEndLabel}>{lastAssetLabel}</span>
      <Line
        height={132}
        data={assetTrend}
        xField='date'
        yField='value'
        padding={[20, 12, 28, 12]}
        tooltip={{
          title: item => item.date,
          items: [{ channel: 'y', name: `总资产 ${quoteCurrency}` }],
        }}
        axis={{
          x: {
            tick: false,
            title: false,
            labelAutoRotate: false,
            labelSpacing: 12,
            labelFontSize: 11,
            labelFill: '#b8bec8',
            labelFormatter: (value: string) => (visibleAxisLabels.has(value) ? value : ''),
          },
          y: false,
        }}
        line={{ style: { stroke: trendColor, lineWidth: 2 } }}
        point={false}
      />
    </div>
  )
})

export function TradePortfolioOverviewSection() {
  const navigate = useNavigate()
  const loadingRef = useRef(false)
  const profitDisplay = useProfitDisplay()
  const [accounts, setAccounts] = useState<TradeAccount[]>([])
  const [positions, setPositions] = useState<TradePosition[]>([])
  const [equityHistory, setEquityHistory] = useState<TradeEquityHistoryPoint[]>([])
  const [latestPriceByKey, setLatestPriceByKey] = useState<Record<string, MarketPriceSnapshot>>({})
  const [calculatedAt, setCalculatedAt] = useState(() => new Date().toISOString())
  const [loading, setLoading] = useState(false)
  const positionKeys = useMemo(() => positions.map(position => tickerKey(position)), [positions])
  const realtimeTickerMap = useTickerSnapshots(positionKeys)
  const accountHistoryMap = useMemo(() => buildAccountHistoryMap(equityHistory), [equityHistory])

  const positionViews = useMemo(() => calculatePositionViews(positions, latestPriceByKey), [latestPriceByKey, positions])
  const summaries = useMemo(() => calculateSummaries(accounts, positionViews, calculatedAt), [accounts, calculatedAt, positionViews])

  const positionColumns = useMemo<ProColumns<TradePositionView>[]>(
    () => [
      { title: '下单模式', dataIndex: 'accountType', width: 110, render: (_, row) => renderMode(row.accountType) },
      { title: '交易所', dataIndex: 'exchange', width: 90, render: (_, row) => <Tag>{row.exchange.toUpperCase()}</Tag> },
      { title: '交易对', dataIndex: 'symbol', width: 120 },
      { title: '数量', dataIndex: 'quantity' },
      { title: '可卖数量', dataIndex: 'availableQuantity' },
      { title: '平均成本', dataIndex: 'avgCostPrice', render: (_, row) => money(row.avgCostPrice, ` ${row.quoteCurrency}`) },
      { title: '最新价', dataIndex: 'marketPrice', render: (_, row) => money(row.marketPrice, ` ${row.quoteCurrency}`) },
      { title: '持仓市值', dataIndex: 'marketValue', render: (_, row) => money(row.marketValue, ` ${row.quoteCurrency}`) },
      {
        title: '浮动盈亏',
        dataIndex: 'unrealizedPnl',
        render: (_, row) => profitDisplay.renderMoney(row.unrealizedPnl, row.quoteCurrency),
      },
      {
        title: '浮动收益率',
        dataIndex: 'unrealizedPnlPercent',
        render: (_, row) => profitDisplay.renderPercent(row.unrealizedPnlPercent),
      },
      { title: '已实现盈亏', dataIndex: 'realizedPnl', render: (_, row) => profitDisplay.renderMoney(row.realizedPnl, row.quoteCurrency) },
    ],
    [profitDisplay],
  )

  const loadSectionData = useCallback(async () => {
    if (loadingRef.current) {
      return
    }

    loadingRef.current = true
    setLoading(true)
    try {
      const [nextAccounts, nextEquityHistory, nextPositionViews] = await Promise.all([
        tradingApi.getTradeAccounts(),
        tradingApi.getTradeEquityHistory(undefined, undefined, 30),
        tradingApi.getTradePositionValuations(),
      ])
      setAccounts(nextAccounts)
      // 估值接口已包含完整持仓字段，首屏直接复用，减少一次重复请求。
      setPositions(nextPositionViews)
      setEquityHistory(nextEquityHistory)
      const initialSnapshots = buildMarketPriceSnapshots(nextPositionViews)
      let latestAcceptedEventTime: string | undefined
      setLatestPriceByKey(current => {
        // 首屏和手动刷新也走统一合并规则，避免估值接口旧值覆盖掉已经收到的实时行情。
        const result = mergeMarketPriceMap(current, initialSnapshots)
        latestAcceptedEventTime = result.latestAcceptedEventTime
        return result.changed ? result.nextMap : current
      })
      setCalculatedAt(current => latestAcceptedEventTime ?? current)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSectionData()
  }, [loadSectionData])

  useEffect(() => {
    const matchedTickers = Object.values(realtimeTickerMap)
    if (matchedTickers.length === 0) {
      return
    }

    let latestAcceptedEventTime: string | undefined
    setLatestPriceByKey(current => {
      // 持仓区块只消费当前持仓相关的实时行情，避免其他币种的推送拖着总览整页重算。
      const result = mergeMarketPriceMap(current, matchedTickers.map(ticker => createMarketPriceSnapshot(ticker, 'realtime')))
      latestAcceptedEventTime = result.latestAcceptedEventTime
      return result.changed ? result.nextMap : current
    })
    if (latestAcceptedEventTime) {
      setCalculatedAt(latestAcceptedEventTime)
    }
  }, [realtimeTickerMap])

  return (
    <ProCard
      title='持仓与资产'
      extra={
        <Space wrap>
          <Button icon={<FileTextOutlined />} onClick={() => navigate('/trade-logs?tab=fills')}>
            成交记录
          </Button>
          <Button icon={<FileTextOutlined />} onClick={() => navigate('/trade-logs?tab=logs')}>
            操作日志
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadSectionData()}>
            刷新持仓
          </Button>
        </Space>
      }
    >
      {summaries.length > 0 ? (
        <StatisticCard.Group className={styles.tradeSummaryCards} direction='row'>
          {summaries.map(row => {
            const totalPnl = numberValue(row.totalPnl)
            const trendColor = totalPnl >= 0 ? '#1677ff' : '#f5222d'
            const accountHistory = accountHistoryMap[row.accountId] ?? []

            return (
              <StatisticCard
                key={row.accountId}
                className={styles.tradeSummaryCard}
                title={
                  <div className={styles.tradeSummaryTitle}>
                    <span>{renderExchange(row.exchange)}账户汇总</span>
                    {renderMode(row.mode)}
                  </div>
                }
                statistic={{
                  title: '总资产',
                  value: numberValue(row.totalEquity),
                  precision: 4,
                  suffix: row.quoteCurrency,
                  description: (
                    <div className={styles.tradeSummaryDescription}>
                      <span>总收益 {profitDisplay.renderMoney(row.totalPnl, row.quoteCurrency)}</span>
                      <span>收益率 {profitDisplay.renderPercent(row.totalPnlPercent)}</span>
                    </div>
                  ),
                }}
                chart={<AccountTrendChart fallbackEquity={accountHistory.length === 0 ? row.totalEquity : undefined} history={accountHistory} quoteCurrency={row.quoteCurrency} trendColor={trendColor} />}
                footer={
                  <div className={styles.tradeSummaryMetrics}>
                    <span>可用余额：{money(row.availableQuoteBalance, ` ${row.quoteCurrency}`)}</span>
                    <span>冻结余额：{money(row.lockedQuoteBalance, ` ${row.quoteCurrency}`)}</span>
                    <span>初始本金：{money(row.initialEquity, ` ${row.quoteCurrency}`)}</span>
                    <span>持仓市值：{money(row.positionMarketValue, ` ${row.quoteCurrency}`)}</span>
                    <span>已实现盈亏：{profitDisplay.renderMoney(row.realizedPnl, row.quoteCurrency)}</span>
                    <span>浮动盈亏：{profitDisplay.renderMoney(row.unrealizedPnl, row.quoteCurrency)}</span>
                  </div>
                }
              />
            )
          })}
        </StatisticCard.Group>
      ) : (
        <div className={styles.tradeSummaryEmpty}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='暂无账户收益统计' />
        </div>
      )}

      <ProTable<TradePositionView>
        rowKey='id'
        search={false}
        options={false}
        columns={positionColumns}
        dataSource={positionViews}
        loading={loading}
        pagination={{ pageSize: 10 }}
        toolBarRender={false}
      />
    </ProCard>
  )
}
