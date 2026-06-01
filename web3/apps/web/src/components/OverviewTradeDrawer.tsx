import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App as AntApp, Button, Drawer, Input, InputNumber, Segmented, Select, Slider, Space, Tabs, Typography } from 'antd'
import { ProCard, ProForm, ProFormDependency, ProFormDigit, type ProFormInstance, ProFormSelect, ProFormText } from '@ant-design/pro-components'
import { Decimal } from 'decimal.js'
import { tradingApi } from '../api/trading'
import { MARKET_EXCHANGE_OPTIONS, getCoinSymbol } from '../constants/market'
import { useProfitDisplay } from '../hooks/useProfitDisplay'
import { useTickerSnapshot } from '../hooks/useTickerSnapshot'
import type {
  CreateRulePayload,
  ExchangeCode,
  InstrumentRule,
  OrderSide,
  OrderType,
  TickerPrice,
  TradeAccount,
  TradeAccountType,
  TradeOrderPayload,
  TradePosition,
  TriggerOperator,
} from '../types'
import { createMarketPriceSnapshot, eventTimestamp, shouldAcceptMarketPrice } from '../utils/marketPrice'
import styles from '../pages/page.module.scss'

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

const QUICK_TRADE_QUOTE_SCALE = 4
const QUICK_TRADE_QUOTE_STEP = new Decimal(`0.${'0'.repeat(QUICK_TRADE_QUOTE_SCALE - 1)}1`)

function formatTickerTime(ticker?: TickerPrice) {
  const timestamp = eventTimestamp(ticker?.eventTime)
  if (timestamp === undefined) {
    return '-'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

function formatTickerDelay(ticker?: TickerPrice) {
  const timestamp = eventTimestamp(ticker?.eventTime)
  if (timestamp === undefined) {
    return ''
  }

  const delaySeconds = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0)
  return delaySeconds <= 0 ? '延迟 0 秒' : `延迟 ${delaySeconds} 秒`
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

function buildRulePayload(values: Partial<CreateRulePayload>, row: TradeDrawerRow, currentPrice?: string): CreateRulePayload {
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

function formatTradeAmount(value?: string, digits = 4) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return '0'
  }

  return numberValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function parsePositiveDecimal(value?: string) {
  try {
    const decimalValue = new Decimal(value || '0')
    return decimalValue.greaterThan(0) ? decimalValue : new Decimal(0)
  } catch {
    return new Decimal(0)
  }
}

function normalizeQuickTradePercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, Number(value.toFixed(2))))
}

function normalizeQuickTradeAmount(value: number | null | undefined, maxAmount: Decimal) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  const decimalValue = new Decimal(value)
  const safeValue = decimalValue.lessThan(0) ? new Decimal(0) : decimalValue
  const clampedValue = safeValue.greaterThan(maxAmount) ? maxAmount : safeValue
  return Number(clampedValue.toDecimalPlaces(QUICK_TRADE_QUOTE_SCALE, Decimal.ROUND_DOWN).toFixed(QUICK_TRADE_QUOTE_SCALE))
}

function quoteAmountFromPercent(percent: number, maxAmount: Decimal) {
  if (!maxAmount.greaterThan(0)) {
    return 0
  }

  const normalizedPercent = normalizeQuickTradePercent(percent)
  if (normalizedPercent >= 100) {
    // 拖到 100% 时直接取当前可用上限，避免金额被截断后看起来卖不满。
    return Number(maxAmount.toDecimalPlaces(QUICK_TRADE_QUOTE_SCALE, Decimal.ROUND_DOWN).toFixed(QUICK_TRADE_QUOTE_SCALE))
  }

  return Number(maxAmount.mul(normalizedPercent).div(100).toDecimalPlaces(QUICK_TRADE_QUOTE_SCALE, Decimal.ROUND_DOWN).toFixed(QUICK_TRADE_QUOTE_SCALE))
}

function formatQuickTradePercent(value: number) {
  return `${Number(value.toFixed(2)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`
}

function parseInitialQuickTradeAmount(value?: string) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function floorDecimalToStep(value: Decimal, step?: string) {
  const decimalStep = parsePositiveDecimal(step)
  if (!decimalStep.greaterThan(0)) {
    return value
  }

  return value.div(decimalStep).floor().mul(decimalStep)
}

