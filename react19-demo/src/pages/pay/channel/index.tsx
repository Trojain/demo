import { useRef, useState } from 'react'
import { Button, Switch, Tag } from 'antd'
import { EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { ActionType, ProFormInstance } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import { useProTableConfig } from '@/hooks/useProTableConfig'
import { editPayChannel, getPayChannelList, handleResponse } from '@/services'
import FormModal from './components/FormModal'

export default function PayChannelPage() {
  const actionRef = useRef<ActionType>()
  const formRef = useRef<ProFormInstance>()
  const [modalOpen, setModalOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<any>(null)

  const enableEnum = {
    0: { text: '隐藏', status: 'error' },
    1: { text: '显示', status: 'success' },
  }

  const activeEnum = {
    0: { text: <Tag color="red">禁用</Tag> },
    1: { text: <Tag color="green">启用</Tag> },
  }

  const handleAdd = () => {
    setCurrentRecord(null)
    setModalOpen(true)
  }

  const handleEdit = (record: any) => {
    setCurrentRecord(record)
    setModalOpen(true)
  }

  const handlePayChannelStatus = async (checked: boolean, entity: any) => {
    entity.status = checked ? 1 : 0
    const response = await editPayChannel(entity)
    handleResponse(response, { actionRef })
  }

  const columns = [
    {
      title: '渠道ID',
      dataIndex: 'channelId',
      hideInSearch: true,
    },
    {
      title: '渠道名称',
      dataIndex: 'channelName',
    },
    {
      title: '描述',
      dataIndex: 'desc',
      hideInSearch: true,
      ellipsis: true,
    },
    {
      title: '备注',
      dataIndex: 'mark',
      hideInSearch: true,
      width: 200,
      ellipsis: true,
    },
    {
      title: '是否可见',
      dataIndex: 'enable',
      valueType: 'radio',
      valueEnum: enableEnum,
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: activeEnum,
      render: (_, entity) => (
        <Switch
          unCheckedChildren="禁用"
          checkedChildren="启用"
          checked={entity.status == 1}
          onChange={(checked) => handlePayChannelStatus(checked, entity)}
        />
      ),
    },
    {
      title: '操作',
      dataIndex: 'operate',
      valueType: 'option',
      render: (_, entity) => [
        <Button type="link" key="edit" size="small" icon={<EditOutlined />} onClick={() => handleEdit(entity)}>
          编辑
        </Button>,
      ],
    },
  ]

  return (
    <>
      <ProTable
        {...useProTableConfig()}
        headerTitle="支付渠道"
        actionRef={actionRef}
        formRef={formRef}
        columns={columns}
        rowKey="channelId"
        request={getPayChannelList}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加支付渠道
          </Button>,
        ]}
      />

      <FormModal open={modalOpen} onOpenChange={setModalOpen} record={currentRecord} actionRef={actionRef} />
    </>
  )
}
