import { useMemo, useRef, useState, type ReactElement } from 'react'
import {
  App as AntApp,
  Button,
  Col,
  Drawer,
  Empty,
  Popconfirm,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd'
import {
  DrawerForm,
  PageContainer,
  ProDescriptions,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProTable,
  StatisticCard,
  type ActionType,
  type ProColumns,
  type ProDescriptionsItemProps,
} from '@ant-design/pro-components'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import { RuleRuntimeStatusTag, TriggerStatusTag } from '../components/StatusTag'
import { DEFAULT_MARKET_SYMBOL, MARKET_EXCHANGE_OPTIONS, getMarketSymbolOptions } from '../constants/market'
import { useBootstrapTrading } from '../hooks/useBootstrapTrading'
import { useTradingStore } from '../stores/tradingStore'
import type {
  AuditLog,
  CreateRulePayload,
  ExchangeCode,
  MarketHealth,
  MonitorRule,
  OrderRecord,
  OrderSide,
  OrderType,
  RiskCheck,
  RuleExecutionDetail,
  TradingSignal,
  TriggerEvent,
  TriggerOperator,
  UpdateRulePayload,
} from '../types'
import { toTableRequestResult } from '../utils/proTable'

const defaultRule: Partial<CreateRulePayload> = {
  exchange: 'okx',
  symbol: DEFAULT_MARKET_SYMBOL,
  operator: 'gte',
  targetPrice: '70000',
  checkIntervalMs: 3000,
  side: 'buy',
  orderType: 'market',
  quoteAmount: '50',
  maxSlippagePercent: '0.5',
  cooldownMs: 60000,
  maxTriggerCount: 1,
  simulationMode: true,
  enabled: true,
}

// 表单提示语继续对齐 OKX 和 Binance 现货下单语义，页面只做配置说明，真正计算以后端为准。
const RULE_FIELD_TOOLTIPS = {
  exchange: '选择行情和交易规则来源，当前支持 OKX 与 Binance',
  symbol: '交易对标识，例如 BTC-USDT；会按交易所支持列表校验',
  operator: '仅表示价格触发条件，常见用法是上涨提醒卖出，下跌提醒买入',
  targetPrice: '用于判断触发条件的目标价格，按计价币 USDT 输入',
  checkIntervalMs: '策略扫描间隔，数值越小请求越频繁，最低 1000 毫秒',
  side: '买入表示花费计价币；卖出表示出售基础币',
  orderType: '市价按市场成交；限价按指定价格成交',
  baseQuantity: '基础币数量，例如 BTC 数量',
  limitPrice: '限价单价格，市价单无需填写',
  maxSlippagePercent: '允许成交价偏离预估价的最大百分比',
  cooldownMs: '同一规则触发后的冷却时间，避免短时间重复触发',
  maxTriggerCount: '规则生命周期内最多生成多少次执行尝试',
  simulationMode: '模拟下单只写入本地订单记录，不发送真实交易请求',
  enabled: '启用后参与策略扫描，停用后不会继续触发',
} as const

type DescribedSelectOption<T extends string> = {
  label: ReactElement
  title: string
  value: T
  description: string
}

const ORDER_SIDE_OPTIONS: Array<{ label: string; value: OrderSide }> = [
  { label: '买入', value: 'buy' },
  { label: '卖出', value: 'sell' },
]

function SelectOptionLabel({ title, description }: { title: string; description: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
      <span>{title}</span>
      <span style={{ color: 'rgba(0, 0, 0, 0.45)', fontSize: 12, textAlign: 'right', flex: 1 }}>{description}</span>
    </span>
  )
}

function createDescribedOption<T extends string>(option: { title: string; value: T; description: string }): DescribedSelectOption<T> {
  return {
    ...option,
    label: <SelectOptionLabel title={option.title} description={option.description} />,
  }
}

const TRIGGER_OPERATOR_OPTIONS: Array<DescribedSelectOption<TriggerOperator>> = [
  createDescribedOption({ title: '上涨触发：市场价 >= 目标价', value: 'gte', description: '到达或高于目标价时触发' }),
  createDescribedOption({ title: '下跌触发：市场价 <= 目标价', value: 'lte', description: '到达或低于目标价时触发' }),
]

const ORDER_TYPE_OPTIONS: Array<DescribedSelectOption<OrderType>> = [
  createDescribedOption({ title: '市价', value: 'market', description: '按当前市场尽快成交' }),
  createDescribedOption({ title: '限价', value: 'limit', description: '按指定价格或更优价格成交' }),
]

const SUGGESTED_SIDE_BY_OPERATOR: Record<TriggerOperator, OrderSide> = {
  gte: 'sell',
  lte: 'buy',
}

const QUOTE_AMOUNT_LABEL_BY_SIDE: Record<OrderSide, string> = {
  buy: '投入金额',
  sell: '卖出金额',
}

const QUOTE_AMOUNT_TOOLTIP_BY_SIDE: Record<OrderSide, string> = {
  buy: '计划花费的 USDT 金额；金额和数量至少填写一个',
  sell: '按预估 USDT 价值卖出；金额和数量至少填写一个',
}

const auditLevelColorMap: Record<AuditLog['level'], string> = {
  info: 'blue',
  warning: 'orange',
  error: 'red',
}

const auditActionTextMap: Record<AuditLog['action'], string> = {
  'signal.created': '信号生成',
  'signal.converted': '信号转换',
  'signal.duplicated': '重复信号拦截',
  'risk.passed': '风控通过',
  'risk.rejected': '风控拒绝',
  'trigger.created': '触发生成',
  'trigger.confirmed': '触发执行',
  'trigger.failed': '触发失败',
  'trigger.ignored': '触发忽略',
  'order.submitted': '订单提交',
  'order.final_validation_failed': '最终校验失败',
  'order.failed': '订单失败',
  'strategy.error': '策略异常',
}

function getQuoteAmountLabel(side?: OrderSide) {
  return side ? QUOTE_AMOUNT_LABEL_BY_SIDE[side] : '交易金额'
}

function getQuoteAmountTooltip(side?: OrderSide) {
  return side ? QUOTE_AMOUNT_TOOLTIP_BY_SIDE[side] : '按 USDT 计价的交易金额；金额和数量至少填写一个'
}

function toRuleFormValues(rule: MonitorRule): UpdateRulePayload {
  return {
    exchange: rule.exchange,
    symbol: rule.symbol,
    operator: rule.operator,
    targetPrice: rule.targetPrice,
    checkIntervalMs: rule.checkIntervalMs,
    side: rule.side,
    orderType: rule.orderType,
    baseQuantity: rule.baseQuantity,
    quoteAmount: rule.quoteAmount,
    limitPrice: rule.limitPrice,
    maxSlippagePercent: rule.maxSlippagePercent,
    cooldownMs: rule.cooldownMs,
    maxTriggerCount: rule.maxTriggerCount,
    simulationMode: rule.simulationMode,
    enabled: rule.enabled,
  }
}

function normalizeRuleValues<T extends CreateRulePayload | UpdateRulePayload>(values: T): T {
  return {
    ...values,
    symbol: values.symbol.trim().toUpperCase(),
    baseQuantity: values.baseQuantity?.trim() || undefined,
    quoteAmount: values.quoteAmount?.trim() || undefined,
    limitPrice: values.orderType === 'limit' ? values.limitPrice?.trim() : undefined,
    targetPrice: values.targetPrice.trim(),
    maxSlippagePercent: values.maxSlippagePercent.trim(),
  }
}

function parseJsonArray<T>(value?: string): T[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function renderPayload(payloadJson?: string) {
  if (!payloadJson) {
    return '-'
  }

  try {
    return JSON.stringify(JSON.parse(payloadJson), null, 2)
  } catch {
    return payloadJson
  }
}

function RuleFormFields({ statusLabel }: { statusLabel: string }) {
  return (
    <>
      <Typography.Title level={5}>监控条件</Typography.Title>
      <ProFormSelect
        name='exchange'
        label='交易所'
        tooltip={RULE_FIELD_TOOLTIPS.exchange}
        options={MARKET_EXCHANGE_OPTIONS}
        rules={[{ required: true, message: '请选择交易所' }]}
      />
      <ProFormDependency name={['exchange']}>
        {({ exchange }) => (
          <ProFormSelect
            name='symbol'
            label='交易对'
            tooltip={RULE_FIELD_TOOLTIPS.symbol}
            options={getMarketSymbolOptions((exchange ?? 'okx') as ExchangeCode)}
            showSearch
            rules={[{ required: true, message: '请选择交易对' }]}
          />
        )}
      </ProFormDependency>
      <ProFormDependency name={['side']}>
        {(_, form) => (
          <ProFormSelect
            name='operator'
            label='触发方向'
            tooltip={RULE_FIELD_TOOLTIPS.operator}
            options={TRIGGER_OPERATOR_OPTIONS}
            fieldProps={{
              optionLabelProp: 'title',
              onChange: (operator: TriggerOperator) => {
                form.setFieldsValue({ side: SUGGESTED_SIDE_BY_OPERATOR[operator] })
              },
            }}
            rules={[{ required: true }]}
          />
        )}
      </ProFormDependency>
      <ProFormText name='targetPrice' label='目标价格' tooltip={RULE_FIELD_TOOLTIPS.targetPrice} rules={[{ required: true, message: '请输入目标价格' }]} />
      <ProFormDigit
        name='checkIntervalMs'
        label='检测频率毫秒'
        tooltip={RULE_FIELD_TOOLTIPS.checkIntervalMs}
        min={1000}
        fieldProps={{ precision: 0 }}
        rules={[{ required: true }]}
      />

      <Typography.Title level={5}>下单计划</Typography.Title>
      <ProFormSelect name='side' label='下单方向' tooltip={RULE_FIELD_TOOLTIPS.side} options={ORDER_SIDE_OPTIONS} rules={[{ required: true }]} />
      <ProFormSelect
        name='orderType'
        label='订单类型'
        tooltip={RULE_FIELD_TOOLTIPS.orderType}
        options={ORDER_TYPE_OPTIONS}
        fieldProps={{ optionLabelProp: 'title' }}
        rules={[{ required: true }]}
      />
      <ProFormDependency name={['orderType']}>
        {({ orderType }) =>
          orderType === 'limit' ? (
            <ProFormText
              name='limitPrice'
              label='限价价格'
              tooltip={RULE_FIELD_TOOLTIPS.limitPrice}
              rules={[{ required: true, message: '限价单必须填写限价价格' }]}
            />
          ) : null
        }
      </ProFormDependency>
      <ProFormDependency name={['baseQuantity', 'side']}>
        {({ baseQuantity, side }) => (
          <ProFormText
            name='quoteAmount'
            label={getQuoteAmountLabel(side as OrderSide | undefined)}
            tooltip={getQuoteAmountTooltip(side as OrderSide | undefined)}
            rules={[{ required: !baseQuantity, message: '交易金额和基础币数量至少填写一个' }]}
          />
        )}
      </ProFormDependency>
      <ProFormDependency name={['quoteAmount']}>
        {({ quoteAmount }) => (
          <ProFormText
            name='baseQuantity'
            label='基础币数量'
            tooltip={RULE_FIELD_TOOLTIPS.baseQuantity}
            rules={[{ required: !quoteAmount, message: '交易金额和基础币数量至少填写一个' }]}
          />
        )}
      </ProFormDependency>

      <Typography.Title level={5}>风控与运行</Typography.Title>
      <ProFormText
        name='maxSlippagePercent'
        label='最大滑点百分比'
        tooltip={RULE_FIELD_TOOLTIPS.maxSlippagePercent}
        fieldProps={{ suffix: '%' }}
        rules={[{ required: true }]}
      />
      <ProFormDigit
        name='cooldownMs'
        label='冷却时间毫秒'
        tooltip={RULE_FIELD_TOOLTIPS.cooldownMs}
        min={1000}
        fieldProps={{ precision: 0 }}
        rules={[{ required: true }]}
      />
      <ProFormDigit
        name='maxTriggerCount'
        label='最大触发次数'
        tooltip={RULE_FIELD_TOOLTIPS.maxTriggerCount}
        min={1}
        fieldProps={{ precision: 0 }}
        rules={[{ required: true }]}
      />
      <ProFormSelect
        name='simulationMode'
        label='下单模式'
        tooltip={RULE_FIELD_TOOLTIPS.simulationMode}
        options={[
          { label: '模拟下单', value: true },
          { label: '真实下单，需后端总开关允许', value: false },
        ]}
        rules={[{ required: true }]}
      />
      <ProFormSelect
        name='enabled'
        label={statusLabel}
        tooltip={RULE_FIELD_TOOLTIPS.enabled}
        options={[
          { label: '启用', value: true },
          { label: '停用', value: false },
        ]}
        rules={[{ required: true }]}
      />
    </>
  )
}

interface RuleDrawerFormProps<T extends CreateRulePayload | UpdateRulePayload> {
  title: string
  trigger: ReactElement
  initialValues: Partial<T>
  statusLabel: string
  onSubmit: (values: T) => Promise<void>
}

function RuleDrawerForm<T extends CreateRulePayload | UpdateRulePayload>({
  title,
  trigger,
  initialValues,
  statusLabel,
  onSubmit,
}: RuleDrawerFormProps<T>) {
  return (
    <DrawerForm<T>
      title={title}
      width={700}
      trigger={trigger}
      initialValues={initialValues}
      drawerProps={{
        destroyOnHidden: true,
      }}
      onFinish={async values => {
        await onSubmit(normalizeRuleValues(values))
        return true
      }}
    >
      <RuleFormFields statusLabel={statusLabel} />
    </DrawerForm>
  )
}

export function RulesPage() {
  useBootstrapTrading()
  const { message } = AntApp.useApp()
  const enabledRuleCount = useTradingStore(state => state.dashboardSummary.enabledRuleCount)
  const ruleCount = useTradingStore(state => state.dashboardSummary.ruleCount)
  const pendingTriggerCount = useTradingStore(state => state.dashboardSummary.pendingTriggerCount)
  const orderCount = useTradingStore(state => state.dashboardSummary.orderCount)
  const actionRef = useRef<ActionType | undefined>(undefined)
  const [togglingRuleId, setTogglingRuleId] = useState('')
  const [executionDrawerOpen, setExecutionDrawerOpen] = useState(false)
  const [executionLoading, setExecutionLoading] = useState(false)
  const [selectedRule, setSelectedRule] = useState<MonitorRule>()
  const [executionDetail, setExecutionDetail] = useState<RuleExecutionDetail>()

  const openExecutionDrawer = async (rule: MonitorRule) => {
    setSelectedRule(rule)
    setExecutionDrawerOpen(true)
    setExecutionLoading(true)
    try {
      const detail = await tradingApi.getRuleExecutionDetail(rule.id)
      setExecutionDetail(detail)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '执行详情加载失败')
    } finally {
      setExecutionLoading(false)
    }
  }

  const executionRule = executionDetail?.rule ?? selectedRule

  const ruleDescriptionColumns = useMemo<ProDescriptionsItemProps<MonitorRule>[]>(
    () => [
      { title: '交易所', dataIndex: 'exchange', render: (_, row) => <Tag>{row.exchange.toUpperCase()}</Tag> },
      { title: '交易对', dataIndex: 'symbol' },
      { title: '运行状态', dataIndex: 'runtimeStatus', render: (_, row) => <RuleRuntimeStatusTag status={row.runtimeStatus} /> },
      { title: '下单模式', dataIndex: 'simulationMode', render: (_, row) => <Tag color={row.simulationMode ? 'processing' : 'error'}>{row.simulationMode ? '模拟下单' : '真实下单'}</Tag> },
      { title: '触发条件', dataIndex: 'targetPrice', render: (_, row) => `${row.operator === 'gte' ? '>=' : '<='} ${row.targetPrice}` },
      { title: '下单计划', dataIndex: 'side', render: (_, row) => `${row.orderType === 'limit' ? '限价' : '市价'} / ${row.side === 'buy' ? '买入' : '卖出'}` },
      { title: '数量或金额', dataIndex: 'quoteAmount', render: (_, row) => (row.quoteAmount ? `${row.quoteAmount} USDT` : `${row.baseQuantity ?? '-'} 基础币`) },
      { title: '冷却时间', dataIndex: 'cooldownMs', render: (_, row) => `${row.cooldownMs} ms` },
      { title: '检测频率', dataIndex: 'checkIntervalMs', render: (_, row) => `${row.checkIntervalMs} ms` },
      { title: '触发次数', dataIndex: 'triggeredCount', render: (_, row) => `${row.triggeredCount}/${row.maxTriggerCount}` },
      { title: '最近检测', dataIndex: 'lastCheckedAt', valueType: 'dateTime', render: (_, row) => row.lastCheckedAt ?? '-' },
      { title: '最近触发', dataIndex: 'lastTriggeredAt', valueType: 'dateTime', render: (_, row) => row.lastTriggeredAt ?? '-' },
      { title: '最近错误', dataIndex: 'lastErrorMessage', span: 2, render: (_, row) => row.lastErrorMessage || '-' },
    ],
    [],
  )

  const marketHealthColumns = useMemo<ProDescriptionsItemProps<MarketHealth>[]>(
    () => [
      { title: '交易所', dataIndex: 'exchange', render: (_, row) => row.exchange.toUpperCase() },
      {
        title: 'REST 状态',
        dataIndex: 'restBackoffActive',
        render: (_, row) => <Tag color={row.restBackoffActive ? 'warning' : 'success'}>{row.restBackoffActive ? '退避中' : '正常'}</Tag>,
      },
      { title: '退避结束', dataIndex: 'restBackoffUntil', render: (_, row) => row.restBackoffUntil ?? '-' },
      { title: '总览刷新', dataIndex: 'overviewRefreshedAt', render: (_, row) => row.overviewRefreshedAt ?? '-' },
      {
        title: '订阅交易对',
        dataIndex: 'subscribedSymbols',
        span: 2,
        render: (_, row) => (
          <Space size={4} wrap>
            {row.subscribedSymbols.length > 0 ? row.subscribedSymbols.map(symbol => <Tag key={symbol}>{symbol}</Tag>) : <Tag>暂无订阅</Tag>}
          </Space>
        ),
      },
      { title: '最近 REST 错误', dataIndex: 'lastRestError', span: 2, render: (_, row) => row.lastRestError ?? '-' },
    ],
    [],
  )

  const signalColumns = useMemo<ProColumns<TradingSignal>[]>(
    () => [
      { title: '状态', dataIndex: 'status', width: 110, render: (_, row) => <Tag color={row.status === 'converted' ? 'success' : row.status === 'rejected' ? 'error' : 'processing'}>{row.status}</Tag> },
      { title: '方向', dataIndex: 'side', width: 90, render: (_, row) => <Tag color={row.side === 'buy' ? 'success' : 'warning'}>{row.side === 'buy' ? '买入' : '卖出'}</Tag> },
      { title: '类型', dataIndex: 'orderType', width: 90, render: (_, row) => (row.orderType === 'limit' ? '限价' : '市价') },
      { title: '市场价', dataIndex: 'marketPrice' },
      { title: '目标价', dataIndex: 'targetPrice' },
      { title: '原因', dataIndex: 'reason', ellipsis: true },
      { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
    ],
    [],
  )

  const riskColumns = useMemo<ProColumns<RiskCheck>[]>(
    () => [
      { title: '状态', dataIndex: 'status', width: 100, render: (_, row) => <Tag color={row.status === 'passed' ? 'success' : 'error'}>{row.status === 'passed' ? '通过' : '拒绝'}</Tag> },
      { title: '风险敞口', dataIndex: 'quoteExposure', render: (_, row) => `${row.quoteExposure} USDT` },
      { title: '市场价', dataIndex: 'marketPrice' },
      { title: '结论', dataIndex: 'reason', ellipsis: true },
      {
        title: '风控明细',
        dataIndex: 'itemsJson',
        render: (_, row) => (
          <Timeline
            items={parseJsonArray<Array<{ code: string; passed: boolean; message: string }> extends never ? never : { code: string; passed: boolean; message: string }>(row.itemsJson).map(item => ({
              color: item.passed ? 'green' : 'red',
              children: (
                <Space direction='vertical' size={2}>
                  <Tag color={item.passed ? 'success' : 'error'}>{item.passed ? '通过' : '拒绝'}</Tag>
                  <Typography.Text>{item.message}</Typography.Text>
                  <Typography.Text type='secondary'>{item.code}</Typography.Text>
                </Space>
              ),
            }))}
          />
        ),
      },
      { title: '检查时间', dataIndex: 'createdAt', valueType: 'dateTime' },
    ],
    [],
  )

  const triggerColumns = useMemo<ProColumns<TriggerEvent>[]>(
    () => [
      { title: '状态', dataIndex: 'status', width: 100, render: (_, row) => <TriggerStatusTag status={row.status} /> },
      { title: '市场价', dataIndex: 'marketPrice' },
      { title: '目标价', dataIndex: 'targetPrice' },
      { title: '触发时间', dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: '处理时间', dataIndex: 'confirmedAt', valueType: 'dateTime', render: (_, row) => row.confirmedAt ?? '-' },
    ],
    [],
  )

  const orderColumns = useMemo<ProColumns<OrderRecord>[]>(
    () => [
      { title: '状态', dataIndex: 'status', width: 120, render: (_, row) => <Tag color={row.status === 'filled' ? 'success' : row.status === 'failed' ? 'error' : 'processing'}>{row.status}</Tag> },
      { title: '方向', dataIndex: 'side', width: 90, render: (_, row) => <Tag color={row.side === 'buy' ? 'success' : 'warning'}>{row.side === 'buy' ? '买入' : '卖出'}</Tag> },
      { title: '订单类型', dataIndex: 'orderType', width: 90, render: (_, row) => (row.orderType === 'limit' ? '限价' : '市价') },
      { title: '基础币数量', dataIndex: 'baseQuantity', render: (_, row) => row.baseQuantity ?? '-' },
      { title: '计价币金额', dataIndex: 'quoteAmount', render: (_, row) => (row.quoteAmount ? `${row.quoteAmount} USDT` : '-') },
      { title: '委托价格', dataIndex: 'price', render: (_, row) => row.price ?? '-' },
      { title: '下单模式', dataIndex: 'simulationMode', render: (_, row) => <Tag color={row.simulationMode ? 'processing' : 'error'}>{row.simulationMode ? '模拟下单' : '真实下单'}</Tag> },
      { title: '订单号', dataIndex: 'exchangeOrderId', ellipsis: true },
      { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: '摘要', dataIndex: 'rawMessage', ellipsis: true },
    ],
    [],
  )

  const auditTimelineItems = useMemo(
    () =>
      [...(executionDetail?.auditLogs ?? [])]
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .map(log => ({
          color: auditLevelColorMap[log.level],
          children: (
            <Space direction='vertical' size={2}>
              <Space size={8} wrap>
                <Tag color={log.level === 'error' ? 'error' : log.level === 'warning' ? 'warning' : 'processing'}>{log.level}</Tag>
                <Tag>{auditActionTextMap[log.action]}</Tag>
                <Typography.Text type='secondary'>{new Date(log.createdAt).toLocaleString()}</Typography.Text>
              </Space>
              <Typography.Text>{log.message}</Typography.Text>
              {log.payloadJson ? (
                <Typography.Text type='secondary' style={{ whiteSpace: 'pre-wrap' }}>
                  {renderPayload(log.payloadJson)}
                </Typography.Text>
              ) : null}
            </Space>
          ),
        })),
    [executionDetail?.auditLogs],
  )

  const columns = useMemo<ProColumns<MonitorRule>[]>(
    () => [
      {
        title: '交易所',
        dataIndex: 'exchange',
        width: 96,
        render: (_, row) => <Tag>{row.exchange.toUpperCase()}</Tag>,
      },
      {
        title: '交易对',
        dataIndex: 'symbol',
        width: 130,
      },
      {
        title: '触发条件',
        dataIndex: 'targetPrice',
        render: (_, row) => `${row.operator === 'gte' ? '≥' : '≤'} ${row.targetPrice}`,
      },
      {
        title: '下单计划',
        dataIndex: 'side',
        render: (_, row) => `${row.orderType === 'market' ? '市价' : '限价'} / ${row.side === 'buy' ? '买入' : '卖出'}`,
      },
      {
        title: '数量或交易金额',
        dataIndex: 'quoteAmount',
        render: (_, row) => (row.quoteAmount ? `${row.quoteAmount} USDT` : `${row.baseQuantity ?? '-'} 基础币`),
      },
      {
        title: '已触发',
        dataIndex: 'triggeredCount',
        width: 100,
        render: (_, row) => `${row.triggeredCount}/${row.maxTriggerCount}`,
      },
      {
        title: '运行状态',
        dataIndex: 'runtimeStatus',
        width: 120,
        render: (_, row) => <RuleRuntimeStatusTag status={row.runtimeStatus} />,
      },
      {
        title: '最近错误',
        dataIndex: 'lastErrorMessage',
        ellipsis: true,
        render: (_, row) =>
          row.lastErrorMessage ? (
            <Tooltip title={row.lastErrorMessage}>
              <Typography.Text type='danger'>{row.lastErrorMessage}</Typography.Text>
            </Tooltip>
          ) : (
            '-'
          ),
      },
      {
        title: '检测频率',
        dataIndex: 'checkIntervalMs',
        render: (_, row) => `${row.checkIntervalMs} ms`,
      },
      {
        title: '模拟',
        dataIndex: 'simulationMode',
        width: 88,
        render: (_, row) => <Tag color={row.simulationMode ? 'processing' : 'error'}>{row.simulationMode ? '模拟' : '真实'}</Tag>,
      },
      {
        title: '启用状态',
        dataIndex: 'enabled',
        width: 120,
        render: (_, row) => (
          <Switch
            checked={row.enabled}
            checkedChildren='启用'
            unCheckedChildren='停用'
            loading={togglingRuleId === row.id}
            onChange={async checked => {
              setTogglingRuleId(row.id)
              try {
                await tradingApi.toggleRule(row.id, checked)
                message.success(checked ? '规则已启用' : '规则已停用')
                actionRef.current?.reload()
              } finally {
                setTogglingRuleId('')
              }
            }}
          />
        ),
      },
      {
        title: '操作',
        dataIndex: 'operate',
        valueType: 'option',
        fixed: 'right',
        width: 320,
        render: (_, row) => [
          <Button key='detail' type='link' onClick={() => void openExecutionDrawer(row)}>
            执行详情
          </Button>,
          <RuleDrawerForm<UpdateRulePayload>
            key='edit'
            title={`编辑规则 ${row.symbol}`}
            trigger={<Button type='link'>编辑</Button>}
            initialValues={toRuleFormValues(row)}
            statusLabel='编辑后状态'
            onSubmit={async values => {
              await tradingApi.updateRule(row.id, values)
              message.success('监控规则已更新')
              actionRef.current?.reload()
            }}
          />,
          <Popconfirm
            key='delete'
            title='删除监控规则'
            description='删除后不会影响已经生成的执行记录和订单记录'
            onConfirm={async () => {
              await tradingApi.deleteRule(row.id)
              message.success('规则已删除')
              actionRef.current?.reload()
            }}
          >
            <Button danger type='link'>
              删除
            </Button>
          </Popconfirm>,
        ],
      },
    ],
    [message, togglingRuleId],
  )

  return (
    <PageContainer subTitle='创建自动交易计划，查看后台信号、风控、触发、订单与审计全链路结果'>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <StatisticCard statistic={{ title: '启用规则', value: enabledRuleCount, suffix: `/ ${ruleCount}` }} />
        </Col>
        <Col xs={24} md={8}>
          <StatisticCard statistic={{ title: '待处理触发', value: pendingTriggerCount }} />
        </Col>
        <Col xs={24} md={8}>
          <StatisticCard statistic={{ title: '订单记录', value: orderCount }} />
        </Col>
      </Row>

      <ProTable<MonitorRule>
        actionRef={actionRef}
        rowKey='id'
        search={false}
        columns={columns}
        request={async () => toTableRequestResult(await tradingApi.getRules())}
        onReset={() => actionRef.current?.reload()}
        pagination={{ pageSize: 8 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>
            刷新
          </Button>,
          <RuleDrawerForm<CreateRulePayload>
            key='create'
            title='新增交易计划'
            trigger={
              <Button type='primary' icon={<PlusOutlined />}>
                新增规则
              </Button>
            }
            initialValues={defaultRule}
            statusLabel='创建后状态'
            onSubmit={async values => {
              await tradingApi.createRule(values)
              message.success('交易计划已创建')
              actionRef.current?.reload()
            }}
          />,
        ]}
      />

      <Drawer
        title={executionRule ? `执行详情 ${executionRule.symbol}` : '执行详情'}
        width={1320}
        open={executionDrawerOpen}
        onClose={() => {
          setExecutionDrawerOpen(false)
          setExecutionDetail(undefined)
          setSelectedRule(undefined)
        }}
      >
        {executionRule ? (
          <Space direction='vertical' size={16} style={{ width: '100%' }}>
            <ProDescriptions<MonitorRule> bordered loading={executionLoading} column={2} dataSource={executionRule} columns={ruleDescriptionColumns} />

            {executionDetail ? (
              <>
                <Typography.Title level={5} style={{ marginBottom: 0 }}>
                  执行时间线
                </Typography.Title>
                {auditTimelineItems.length > 0 ? (
                  <Timeline items={auditTimelineItems} />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='暂无审计记录' />
                )}

                <Typography.Title level={5} style={{ marginBottom: 0 }}>
                  信号记录
                </Typography.Title>
                <ProTable<TradingSignal>
                  rowKey='id'
                  search={false}
                  options={false}
                  toolBarRender={false}
                  columns={signalColumns}
                  dataSource={executionDetail.signals}
                  pagination={{ pageSize: 5 }}
                />

                <Typography.Title level={5} style={{ marginBottom: 0 }}>
                  风控记录
                </Typography.Title>
                <ProTable<RiskCheck>
                  rowKey='id'
                  search={false}
                  options={false}
                  toolBarRender={false}
                  columns={riskColumns}
                  dataSource={executionDetail.riskChecks}
                  pagination={{ pageSize: 5 }}
                />

                <Typography.Title level={5} style={{ marginBottom: 0 }}>
                  触发记录
                </Typography.Title>
                <ProTable<TriggerEvent>
                  rowKey='id'
                  search={false}
                  options={false}
                  toolBarRender={false}
                  columns={triggerColumns}
                  dataSource={executionDetail.triggers}
                  pagination={{ pageSize: 5 }}
                />

                <Typography.Title level={5} style={{ marginBottom: 0 }}>
                  订单记录
                </Typography.Title>
                <ProTable<OrderRecord>
                  rowKey='id'
                  search={false}
                  options={false}
                  toolBarRender={false}
                  columns={orderColumns}
                  dataSource={executionDetail.orders}
                  pagination={{ pageSize: 5 }}
                />

                <Typography.Title level={5} style={{ marginBottom: 0 }}>
                  行情健康
                </Typography.Title>
                <ProDescriptions<MarketHealth> bordered column={2} dataSource={executionDetail.marketHealth} columns={marketHealthColumns} />
                <Table
                  rowKey={row => `${row.exchange}-${row.symbol}`}
                  size='small'
                  pagination={{ pageSize: 6 }}
                  dataSource={executionDetail.marketHealth.tickers}
                  columns={[
                    { title: '交易对', dataIndex: 'symbol' },
                    { title: '价格', dataIndex: 'price' },
                    { title: '行情时间', dataIndex: 'eventTime' },
                    { title: '缓存年龄', dataIndex: 'ageMs', render: value => `${value} ms` },
                  ]}
                />
              </>
            ) : executionLoading ? null : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='暂无执行详情' />
            )}
          </Space>
        ) : null}
      </Drawer>
    </PageContainer>
  )
}
