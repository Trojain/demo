import { useRef, useState } from 'react'
import { Button, Switch, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ActionType, ProFormInstance } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'
import { useProTableConfig } from '@/hooks/useProTableConfig'
import { editPayChannel, getPayChannelList, handleResponse } from '@/services'
import type { PayChannel } from '../types'
import Detail from './Detail'
import Form from './Form'

const List = () => {
  const actionRef = useRef<ActionType>(null)
  const formRef = useRef<ProFormInstance>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<PayChannel | undefined>(undefined)

  const enableEnum = {
    0: { text: '隐藏', status: 'error' },
    1: { text: '显示', status: 'success' },
  }

  const activeEnum = {
    0: { text: <Tag color="red">禁用</Tag> },
    1: { text: <Tag color="green">启用</Tag> },
  }

  const handleAdd = () => {
    setCurrentRecord(undefined)
    setModalOpen(true)
  }

  const handleEdit = (record: PayChannel) => {
    setCurrentRecord(record)
    setModalOpen(true)
  }

  const handleDetail = (record: PayChannel) => {
    setCurrentRecord(record)
    setDetailOpen(true)
  }

  const handlePayChannelStatus = async (checked: boolean, entity: PayChannel) => {
    entity.status = checked ? 1 : 0
    const response = await editPayChannel(entity)
    handleResponse(response, { actionRef })
  }

  const commonProps = {
    actionRef,
    formRef,
    rowKey: 'channelId',
    request: getPayChannelList,
    toolBarRender: () => [
      <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
        添加支付渠道
      </Button>,
    ],
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
      render: (_: any, entity: any) => [
        <Button type="link" key="detail" size="small" onClick={() => handleDetail(entity)}>
          详情
        </Button>,
        <Button type="link" key="edit" size="small" onClick={() => handleEdit(entity)}>
          编辑
        </Button>,
      ],
    },
  ]

  const tableConfig = useProTableConfig()

  return (
    <>
      <ProTable {...tableConfig} {...(commonProps as any)} columns={columns as any} />
      <Form open={modalOpen} onOpenChange={setModalOpen} record={currentRecord} actionRef={actionRef} />
      <Detail open={detailOpen} onClose={() => setDetailOpen(false)} record={currentRecord} />
    </>
  )
}

export default List
