import { useRef, useState } from 'react'
import { Avatar, Button, Dropdown, Popconfirm, Switch, Tag, message } from 'antd'
import { EllipsisOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import type { ActionType, ProFormInstance } from '@ant-design/pro-components'
import { ProList, ProTable } from '@ant-design/pro-components'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useProTableConfig } from '@/hooks/useProTableConfig'
import { editPayChannel, getPayChannelList, handleResponse } from '@/services'
import DetailDrawer from './components/DetailDrawer'
import FormModal from './components/FormModal'

export default function PayChannelPage() {
  const actionRef = useRef<ActionType>(null)
  const formRef = useRef<ProFormInstance>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
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

  const handleDetail = (record: any) => {
    setCurrentRecord(record)
    setDetailOpen(true)
  }

  const handleDelete = (record: any) => {
    console.log('Delete record:', record)
    message.success('删除成功')
  }

  const handlePayChannelStatus = async (checked: boolean, entity: any) => {
    entity.status = checked ? 1 : 0
    const response = await editPayChannel(entity)
    handleResponse(response, { actionRef })
  }

  // 通用配置：PC 和移动端共享
  const commonProps = {
    actionRef,
    formRef,
    rowKey: 'channelId',
    request: getPayChannelList,
    toolBarRender: () => [
      <Button key="add" type="primary" size={isMobile ? 'small' : 'middle'} icon={<PlusOutlined />} onClick={handleAdd}>
        新增渠道
      </Button>,
    ],
  }

  // PC 端列配置
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

  // 移动端 ProList metas 配置
  const metas = {
    title: {
      title: '渠道名称',
      dataIndex: 'channelName',
    },
    subTitle: {
      title: '描述',
      dataIndex: 'desc',
      // hideInSearch: true,
    },
    description: {
      title: '备注',
      dataIndex: 'mark',
      valueType: 'text',
      // hideInSearch: true,
    },
    actions: {
      render: (_: any, entity: any) => [
        <Switch
          key="status"
          size="small"
          checked={entity.status == 1}
          onChange={(checked) => handlePayChannelStatus(checked, entity)}
        />,
        <Dropdown
          key="more"
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'detail',
                label: '详情',
                onClick: () => handleDetail(entity),
              },
              {
                key: 'edit',
                label: '编辑',
                onClick: () => handleEdit(entity),
              },
              {
                key: 'del',
                danger: true,
                label: (
                  <Popconfirm
                    title="确认删除？"
                    onConfirm={() => handleDelete(entity)}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <div onClick={(e) => e.stopPropagation()}>删除</div>
                  </Popconfirm>
                ),
              },
            ],
          }}
        >
          <Button type="text" size="small" icon={<EllipsisOutlined style={{ fontSize: 20 }} />} />
        </Dropdown>,
      ],
    },
    avatar: {
      search: false,
      render: (_: any, entity: any) => (
        // <Tag color={entity.status == 1 ? 'green' : 'red'}>{entity.status == 1 ? '启用' : '禁用'}</Tag>
        <Avatar size={40} icon={<UserOutlined />} />
      ),
    },
  }

  // 获取 ProTable 配置（Hook 必须在顶层调用）
  const tableConfig = useProTableConfig()

  return (
    <>
      {isMobile ? (
        // 移动端：ProList 卡片式
        <ProList
          {...tableConfig}
          {...commonProps}
          metas={metas}
          onRow={(record) => ({
            onClick: () => handleDetail(record),
          })}
        />
      ) : (
        // PC 端：ProTable 表格
        <ProTable {...tableConfig} {...commonProps} columns={columns} />
      )}

      <FormModal open={modalOpen} onOpenChange={setModalOpen} record={currentRecord} actionRef={actionRef} />
      <DetailDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        record={currentRecord}
        columns={columns as any}
      />
    </>
  )
}
