import { useEffect, useRef, useState } from 'react'
import { App as AntApp, Button, Space, Table, Tag } from 'antd'
import { PageContainer, ProCard, ProForm, ProFormDigit, ProFormSelect, ProFormText, StatisticCard, type ProFormInstance } from '@ant-design/pro-components'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import axios from 'axios'
import { tradingApi } from '../api/trading'
import type { DailyRiskStats, UpdateRiskConfigPayload } from '../types'

export function RiskConfigPage() {
  const { message } = AntApp.useApp()
  const formRef = useRef<ProFormInstance<UpdateRiskConfigPayload> | undefined>(undefined)
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')
  const [dailyStats, setDailyStats] = useState<DailyRiskStats[]>([])
  const [configSnapshot, setConfigSnapshot] = useState<UpdateRiskConfigPayload>()

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      return error.response?.data?.message ?? error.message
    }

    return error instanceof Error ? error.message : '操作失败'
  }

  const handleFormFinish = async (values: UpdateRiskConfigPayload) => {
    setSaving(true)
    try {
      const config = await tradingApi.updateRiskConfig(values)
      setUpdatedAt(config.updatedAt)
      setConfigSnapshot({
        maxQuoteAmount: config.maxQuoteAmount,
        maxMarketAgeMs: config.maxMarketAgeMs,
        dailyMaxTriggerCount: config.dailyMaxTriggerCount,
        dailyMaxQuoteAmount: config.dailyMaxQuoteAmount,
        tradingMode: config.tradingMode,
      })
      message.success('风控配置已保存')
      setReloadKey(value => value + 1)
      return true
    } catch (error) {
      message.error(getErrorMessage(error))
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = () => {
    formRef.current?.submit?.()
  }

  const handleCancel = () => {
    formRef.current?.resetFields()
  }

  const handleReload = () => {
    setReloadKey(value => value + 1)
  }

  useEffect(() => {
    void (async () => {
      try {
        const result = await tradingApi.getDailyRiskStats(7)
        setDailyStats(result.items)
      } catch (error) {
        message.error(getErrorMessage(error))
      }
    })()
  }, [message, reloadKey])

  const todayStats = dailyStats[0]

  return (
    <PageContainer subTitle='配置交易金额、行情时效、日内次数和交易模式限制'>
      <ProCard title='日维度风控统计' style={{ marginBottom: 16 }}>
        <Space direction='vertical' size={16} style={{ width: '100%' }}>
          <Space size={16} wrap style={{ width: '100%' }}>
            <StatisticCard
              statistic={{
                title: '今日已通过次数',
                value: todayStats?.passedCount ?? 0,
                suffix: ` / ${configSnapshot?.dailyMaxTriggerCount ?? '-'}`
              }}
            />
            <StatisticCard
              statistic={{
                title: '今日已通过金额',
                value: todayStats?.passedQuoteAmount ?? '0',
                suffix: ` / ${configSnapshot?.dailyMaxQuoteAmount ?? '-'} USDT`
              }}
            />
            <StatisticCard
              statistic={{
                title: '今日拒绝次数',
                value: todayStats?.rejectedCount ?? 0
              }}
            />
          </Space>
          <Table<DailyRiskStats>
            rowKey='statDate'
            size='small'
            pagination={false}
            dataSource={dailyStats}
            columns={[
              { title: '日期', dataIndex: 'statDate' },
              { title: '通过次数', dataIndex: 'passedCount' },
              { title: '通过金额', dataIndex: 'passedQuoteAmount', render: value => `${value} USDT` },
              { title: '拒绝次数', dataIndex: 'rejectedCount' },
              { title: '拒绝金额', dataIndex: 'rejectedQuoteAmount', render: value => `${value} USDT` },
              { title: '总次数', dataIndex: 'totalCount' },
            ]}
          />
        </Space>
      </ProCard>
      <ProCard
        title='风控配置'
        extra={
          <Space>
            {updatedAt ? <Tag>更新于 {updatedAt}</Tag> : null}
            <Button icon={<ReloadOutlined />} onClick={handleReload}>
              刷新
            </Button>
          </Space>
        }
      >
        <ProForm<UpdateRiskConfigPayload>
          formRef={formRef}
          layout='vertical'
          onFinish={handleFormFinish}
          initialValues={{}}
          params={{ reloadKey }}
          request={async () => {
            const config = await tradingApi.getRiskConfig()
            setUpdatedAt(config.updatedAt)
            setConfigSnapshot({
              maxQuoteAmount: config.maxQuoteAmount,
              maxMarketAgeMs: config.maxMarketAgeMs,
              dailyMaxTriggerCount: config.dailyMaxTriggerCount,
              dailyMaxQuoteAmount: config.dailyMaxQuoteAmount,
              tradingMode: config.tradingMode,
            })

            return {
              maxQuoteAmount: config.maxQuoteAmount,
              maxMarketAgeMs: config.maxMarketAgeMs,
              dailyMaxTriggerCount: config.dailyMaxTriggerCount,
              dailyMaxQuoteAmount: config.dailyMaxQuoteAmount,
              tradingMode: config.tradingMode,
            }
          }}
          style={{ maxWidth: 720 }}
          submitter={{
            render: () => (
              <div className='form-footer'>
                <Space>
                  <Button onClick={handleCancel}>取消</Button>
                  <Button type='primary' icon={<SaveOutlined />} loading={saving} onClick={handleSubmit}>
                    保存配置
                  </Button>
                </Space>
              </div>
            ),
          }}
        >
          <ProFormText
            name='maxQuoteAmount'
            label='单笔最大计价金额'
            rules={[{ required: true, message: '请输入单笔最大计价金额' }]}
            tooltip='单位按交易对计价币理解，当前 USDT 交易对可视为 USDT。'
            fieldProps={{ suffix: 'USDT' }}
          />
          <ProFormDigit
            name='dailyMaxTriggerCount'
            label='每日最大通过风控次数'
            rules={[{ required: true, message: '请输入每日最大通过风控次数' }]}
            min={1}
            fieldProps={{ precision: 0 }}
          />
          <ProFormText
            name='dailyMaxQuoteAmount'
            label='每日最大通过风控计价金额'
            rules={[{ required: true, message: '请输入每日最大通过风控计价金额' }]}
            fieldProps={{ suffix: 'USDT' }}
          />
          <ProFormDigit
            name='maxMarketAgeMs'
            label='行情最大允许延迟'
            rules={[{ required: true, message: '请输入行情最大允许延迟' }]}
            min={1000}
            fieldProps={{ precision: 0, addonAfter: 'ms' }}
          />
          <ProFormSelect
            name='tradingMode'
            label='交易模式'
            rules={[{ required: true, message: '请选择交易模式' }]}
            options={[
              { label: '仅允许模拟交易', value: 'simulation_only' },
              { label: '允许真实交易', value: 'allow_real' },
            ]}
          />
        </ProForm>
      </ProCard>
    </PageContainer>
  )
}
