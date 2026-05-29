import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Tag } from 'antd'
import { Line } from '@ant-design/plots'
import { PageContainer, ProTable, StatisticCard, type ActionType, type ProColumns } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import { useProfitDisplay } from '../hooks/useProfitDisplay'
import type { TradeAccountSummary, TradeAccountType, TradeEquityHistoryPoint, TradePositionView } from '../types'
import { toTableRequestResult } from '../utils/proTable'
import styles from './page.module.scss'

const AUTO_REFRESH_INTERVAL_MS = 10000
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

export function TradePositionsPage() {
  const actionRef = useRef<ActionType | undefined>(undefined)
  const summaryRequestingRef = useRef(false)
  const profitDisplay = useProfitDisplay()
  const [summaries, setSummaries] = useState<TradeAccountSummary[]>([])
  const [equityHistory, setEquityHistory] = useState<TradeEquityHistoryPoint[]>([])

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

  const loadSummaries = useCallback(async () => {
    if (summaryRequestingRef.current) {
      return
    }

    summaryRequestingRef.current = true
    try {
      const [nextSummaries, nextEquityHistory] = await Promise.all([
        tradingApi.getTradeSummary(),
        tradingApi.getTradeEquityHistory(undefined, undefined, 30),
      ])
      setSummaries(nextSummaries)
      setEquityHistory(nextEquityHistory)
    } finally {
      summaryRequestingRef.current = false
    }
  }, [])

  useEffect(() => {
    loadSummaries()
  }, [loadSummaries])

  const reloadPageData = useCallback(() => {
    loadSummaries()
    actionRef.current?.reload()
  }, [loadSummaries])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        reloadPageData()
      }
    }

    // 持仓收益依赖交易所最新行情，页面可见时低频刷新，页面隐藏时暂停以减少行情请求压力。
    const timer = window.setInterval(refreshWhenVisible, AUTO_REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [reloadPageData])

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
        actionRef={actionRef}
        rowKey='id'
        search={false}
        columns={positionColumns}
        request={async () => toTableRequestResult(await tradingApi.getTradePositionValuations())}
        pagination={{ pageSize: 10 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} onClick={() => reloadPageData()}>
            刷新持仓
          </Button>,
        ]}
      />
    </PageContainer>
  )
}
