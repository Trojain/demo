import { useEffect } from 'react'
import { Button, Form, Input, NavBar, Popup, Radio, Space, TextArea, Toast } from 'antd-mobile'
import { addPayChannel, editPayChannel } from '@/services'
import type { PayChannel } from '../types'

interface MobileFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: PayChannel
  onSaved?: () => void
}

export default function MobileForm({ open, onOpenChange, record, onSaved }: MobileFormProps) {
  const [form] = Form.useForm()
  const isEdit = !!record

  useEffect(() => {
    if (open) {
      if (record) {
        form.setFieldsValue(record)
      } else {
        form.resetFields()
        form.setFieldsValue({ enable: 1, status: 1 })
      }
    }
  }, [open, record, form])

  const onFinish = async (values: any) => {
    try {
      let response
      if (isEdit && record) {
        response = await editPayChannel({ channelId: record.channelId, ...values })
      } else {
        response = await addPayChannel(values)
      }

      if (response?.code === 200) {
        Toast.show({ icon: 'success', content: '操作成功' })
        onOpenChange(false)
        onSaved?.()
      } else {
        Toast.show({ icon: 'fail', content: response.msg || '操作失败' })
      }
    } catch {
      Toast.show({ icon: 'fail', content: '请求失败' })
    }
  }

  return (
    <Popup visible={open} onClose={() => onOpenChange(false)} showCloseButton>
      <NavBar back={null}>{isEdit ? '编辑支付渠道' : '添加支付渠道'}</NavBar>
      <Form
        form={form}
        mode="card"
        footer={
          <Button block type="submit" color="primary">
            提交
          </Button>
        }
        onFinish={onFinish}
      >
        <Form.Item name="channelName" label="渠道名称" rules={[{ required: true, message: '请输入渠道名称' }]}>
          <Input placeholder="请输入渠道名称" />
        </Form.Item>
        <Form.Item
          name="addressVerifyRule"
          label="链地址规则"
          rules={[{ required: true, message: '请输入链地址规则' }]}
        >
          <Input placeholder="请输入链地址规则" />
        </Form.Item>
        <Form.Item name="desc" label="描述" rules={[{ required: true, message: '请输入描述' }]}>
          <Input placeholder="请输入描述" />
        </Form.Item>
        <Form.Item name="mark" label="备注" rules={[{ required: true, message: '请输入备注' }]}>
          <TextArea placeholder="请输入备注" rows={3} showCount maxLength={50} />
        </Form.Item>
        <Form.Item name="enable" label="是否可见" rules={[{ required: true }]}>
          <Radio.Group>
            <Space direction="horizontal">
              <Radio value={1}>显示</Radio>
              <Radio value={0}>隐藏</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="status" label="状态" rules={[{ required: true }]}>
          <Radio.Group>
            <Space direction="horizontal">
              <Radio value={1}>启用</Radio>
              <Radio value={0}>禁用</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Popup>
  )
}