export interface TradeDrawerRow extends TickerPrice {
  /** 交易对实时总览表里带的附加行情字段，持仓卖出入口可为空。 */
  open24h?: string
  /** 交易对实时总览表里带的附加行情字段，持仓卖出入口可为空。 */
  changePercent24h?: string
  /** 交易对实时总览表里带的附加行情字段，持仓卖出入口可为空。 */
  volume24h?: string
  /** 交易对实时总览表里带的附加行情字段，持仓卖出入口可为空。 */
  volumeCurrency24h?: string
  /** 市值字段当前只用于最新行情表展示，持仓卖出入口不依赖。 */
  marketCap?: string
}

export interface TradeDrawerPreset {
  /** 指定快捷交易默认金额，单位 USDT。 */
  quickQuoteAmount?: string
  /** 指定交易账户模式，用于锁定模拟或真实仓位。 */
  quickMode?: TradeAccountType
  /** 持仓入口需要固定交易所，避免切走上下文。 */
  readonlyExchange?: boolean
  /** 持仓入口需要固定下单模式，避免切走上下文。 */
  readonlyMode?: boolean
  /** 持仓卖出入口只保留卖出动作。 */
  hideBuyAction?: boolean
  /** 持仓卖出入口不展示策略计划 Tab。 */
  hidePlanTab?: boolean
}

