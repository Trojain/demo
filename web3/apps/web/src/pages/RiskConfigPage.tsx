import { useEffect, useState } from 'react'
import { App as AntApp, Button, Form, Input, InputNumber, Select, Space, Tag } from 'antd'
import { PageContainer, ProCard } from '@ant-design/pro-components'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import axios from 'axios'
import { tradingApi } from '../api/trading'
import type { UpdateRiskConfigPayload } from '../types'

export function RiskConfigPage() {
  const { message } = AntApp.useApp()
  const [form] = Form.useForm<UpdateRiskConfigPayload>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      return error.response?.data?.message ?? error.message
    }

    return error instanceof Error ? error.message : '操作失败'
  }

  const refreshConfig = async () => {
    setLoading(true)
    try {
      const config = await tradingApi.getRiskConfig()
      form.setFieldsValue(config)
      setUpdatedAt(config.updatedAt)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshConfig()
  }, [])

  const handleSave = async (values: UpdateRiskConfigPayload) => {
    setSaving(true)
    try {
      const config = await tradingApi.updateRiskConfig(values)
      form.setFieldsValue(config)
      setUpdatedAt(config.updatedAt)
      message.success('风控配置已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageContainer subTitle='配置交易金额、行情时效、日内次数和交易模式限制'>
      <ProCard
        title='风控配置'
        extra={
          <Space>
            {updatedAt ? <Tag>更新于 {updatedAt}</Tag> : null}
            <Button icon={<ReloadOutlined />} onClick={() => void refreshConfig()}>
              刷新
            </Button>
          </Space>
        }
      >
        <Form<UpdateRiskConfigPayload>
          form={form}
          layout='vertical'
          disabled={loading}
          onFinish={handleSave}
          style={{ maxWidth: 720 }}
        >
          <Form.Item
            name='maxQuoteAmount'
            label='单笔最大计价金额'
            rules={[{ required: true, message: '请输入单笔最大计价金额' }]}
            tooltip='单位按交易对计价币理解，当前 USDT 交易对可视为 USDT。'
          >
            <Input suffix='USDT' />
          </Form.Item>
          <Form.Item
            name='dailyMaxTriggerCount'
            label='每日最大通过风控次数'
            rules={[{ required: true, message: '请输入每日最大通过风控次数' }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name='dailyMaxQuoteAmount'
            label='每日最大通过风控计价金额'
            rules={[{ required: true, message: '请输入每日最大通过风控计价金额' }]}
          >
            <Input suffix='USDT' />
          </Form.Item>
          <Form.Item
            name='maxMarketAgeMs'
            label='行情最大允许延迟'
            rules={[{ required: true, message: '请输入行情最大允许延迟' }]}
          >
            <InputNumber min={1000} precision={0} addonAfter='ms' style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name='tradingMode'
            label='交易模式'
            rules={[{ required: true, message: '请选择交易模式' }]}
          >
            <Select
              options={[
                { label: '仅允许模拟交易', value: 'simulation_only' },
                { label: '允许真实交易', value: 'allow_real' },
              ]}
            />
          </Form.Item>
          <Button type='primary' htmlType='submit' icon={<SaveOutlined />} loading={saving}>
            保存配置
          </Button>
        </Form>
      </ProCard>
    </PageContainer>
  )
}
