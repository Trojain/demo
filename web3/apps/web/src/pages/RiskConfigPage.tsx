import { useRef, useState } from 'react'
import { App as AntApp, Button, Space, Tag } from 'antd'
import { PageContainer, ProCard, ProForm, ProFormDigit, ProFormSelect, ProFormText, type ProFormInstance } from '@ant-design/pro-components'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import axios from 'axios'
import { tradingApi } from '../api/trading'
import type { UpdateRiskConfigPayload } from '../types'

export function RiskConfigPage() {
  const { message } = AntApp.useApp()
  const formRef = useRef<ProFormInstance<UpdateRiskConfigPayload> | undefined>(undefined)
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')

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

  return (
    <PageContainer subTitle='配置交易金额、行情时效、日内次数和交易模式限制'>
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
