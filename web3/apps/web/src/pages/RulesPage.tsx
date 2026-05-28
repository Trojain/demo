import { useMemo, useRef, useState, type ReactElement } from 'react'
import { App as AntApp, Button, Popconfirm, Switch, Tag, Tooltip, Typography } from 'antd'
import { DrawerForm, PageContainer, ProFormDependency, ProFormDigit, ProFormSelect, ProFormText, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import { RuleRuntimeStatusTag } from '../components/StatusTag'
import { DEFAULT_MARKET_SYMBOL, MARKET_EXCHANGE_OPTIONS, getMarketSymbolOptions } from '../constants/market'
import type { CreateRulePayload, ExchangeCode, MonitorRule, OrderSide, OrderType, TriggerOperator, UpdateRulePayload } from '../types'
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

// 表单提示语参考 OKX 与 Binance 现货下单字段，前端仅做展示说明，最终校验以后端为准。
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
  maxTriggerCount: '规则生命周期内最多生成多少次触发事件',
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

// 常见交易直觉：上涨到目标价更常用于卖出提醒，下跌到目标价更常用于买入提醒。
const SUGGESTED_SIDE_BY_OPERATOR: Record<TriggerOperator, OrderSide> = {
  gte: 'sell',
  lte: 'buy',
}

// quoteAmount 对应交易所的计价币金额，表单按买卖方向换成更易理解的中文名称。
const QUOTE_AMOUNT_LABEL_BY_SIDE: Record<OrderSide, string> = {
  buy: '投入金额',
  sell: '卖出金额',
}

const QUOTE_AMOUNT_TOOLTIP_BY_SIDE: Record<OrderSide, string> = {
  buy: '计划花费的 USDT 金额；金额和数量至少填写一个',
  sell: '按预估 USDT 价值卖出；金额和数量至少填写一个',
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
  const { message } = AntApp.useApp()
  const actionRef = useRef<ActionType | undefined>(undefined)
  const [togglingRuleId, setTogglingRuleId] = useState('')

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
        title: '检测频率',
        dataIndex: 'checkIntervalMs',
        render: (_, row) => `${row.checkIntervalMs} ms`,
      },
      {
        title: '最近检测',
        dataIndex: 'lastCheckedAt',
        width: 170,
        valueType: 'dateTime',
        render: (_, row) => (row.lastCheckedAt ? new Date(row.lastCheckedAt).toLocaleString() : '-'),
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
        width: 'auto',
        render: (_, row) => [
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
            description='删除后不会影响已经生成的触发和订单记录'
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
          row.lastErrorMessage ? (
            <Tooltip title={row.lastErrorMessage}>
              <Typography.Text type='danger'>错误</Typography.Text>
            </Tooltip>
          ) : null,
        ],
      },
    ],
    [message, togglingRuleId],
  )

  return (
    <PageContainer subTitle='配置价格触发条件、下单计划与运行开关'>
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
            title='新增监控规则'
            trigger={
              <Button type='primary' icon={<PlusOutlined />}>
                新增规则
              </Button>
            }
            initialValues={defaultRule}
            statusLabel='创建后状态'
            onSubmit={async values => {
              await tradingApi.createRule(values)
              message.success('监控规则已创建')
              actionRef.current?.reload()
            }}
          />,
        ]}
      />
    </PageContainer>
  )
}
