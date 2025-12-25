import type { ActionType } from '@ant-design/pro-components'
import { DrawerForm, ProFormRadio, ProFormText, ProFormTextArea } from '@ant-design/pro-components'
import { addPayChannel, editPayChannel, handleResponse } from '@/services'

interface FormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: any
  actionRef?: React.RefObject<ActionType | undefined>
}

export default function FormModal({ open, onOpenChange, record, actionRef }: FormModalProps) {
  const isEdit = !!record

  return (
    <DrawerForm
      title={isEdit ? '编辑支付渠道' : '添加支付渠道'}
      open={open}
      onOpenChange={onOpenChange}
      initialValues={record}
      drawerProps={{ destroyOnClose: true }}
      onFinish={async (values) => {
        const response = isEdit
          ? await editPayChannel({ channelId: record.channelId, ...values })
          : await addPayChannel(values)
        handleResponse(response, { actionRef })
        return true
      }}
    >
      <ProFormText
        name="channelName"
        label="渠道名称"
        placeholder="请输入渠道名称"
        rules={[{ required: true, message: '请输入渠道名称' }]}
      />
      <ProFormText
        name="addressVerifyRule"
        label="链地址规则"
        placeholder="请输入链地址规则"
        rules={[{ required: true, message: '请输入链地址规则' }]}
      />
      <ProFormText
        name="desc"
        label="描述"
        placeholder="请输入描述"
        rules={[{ required: true, message: '请输入描述' }]}
      />
      <ProFormTextArea
        name="mark"
        label="备注"
        placeholder="请输入备注"
        fieldProps={{ rows: 3, showCount: true, maxLength: 50 }}
        rules={[{ required: true, message: '请输入备注' }]}
      />
      <ProFormRadio.Group
        name="enable"
        label="是否可见"
        options={[
          { label: '隐藏', value: 0 },
          { label: '显示', value: 1 },
        ]}
        rules={[{ required: true }]}
      />
      <ProFormRadio.Group
        name="status"
        label="状态"
        options={[
          { label: '禁用', value: 0 },
          { label: '启用', value: 1 },
        ]}
        rules={[{ required: true }]}
      />
    </DrawerForm>
  )
}
