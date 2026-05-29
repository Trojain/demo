import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Tag } from 'antd'
import { Line } from '@ant-design/plots'
import { PageContainer, ProTable, StatisticCard, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { Decimal } from 'decimal.js'
import { tradingApi } from '../api/trading'
import { useProfitDisplay } from '../hooks/useProfitDisplay'
import { useTradingStore } from '../stores/tradingStore'
import type { TickerPrice, TradeAccount, TradeAccountSummary, TradeAccountType, TradeEquityHistoryPoint, TradePosition, TradePositionView } from '../types'
import { createMarketPriceSnapshot, mergeMarketPriceMap, tickerKey, type MarketPriceSnapshot } from '../utils/marketPrice'
import styles from './page.module.scss'

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

function buildAssetTrend(row: TradeAccountSummary, history: TradeEquityHistoryPoint[]) {
  const accountHistory = history.filter(item => item.accountId === row.accountId)
  if (accountHistory.length === 0) {
    return [{ date: formatDateLabel(row.calculatedAt.slice(0, 10)), value: numberValue(row.totalEquity) }]
  }

  return accountHistory.map(item => ({
    date: formatDateLabel(item.date),
    value: numberValue(item.totalEquity),
  }))
}

function buildVisibleAxisLabels(trend: Array<{ date: string; value: number }>) {
  return new Set(
    trend
      .filter((_, index) => index % ASSET_TREND_AXIS_LABEL_INTERVAL === 0)
      .map(item => item.date),
  )
}

function buildMarketPriceSnapshots(tickers: TickerPrice[], positionViews: TradePositionView[] = []) {
  return [
    ...positionViews.map(position =>
      createMarketPriceSnapshot(
        {
          exchange: position.exchange,
          symbol: position.symbol,
          price: position.marketPrice,
          eventTime: position.marketEventTime ?? '',
        },
        'valuation',
      ),
    ),
    ...tickers.map(ticker => createMarketPriceSnapshot(ticker, 'rest')),
  ]
}

function calculatePositionViews(positions: TradePosition[], latestPriceByKey: Record<string, MarketPriceSnapshot>): TradePositionView[] {
  return positions.map(position => {
    const marketPrice = latestPriceByKey[tickerKey(position)]?.price ?? '0'
    const marketValue = new Decimal(position.quantity).mul(marketPrice)
    const unrealizedPnl = marketValue.minus(position.costAmount)
    const costAmount = new Decimal(position.costAmount)
    const unrealizedPnlPercent = costAmount.isZero() ? new Decimal(0) : unrealizedPnl.div(costAmount).mul(100)

    return {
      ...position,
      marketPrice,
      marketValue: marketValue.toFixed(),
      unrealizedPnl: unrealizedPnl.toFixed(),
      unrealizedPnlPercent: unrealizedPnlPercent.toFixed(2),
    }
  })
}

function calculateSummaries(accounts: TradeAccount[], positionViews: TradePositionView[], calculatedAt: string): TradeAccountSummary[] {
  return accounts.map(account => {
    const accountPositions = positionViews.filter(position => position.accountId === account.id)
    const positionMarketValue = accountPositions.reduce((sum, position) => sum.plus(position.marketValue), new Decimal(0))
    const unrealizedPnl = accountPositions.reduce((sum, position) => sum.plus(position.unrealizedPnl), new Decimal(0))
    const realizedPnl = accountPositions.reduce((sum, position) => sum.plus(position.realizedPnl), new Decimal(0))
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

export function TradePositionsPage() {
  const loadingRef = useRef(false)
  const profitDisplay = useProfitDisplay()
  const realtimeTickers = useTradingStore(state => state.tickers)
  const [accounts, setAccounts] = useState<TradeAccount[]>([])
  const [positions, setPositions] = useState<TradePosition[]>([])
  const [equityHistory, setEquityHistory] = useState<TradeEquityHistoryPoint[]>([])
  const [latestPriceByKey, setLatestPriceByKey] = useState<Record<string, MarketPriceSnapshot>>({})
  const [calculatedAt, setCalculatedAt] = useState(() => new Date().toISOString())
  const [loading, setLoading] = useState(false)

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

  const loadPageData = useCallback(async () => {
    if (loadingRef.current) {
      return
    }

    loadingRef.current = true
    setLoading(true)
    try {
      const [nextAccounts, nextPositions, nextEquityHistory, nextPositionViews, nextTickers] = await Promise.all([
        tradingApi.getTradeAccounts(),
        tradingApi.getTradePositions(),
        tradingApi.getTradeEquityHistory(undefined, undefined, 30),
        tradingApi.getTradePositionValuations(),
        tradingApi.getTickers(),
      ])
      setAccounts(nextAccounts)
      setPositions(nextPositions)
      setEquityHistory(nextEquityHistory)
      const initialSnapshots = buildMarketPriceSnapshots(nextTickers, nextPositionViews)
      let latestAcceptedEventTime: string | undefined
      setLatestPriceByKey(current => {
        // 首屏和手动刷新也走统一合并规则，避免接口旧值覆盖掉已经收到的实时行情。
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
    void loadPageData()
  }, [loadPageData])

  useEffect(() => {
    if (realtimeTickers.length === 0) {
      return
    }

    const positionKeys = new Set(positions.map(position => tickerKey(position)))
    const matchedTickers = realtimeTickers.filter(ticker => positionKeys.has(tickerKey(ticker)))
    if (matchedTickers.length === 0) {
      return
    }

    let latestAcceptedEventTime: string | undefined
    setLatestPriceByKey(current => {
      const result = mergeMarketPriceMap(current, matchedTickers.map(ticker => createMarketPriceSnapshot(ticker, 'realtime')))
      latestAcceptedEventTime = result.latestAcceptedEventTime
      return result.changed ? result.nextMap : current
    })
    if (latestAcceptedEventTime) {
      setCalculatedAt(latestAcceptedEventTime)
    }
  }, [positions, realtimeTickers])

  return (
    <PageContainer subTitle='查看模拟和真实交易共用的账户总资产、持仓市值、浮动盈亏和已实现盈亏'>
      {summaries.length > 0 ? (
        <StatisticCard.Group className={styles.tradeSummaryCards} direction='row'>
          {summaries.map((row) => {
            const totalPnl = numberValue(row.totalPnl)
            const trendColor = totalPnl >= 0 ? '#1677ff' : '#f5222d'
            const assetTrend = buildAssetTrend(row, equityHistory)
            const visibleAxisLabels = buildVisibleAxisLabels(assetTrend)
            const firstAssetLabel = money(String(assetTrend[0]?.value ?? numberValue(row.totalEquity)), ` ${row.quoteCurrency}`)
            const lastAssetLabel = money(String(assetTrend[assetTrend.length - 1]?.value ?? numberValue(row.totalEquity)), ` ${row.quoteCurrency}`)

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
                chart={
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
                        title: (item) => item.date,
                        items: [{ channel: 'y', name: `总资产 ${row.quoteCurrency}` }],
                      }}
                      axis={{
                        x: {
                          tick: false,
                          title: false,
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
                }
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
        columns={positionColumns}
        dataSource={positionViews}
        loading={loading}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} loading={loading} onClick={() => void loadPageData()}>
            刷新持仓
          </Button>,
        ]}
      />
    </PageContainer>
  )
}
