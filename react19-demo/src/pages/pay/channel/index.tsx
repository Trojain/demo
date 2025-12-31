import { useRef, useState } from 'react'
import { Button, Switch, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ActionType, ProFormInstance } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useProTableConfig } from '@/hooks/useProTableConfig'
import { editPayChannel, getPayChannelList, handleResponse } from '@/services'
import FormModal from './components/FormModal'

export default function PayChannelPage() {
  const actionRef = useRef<ActionType>(null)
  const formRef = useRef<ProFormInstance>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<any>(null)
  const isMobile = useIsMobile()

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
      render: (_: any, entity: any) => (
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
      fixed: 'right',
      width: 80,
      render: (_: any, entity: any) => [
        <Button type="link" key="edit" size="small" onClick={() => handleEdit(entity)}>
          编辑
        </Button>,
      ],
    },
  ]

  return (
    <>
      <ProTable
        {...useProTableConfig()}
        actionRef={actionRef}
        rowKey="channelId"
        request={getPayChannelList}
        pagination={{ defaultPageSize: 10, showSizeChanger: !isMobile }}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加支付渠道
          </Button>,
        ]}
        formRef={formRef as any}
        columns={columns}
      />

      <FormModal open={modalOpen} onOpenChange={setModalOpen} record={currentRecord} actionRef={actionRef} />
    </>
  )
}