export function OverviewTradeDrawer({
  open,
  row,
  preset,
  onCreated,
  onOpenChange,
}: {
  open: boolean
  row?: TradeDrawerRow
  preset?: TradeDrawerPreset
  onCreated: () => void
  onOpenChange: (open: boolean) => void
}) {
  const { message, modal } = AntApp.useApp()
  const { getTrendMeta } = useProfitDisplay()
  const formRef = useRef<ProFormInstance<Partial<CreateRulePayload>> | undefined>(undefined)
  const quickDrawerSessionRef = useRef<string | undefined>(undefined)
  const instrumentRuleCacheRef = useRef(new Map<string, InstrumentRule | null>())
  const previousPriceRef = useRef<string | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<'quick' | 'plan'>('quick')
  const [selectedPlanExchange, setSelectedPlanExchange] = useState<ExchangeCode>(row?.exchange ?? 'okx')
  const [quickMode, setQuickMode] = useState<TradeAccountType>('simulation')
  const [quickOrderType, setQuickOrderType] = useState<OrderType>('market')
  const [quickQuoteAmount, setQuickQuoteAmount] = useState<number | null>(null)
  const [quickLimitPrice, setQuickLimitPrice] = useState('')
  const [quickAccounts, setQuickAccounts] = useState<TradeAccount[]>([])
  const [quickPositions, setQuickPositions] = useState<TradePosition[]>([])
  const [quickInstrumentRule, setQuickInstrumentRule] = useState<InstrumentRule>()
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickSubmitting, setQuickSubmitting] = useState(false)
  const [currentPriceDelta, setCurrentPriceDelta] = useState<string>('0')
  const [priceTrendDirection, setPriceTrendDirection] = useState<'up' | 'down'>('up')
  const liveTicker = useTickerSnapshot(selectedPlanExchange, row?.symbol)
  const snapshotTicker = row && selectedPlanExchange === row.exchange ? row : undefined
  const currentTicker = resolvePreferredTicker(snapshotTicker, liveTicker)
  const currentPrice = currentTicker?.price
  const currentPriceText = formatLivePrice(currentPrice)
  const coin = row ? getCoinSymbol(row.symbol) : ''
  const numericPriceDelta = Number(currentPriceDelta)
  const priceTrendMeta = getTrendMeta(
    Number.isFinite(numericPriceDelta) && numericPriceDelta !== 0 ? currentPriceDelta : priceTrendDirection === 'up' ? '1' : '-1',
  )
  const tickerDelayText = formatTickerDelay(currentTicker)
  const currentAccount = useMemo(
    () => quickAccounts.find(account => account.exchange === selectedPlanExchange && account.accountType === quickMode),
    [quickAccounts, quickMode, selectedPlanExchange],
  )
  const currentPosition = useMemo(
    () => quickPositions.find(position => position.exchange === selectedPlanExchange && position.accountType === quickMode && position.symbol === row?.symbol),
    [quickMode, quickPositions, row?.symbol, selectedPlanExchange],
  )
  const executionPrice = useMemo(() => {
    if (quickOrderType === 'limit') {
      const limitPrice = parsePositiveDecimal(quickLimitPrice)
      if (limitPrice.greaterThan(0)) {
        return limitPrice
      }
    }

    return parsePositiveDecimal(currentPrice)
  }, [currentPrice, quickLimitPrice, quickOrderType])
  const availableQuoteBalance = parsePositiveDecimal(currentAccount?.availableQuoteBalance)
  const availableBaseQuantity = parsePositiveDecimal(currentPosition?.availableQuantity)
  const availableSellQuoteAmount = availableBaseQuantity.mul(executionPrice)
  const planTabHidden = preset?.hidePlanTab ?? false
  const exchangeReadonly = preset?.readonlyExchange ?? false
  const modeReadonly = preset?.readonlyMode ?? false
  const buyActionHidden = preset?.hideBuyAction ?? false
  // 持仓卖出入口只按可卖市值计算百分比，避免买入余额把卖出滑杆比例拉歪。
  const quickTradeQuoteCapacity = buyActionHidden ? availableSellQuoteAmount : Decimal.max(availableQuoteBalance, availableSellQuoteAmount)
  const defaultQuickQuoteAmount = quoteAmountFromPercent(25, quickTradeQuoteCapacity)
  const requestedQuoteAmount = parsePositiveDecimal(String(quickQuoteAmount ?? defaultQuickQuoteAmount))
  const quickPercent = useMemo(() => {
    if (!quickTradeQuoteCapacity.greaterThan(0)) {
      return 0
    }

    if (quickTradeQuoteCapacity.minus(requestedQuoteAmount).abs().lessThanOrEqualTo(QUICK_TRADE_QUOTE_STEP)) {
      return 100
    }

    return normalizeQuickTradePercent(requestedQuoteAmount.div(quickTradeQuoteCapacity).mul(100).toNumber())
  }, [quickTradeQuoteCapacity, requestedQuoteAmount])
  // 卖出按交易所 lotSize 先向下取整，保证前端展示数量和后端实际校验口径一致。
  const requestedBaseQuantity = executionPrice.greaterThan(0)
    ? floorDecimalToStep(requestedQuoteAmount.div(executionPrice), quickInstrumentRule?.lotSize)
    : new Decimal(0)
  const canSubmitQuickTrade = requestedQuoteAmount.greaterThan(0) && executionPrice.greaterThan(0)
  const canQuickBuy = canSubmitQuickTrade && requestedQuoteAmount.lessThanOrEqualTo(availableQuoteBalance)
  const canQuickSell = canSubmitQuickTrade && requestedBaseQuantity.lessThanOrEqualTo(availableBaseQuantity)
  const quickDrawerSessionKey = row
    ? `${row.exchange}:${row.symbol}:${preset?.quickMode ?? ''}:${preset?.quickQuoteAmount ?? ''}:${buyActionHidden ? 'sell' : 'mixed'}`
    : undefined
  const quickTradeModeOptions = useMemo(
    () => [
      { label: '模拟', value: 'simulation' },
      { label: '真实', value: 'real' },
    ],
    [],
  )
  const quickPanelOrderTypeItems = useMemo(
    () => [
      { key: 'market', label: '市价委托' },
      { key: 'limit', label: '限价委托' },
    ],
    [],
  )

  const loadInstrumentRule = useCallback(async (exchange: ExchangeCode, symbol: string) => {
    const cacheKey = `${exchange}:${symbol}`
    if (instrumentRuleCacheRef.current.has(cacheKey)) {
      return instrumentRuleCacheRef.current.get(cacheKey) ?? undefined
    }

    const rules = await tradingApi.getTradingRules(exchange, symbol)
    const matchedRule = rules[0] ?? null
    instrumentRuleCacheRef.current.set(cacheKey, matchedRule)
    return matchedRule ?? undefined
  }, [])

  const loadQuickTradeContext = useCallback(async () => {
    if (!open || !row) {
      return
    }

    setQuickLoading(true)
    try {
      const [accounts, positions, instrumentRule] = await Promise.all([
        tradingApi.getTradeAccounts(quickMode),
        tradingApi.getTradePositions(quickMode, selectedPlanExchange),
        loadInstrumentRule(selectedPlanExchange, row.symbol),
      ])
      setQuickAccounts(accounts)
      setQuickPositions(positions)
      setQuickInstrumentRule(instrumentRule)
    } finally {
      setQuickLoading(false)
    }
  }, [loadInstrumentRule, open, quickMode, row, selectedPlanExchange])

  useEffect(() => {
    if (!open) {
      quickDrawerSessionRef.current = undefined
      return
    }

    if (!row || quickDrawerSessionKey == null || quickDrawerSessionRef.current === quickDrawerSessionKey) {
      return
    }

    quickDrawerSessionRef.current = quickDrawerSessionKey
    previousPriceRef.current = undefined
    setCurrentPriceDelta('0')
    // 每次打开新的交易会话时重置快捷交易面板，避免残留上一次输入和模式。
    setPriceTrendDirection('up')
    setActiveTab('quick')
    setSelectedPlanExchange(row.exchange)
    setQuickQuoteAmount(parseInitialQuickTradeAmount(preset?.quickQuoteAmount))
    setQuickOrderType('market')
    setQuickLimitPrice('')
    setQuickMode(preset?.quickMode ?? 'simulation')
    setQuickInstrumentRule(undefined)
  }, [open, preset?.quickMode, preset?.quickQuoteAmount, quickDrawerSessionKey, row])

  useEffect(() => {
    if (!open || quickQuoteAmount == null) {
      return
    }

    if (quickLoading && !quickTradeQuoteCapacity.greaterThan(0)) {
      return
    }

    const normalizedAmount = normalizeQuickTradeAmount(quickQuoteAmount, quickTradeQuoteCapacity)
    if (normalizedAmount !== quickQuoteAmount) {
      setQuickQuoteAmount(normalizedAmount)
    }
  }, [open, quickLoading, quickQuoteAmount, quickTradeQuoteCapacity])

  useEffect(() => {
    if (!open) {
      return
    }

    if (!currentPrice) {
      previousPriceRef.current = undefined
      setCurrentPriceDelta('0')
      return
    }

    const previousPrice = previousPriceRef.current
    if (!previousPrice) {
      previousPriceRef.current = currentPrice
      setCurrentPriceDelta('0')
      return
    }

    const nextDelta = (Number(currentPrice) - Number(previousPrice)).toFixed(8)
    previousPriceRef.current = currentPrice
    setCurrentPriceDelta(nextDelta)
    if (Number(nextDelta) > 0) {
      setPriceTrendDirection('up')
      return
    }

    if (Number(nextDelta) < 0) {
      setPriceTrendDirection('down')
    }
  }, [currentPrice, currentTicker?.eventTime, open])

  useEffect(() => {
    if (!open) {
      return
    }

    void loadQuickTradeContext()
  }, [loadQuickTradeContext, open])

  useEffect(() => {
    if (!open) {
      return
    }

    formRef.current?.setFieldsValue({ exchange: selectedPlanExchange })
  }, [open, selectedPlanExchange])

  const handleCreatePlan = async () => {
    await formRef.current?.submit?.()
  }

  const handleQuickPercentChange = (value?: number | null) => {
    const normalizedPercent = normalizeQuickTradePercent(value)
    setQuickQuoteAmount(quoteAmountFromPercent(normalizedPercent, quickTradeQuoteCapacity))
  }

  const handleQuickQuoteAmountChange = (value?: number | null) => {
    setQuickQuoteAmount(normalizeQuickTradeAmount(value, quickTradeQuoteCapacity))
  }

  const handleQuickTrade = async (side: OrderSide) => {
    if (!row) {
      return
    }

    if (!canSubmitQuickTrade) {
      message.error(quickOrderType === 'limit' ? '请先输入有效的限价价格和金额' : '请先等待实时价格并输入金额')
      return
    }

    if (side === 'buy' && !canQuickBuy) {
      message.error('买入金额已超过当前可用 USDT 余额')
      return
    }

    if (side === 'sell' && !canQuickSell) {
      message.error('卖出金额已超过当前可卖仓位对应的 USDT 市值')
      return
    }

    const payload: TradeOrderPayload = {
      mode: quickMode,
      exchange: selectedPlanExchange,
      symbol: row.symbol,
      side,
      orderType: quickOrderType,
      limitPrice: quickOrderType === 'limit' ? executionPrice.toFixed() : undefined,
      quoteAmount: side === 'buy' ? requestedQuoteAmount.toFixed(QUICK_TRADE_QUOTE_SCALE) : undefined,
      baseQuantity: side === 'sell' ? requestedBaseQuantity.toFixed() : undefined,
    }

    setQuickSubmitting(true)
    try {
      const preview = await tradingApi.previewTradeOrder(payload)
      const failedItems = preview.checkItems.filter(item => !item.passed)
      if (failedItems.length > 0 || !preview.passed) {
        modal.warning({
          title: `${side === 'buy' ? '买入' : '卖出'}预检未通过`,
          content: (
            <Space direction='vertical' size={8}>
              {failedItems.map(item => (
                <Typography.Text key={item.code} type='danger'>
                  {item.message}
                </Typography.Text>
              ))}
            </Space>
          ),
        })
        return
      }

      modal.confirm({
        title: `${side === 'buy' ? '确认买入' : '确认卖出'} ${row.symbol}`,
        content: (
          <Space direction='vertical' size={6}>
            <Typography.Text>模式：{quickMode === 'simulation' ? '模拟' : '真实'}</Typography.Text>
            <Typography.Text>交易所：{selectedPlanExchange === 'okx' ? '欧易' : '币安'}</Typography.Text>
            <Typography.Text>委托类型：{quickOrderType === 'market' ? '市价' : '限价'}</Typography.Text>
            <Typography.Text>执行参考价：{formatTradeAmount(preview.executionPrice, 6)} USDT</Typography.Text>
            <Typography.Text>基础币数量：{formatTradeAmount(preview.baseQuantity, 6)} {coin}</Typography.Text>
            <Typography.Text>计价币金额：≈ {formatTradeAmount(preview.quoteAmount, QUICK_TRADE_QUOTE_SCALE)} USDT</Typography.Text>
            <Typography.Text>成交后可用余额：{formatTradeAmount(preview.nextAvailableQuoteBalance, 4)} USDT</Typography.Text>
            <Typography.Text>成交后可卖数量：{formatTradeAmount(preview.nextAvailableBaseQuantity, 6)} {coin}</Typography.Text>
          </Space>
        ),
        okText: side === 'buy' ? '确认买入' : '确认卖出',
        cancelText: '取消',
        onOk: async () => {
          await tradingApi.confirmTradeOrder(payload)
          message.success(`${row.symbol} ${side === 'buy' ? '买入' : '卖出'}已提交`)
          onCreated()
          onOpenChange(false)
        },
      })
    } finally {
      setQuickSubmitting(false)
    }
  }

  if (!row) {
    return null
  }

  return (
    <Drawer title={`${row.symbol} 交易`} width={520} open={open} destroyOnHidden onClose={() => onOpenChange(false)}>
      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as 'quick' | 'plan')}
        items={[
          {
            key: 'quick',
            label: '快捷交易',
            children: (
              <Space direction='vertical' size={16} style={{ width: '100%' }}>
                <div className={styles.tradePlanMarketInfo}>
                  <span>当前价</span>
                  <Typography.Text className={styles.tradePlanLivePrice} style={{ color: priceTrendMeta.color }}>
                    {priceTrendMeta.Icon ? <priceTrendMeta.Icon className={styles.tradePlanLivePriceIcon} /> : null}
                    {currentPriceText}
                  </Typography.Text>
                  <span title={currentTicker?.eventTime ? new Date(currentTicker.eventTime).toLocaleString() : undefined}>
                    行情时间 {formatTickerTime(currentTicker)}
                    {tickerDelayText ? ` · ${tickerDelayText}` : ''}
                  </span>
                </div>

                <div className={styles.quickTradeTopRow}>
                  <div className={styles.quickTradeSelector}>
                    <Typography.Text type='secondary'>交易所</Typography.Text>
                    <Select
                      value={selectedPlanExchange}
                      options={MARKET_EXCHANGE_OPTIONS}
                      disabled={exchangeReadonly}
                      onChange={value => setSelectedPlanExchange(value as ExchangeCode)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className={styles.quickTradeSelector}>
                    <Typography.Text type='secondary'>下单模式</Typography.Text>
                    <Segmented block disabled={modeReadonly} value={quickMode} options={quickTradeModeOptions} onChange={value => setQuickMode(value as TradeAccountType)} />
                  </div>
                </div>

                <Tabs activeKey={quickOrderType} onChange={key => setQuickOrderType(key as OrderType)} items={quickPanelOrderTypeItems} className={styles.quickTradeOrderTabs} />

                {quickOrderType === 'limit' ? (
                  <div className={styles.quickTradeSelector}>
                    <Typography.Text type='secondary'>限价价格</Typography.Text>
                    <Input value={quickLimitPrice} onChange={event => setQuickLimitPrice(event.target.value)} suffix='USDT' placeholder={`当前市价 ${currentPriceText}`} />
                  </div>
                ) : null}

                <div className={styles.quickTradePanel}>
                  <div className={styles.quickTradeAmountHeader}>
                    <Typography.Text>数量（USDT）</Typography.Text>
                    <div className={styles.quickTradePercentBadge}>{formatQuickTradePercent(quickPercent)}</div>
                  </div>

                  <InputNumber
                    min={0}
                    max={Number(quickTradeQuoteCapacity.toFixed(QUICK_TRADE_QUOTE_SCALE))}
                    step={0.0001}
                    precision={4}
                    value={Number(requestedQuoteAmount.toFixed(QUICK_TRADE_QUOTE_SCALE))}
                    controls={false}
                    addonAfter={`≈ ${formatTradeAmount(requestedBaseQuantity.toFixed(), 6)} ${coin}`}
                    className={styles.quickTradeAmountInput}
                    onChange={value => handleQuickQuoteAmountChange(typeof value === 'string' ? Number(value) : value)}
                  />

                  <div className={styles.quickTradePercentControls}>
                    <Typography.Text type='secondary'>仓位百分比</Typography.Text>
                    <Typography.Text type='secondary'>{formatQuickTradePercent(quickPercent)}</Typography.Text>
                  </div>

                  <Slider
                    value={quickPercent}
                    min={0}
                    max={100}
                    step={0.01}
                    marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }}
                    onChange={value => handleQuickPercentChange(Array.isArray(value) ? value[0] : value)}
                  />

                  <div className={styles.quickTradeMetaRow}>
                    <span>买入可用 {formatTradeAmount(currentAccount?.availableQuoteBalance, 4)} {currentAccount?.quoteCurrency ?? 'USDT'}</span>
                    <span>卖出可用 {formatTradeAmount(availableSellQuoteAmount.toFixed(), QUICK_TRADE_QUOTE_SCALE)} {currentAccount?.quoteCurrency ?? 'USDT'}</span>
                    <span>当前输入 {formatTradeAmount(requestedQuoteAmount.toFixed(), QUICK_TRADE_QUOTE_SCALE)} {currentAccount?.quoteCurrency ?? 'USDT'}</span>
                  </div>

                  <div className={`${styles.quickTradeButtons} ${buyActionHidden ? styles.quickTradeButtonsSingle : ''}`.trim()}>
                    {buyActionHidden ? null : (
                      <Button block type='primary' className={styles.quickTradeBuyButton} loading={quickSubmitting} disabled={quickLoading || !canQuickBuy} onClick={() => void handleQuickTrade('buy')}>
                      <div className={styles.quickTradeButtonContent}>
                        <span>买入</span>
                        <small>≈ {formatTradeAmount(requestedQuoteAmount.toFixed(), QUICK_TRADE_QUOTE_SCALE)} USDT</small>
                      </div>
                    </Button>
                  )}
                  <Button block type='primary' className={styles.quickTradeSellButton} loading={quickSubmitting} disabled={quickLoading || !canQuickSell} onClick={() => void handleQuickTrade('sell')}>
                    <div className={styles.quickTradeButtonContent}>
                      <span>卖出</span>
                      <small>≈ {formatTradeAmount(requestedQuoteAmount.toFixed(), QUICK_TRADE_QUOTE_SCALE)} USDT</small>
                    </div>
                  </Button>
                </div>

                <div className={styles.quickTradeMetaGrid}>
                  <span>参考价格 {formatTradeAmount(executionPrice.toFixed(), 6)} USDT</span>
                  <span>当前约等于 {formatTradeAmount(requestedBaseQuantity.toFixed(), 6)} {coin}</span>
                  <span>买入上限 {formatTradeAmount(availableQuoteBalance.toFixed(), QUICK_TRADE_QUOTE_SCALE)} {currentAccount?.quoteCurrency ?? 'USDT'}</span>
                  <span>卖出上限 {formatTradeAmount(availableSellQuoteAmount.toFixed(), QUICK_TRADE_QUOTE_SCALE)} {currentAccount?.quoteCurrency ?? 'USDT'}</span>
                </div>

                  <Typography.Text type='secondary' className={styles.quickTradeHint}>
                    快捷交易会先走后端预检，再进入手动确认和模拟成交链路；真实交易仍受后端总开关和余额校验限制。
                  </Typography.Text>
                </div>
              </Space>
            ),
          },
          {
            key: 'plan',
            label: '策略计划',
            children: (
              <ProForm<Partial<CreateRulePayload>>
                key={`${row.exchange}-${row.symbol}`}
                formRef={formRef}
                layout='vertical'
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
                submitter={false}
                onFinish={async values => {
                  const orderType = (values.orderType ?? 'market') as OrderType
                  if (orderType === 'market' && !currentPrice) {
                    message.error('当前交易所还没有实时行情，暂不能创建市价计划')
                    return false
                  }

                  await tradingApi.createRule(buildRulePayload(values, row, currentPrice))
                  const submittedSide = values.side === 'sell' ? '卖出' : '买入'
                  message.success(`${row.symbol} ${submittedSide}计划已创建`)
                  formRef.current?.resetFields()
                  onCreated()
                  onOpenChange(false)
                  return true
                }}
              >
                <div className={styles.tradePlanMarketInfo}>
                  <span>当前价</span>
                  <Typography.Text className={styles.tradePlanLivePrice} style={{ color: priceTrendMeta.color }}>
                    {priceTrendMeta.Icon ? <priceTrendMeta.Icon className={styles.tradePlanLivePriceIcon} /> : null}
                    {currentPriceText}
                  </Typography.Text>
                  <span title={currentTicker?.eventTime ? new Date(currentTicker.eventTime).toLocaleString() : undefined}>
                    行情时间 {formatTickerTime(currentTicker)}
                    {tickerDelayText ? ` · ${tickerDelayText}` : ''}
                  </span>
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
                <ProFormSelect name='side' label='交易方向' options={ORDER_SIDE_OPTIONS} rules={[{ required: true, message: '请选择交易方向' }]} />
                <ProFormSelect name='orderType' label='订单类型' options={ORDER_TYPE_OPTIONS} rules={[{ required: true, message: '请选择订单类型' }]} />
                <ProFormDependency name={['orderType', 'side']}>
                  {({ orderType, side }) => {
                    const dependencyIsBuy = side !== 'sell'
                    const dependencyPlanPriceLabel = dependencyIsBuy ? '计划买入价' : '计划卖出价'
                    const dependencyPlanPricePlaceholder = dependencyIsBuy
                      ? `当前市价 ${currentPriceText}，价格到达或低于该价格时触发`
                      : `当前市价 ${currentPriceText}，价格到达或高于该价格时触发`
                    return orderType === 'limit' ? (
                      <ProFormText
                        name='targetPrice'
                        label={dependencyPlanPriceLabel}
                        placeholder={dependencyPlanPricePlaceholder}
                        rules={[{ required: true, message: `请输入${dependencyPlanPriceLabel}` }]}
                      />
                    ) : null
                  }}
                </ProFormDependency>
                <ProFormDependency name={['side']}>
                  {({ side }) => {
                    const dependencyIsBuy = side !== 'sell'
                    const dependencyAmountFieldName = dependencyIsBuy ? 'quoteAmount' : 'baseQuantity'
                    const dependencyAmountLabel = dependencyIsBuy ? '买入金额' : '卖出数量'
                    const dependencyAmountPlaceholder = dependencyIsBuy
                      ? `当前市价 ${currentPriceText}，输入计划投入金额`
                      : `当前市价 ${currentPriceText}，输入计划卖出数量`
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

                <div className={styles.tradePlanFooter}>
                  <Button
                    onClick={() => {
                      formRef.current?.resetFields()
                      onOpenChange(false)
                    }}
                  >
                    取消
                  </Button>
                  <Button type='primary' onClick={() => void handleCreatePlan()}>
                    创建交易计划
                  </Button>
                </div>
              </ProForm>
            ),
          },
        ].filter(item => !planTabHidden || item.key !== 'plan')}
      />
    </Drawer>
  )
}
