import { useEffect, useState } from 'react'
import { App as AntApp, Button, Popconfirm, Space, Switch, Tag, Tooltip, Typography } from 'antd'
import { ModalForm, PageContainer, ProFormDigit, ProFormSelect, ProFormText, ProTable, type ProColumns } from '@ant-design/pro-components'
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { tradingApi } from '../api/trading'
import { BooleanTag, RuleRuntimeStatusTag } from '../components/StatusTag'
import { useTradingStore } from '../stores/tradingStore'
import type { CreateRulePayload, MonitorRule, UpdateRulePayload } from '../types'
import styles from './page.module.scss'

const defaultRule: Partial<CreateRulePayload> = {
  exchange: 'okx',
  symbol: 'BTC-USDT',
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

function RuleFormFields({ statusLabel }: { statusLabel: string }) {
  return (
    <>
      <ProFormSelect
        name='exchange'
        label='交易所'
        options={[
          { label: 'OKX', value: 'okx' },
          { label: 'Binance', value: 'binance' },
        ]}
        rules={[{ required: true, message: '请选择交易所' }]}
      />
      <ProFormText name='symbol' label='交易对' tooltip='建议使用 BTC-USDT 格式' rules={[{ required: true, message: '请输入交易对' }]} />
      <ProFormSelect
        name='operator'
        label='触发方向'
        options={[
          { label: '市场价大于等于目标价', value: 'gte' },
          { label: '市场价小于等于目标价', value: 'lte' },
        ]}
        rules={[{ required: true }]}
      />
      <ProFormText name='targetPrice' label='目标价格' rules={[{ required: true, message: '请输入目标价格' }]} />
      <ProFormDigit name='checkIntervalMs' label='检测频率毫秒' min={1000} fieldProps={{ precision: 0 }} rules={[{ required: true }]} />
      <ProFormSelect
        name='side'
        label='下单方向'
        options={[
          { label: '买入', value: 'buy' },
          { label: '卖出', value: 'sell' },
        ]}
        rules={[{ required: true }]}
      />
      <ProFormSelect
        name='orderType'
        label='订单类型'
        options={[
          { label: '市价', value: 'market' },
          { label: '限价', value: 'limit' },
        ]}
        rules={[{ required: true }]}
      />
      <ProFormText name='quoteAmount' label='计价币金额' tooltip='例如用 50 USDT 买入 BTC' />
      <ProFormText name='baseQuantity' label='基础币数量' tooltip='例如卖出 0.01 BTC' />
      <ProFormText name='limitPrice' label='限价价格' />
      <ProFormText name='maxSlippagePercent' label='最大滑点百分比' rules={[{ required: true }]} />
      <ProFormDigit name='cooldownMs' label='冷却时间毫秒' min={1000} fieldProps={{ precision: 0 }} rules={[{ required: true }]} />
      <ProFormDigit name='maxTriggerCount' label='最大触发次数' min={1} fieldProps={{ precision: 0 }} rules={[{ required: true }]} />
      <ProFormSelect
        name='simulationMode'
        label='下单模式'
        options={[
          { label: '模拟下单', value: true },
          { label: '真实下单，需后端总开关允许', value: false },
        ]}
        rules={[{ required: true }]}
      />
      <ProFormSelect
        name='enabled'
        label={statusLabel}
        options={[
          { label: '启用', value: true },
          { label: '停用', value: false },
        ]}
        rules={[{ required: true }]}
      />
    </>
  )
}

export function RulesPage() {
  const { message } = AntApp.useApp()
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const rules = useTradingStore(state => state.rules)
  const loading = useTradingStore(state => state.loading)
  const refreshAll = useTradingStore(state => state.refreshAll)

  useEffect(() => {
    if (ruleModalOpen) {
      return
    }

    const timer = window.setInterval(() => {
      void refreshAll()
    }, 5000)

    return () => window.clearInterval(timer)
  }, [refreshAll, ruleModalOpen])

  const columns: ProColumns<MonitorRule>[] = [
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
      render: (_, row) => `${row.side === 'buy' ? '买入' : '卖出'} / ${row.orderType === 'market' ? '市价' : '限价'}`,
    },
    {
      title: '数量或金额',
      dataIndex: 'quoteAmount',
      render: (_, row) => (row.quoteAmount ? `${row.quoteAmount} 计价币` : `${row.baseQuantity ?? '-'} 基础币`),
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
      title: '状态',
      dataIndex: 'enabled',
      width: 120,
      render: (_, row) => <BooleanTag value={row.enabled} />,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 240,
      render: (_, row) => (
        <Space>
          <ModalForm<UpdateRulePayload>
            title={`编辑规则 ${row.symbol}`}
            trigger={
              <Button type='link' size='small' icon={<EditOutlined />}>
                编辑
              </Button>
            }
            initialValues={toRuleFormValues(row)}
            modalProps={{
              destroyOnHidden: true,
              afterOpenChange: setRuleModalOpen,
            }}
            onFinish={async values => {
              await tradingApi.updateRule(row.id, values)
              message.success('监控规则已更新')
              await refreshAll()
              return true
            }}
          >
            <RuleFormFields statusLabel='编辑后状态' />
          </ModalForm>
          <Switch
            checked={row.enabled}
            size='small'
            onChange={async checked => {
              await tradingApi.toggleRule(row.id, checked)
              message.success(checked ? '规则已启用' : '规则已停用')
              await refreshAll()
            }}
          />
          <Popconfirm
            title='删除监控规则'
            description='删除后不会影响已经生成的触发和订单记录'
            onConfirm={async () => {
              await tradingApi.deleteRule(row.id)
              message.success('规则已删除')
              await refreshAll()
            }}
          >
            <Button danger type='link' size='small'>
              删除
            </Button>
          </Popconfirm>
          {row.lastErrorMessage ? (
            <Tooltip title={row.lastErrorMessage}>
              <Typography.Text type='danger'>错误</Typography.Text>
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <PageContainer>
      <ProTable<MonitorRule>
        rowKey='id'
        search={false}
        loading={loading}
        columns={columns}
        dataSource={rules}
        pagination={{ pageSize: 8 }}
        toolBarRender={() => [
          <Button key='reload' icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
            刷新
          </Button>,
          <ModalForm<CreateRulePayload>
            key='create'
            title='新增监控规则'
            trigger={
              <Button type='primary' icon={<PlusOutlined />}>
                新增规则
              </Button>
            }
            initialValues={defaultRule}
            modalProps={{
              destroyOnHidden: true,
              afterOpenChange: setRuleModalOpen,
            }}
            onFinish={async values => {
              await tradingApi.createRule(values)
              message.success('监控规则已创建')
              await refreshAll()
              return true
            }}
          >
            <RuleFormFields statusLabel='创建后状态' />
          </ModalForm>,
        ]}
      />
    </PageContainer>
  )
}
