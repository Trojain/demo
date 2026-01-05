import { useMemo, useRef, useState } from 'react'
import { Button, Switch, Tag, message } from 'antd'
import { PlusOutlined, RightOutlined } from '@ant-design/icons'
import type { ActionType, ProFormInstance } from '@ant-design/pro-components'
import { ProList, ProTable } from '@ant-design/pro-components'
import MobileSearch, { SearchButton } from '@/components/MobileSearch'
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

  // 移动端搜索相关状态
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchParams, setSearchParams] = useState({})

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

  // 判断是否有搜索条件
  const hasSearch = useMemo(() => Object.keys(searchParams).length > 0, [searchParams])

  // 通用配置：PC 和移动端共享
  const commonProps = {
    actionRef,
    formRef,
    rowKey: 'channelId',
    request: (params: any) => getPayChannelList(params),
    params: isMobile ? searchParams : undefined,
    toolBarRender: () => [
      isMobile && <SearchButton key="search" hasSearch={hasSearch} onClick={() => setSearchOpen(true)} />,
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
    },
    {
      title: '渠道名称',
      dataIndex: 'channelName',
    },
    {
      title: '描述',
      dataIndex: 'desc',
      ellipsis: true,
    },
    {
      title: '备注',
      dataIndex: 'mark',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '是否可见',
      dataIndex: 'enable',
      valueType: 'radio',
      valueEnum: enableEnum,
    },
    {
      title: '注册时间',
      dataIndex: 'searchTime',
      valueType: 'dateTimeRange',
      hideInTable: true,
      search: {
        transform: (value: string[]) => ({
          startTime: value[0],
          endTime: value[1],
        }),
      },
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
    avatar: { title: '渠道ID', dataIndex: 'channelId' },
    title: { title: '渠道名称', dataIndex: 'channelName' },
    subTitle: { title: '描述', dataIndex: 'desc' },
    description: { title: '备注', dataIndex: 'mark' },
    actions: {
      render: (_: any, entity: any) => [
        <Switch
          key="status"
          size="small"
          checked={entity.status == 1}
          onChange={(checked) => handlePayChannelStatus(checked, entity)}
        />,
        <RightOutlined key="arrow" style={{ color: '#00000040' }} />,
      ],
    },
  }

  const tableConfig = useProTableConfig()

  return (
    <>
      {isMobile ? (
        <ProList
          {...tableConfig}
          {...commonProps}
          search={false}
          metas={metas}
          columns={columns as any}
          onRow={(record) => ({ onClick: () => handleDetail(record) })}
        />
      ) : (
        <ProTable {...tableConfig} {...commonProps} columns={columns} />
      )}

      {/* 移动端搜索组件 */}
      <MobileSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSearch={setSearchParams}
        onReset={() => setSearchParams({})}
        columns={columns}
        initialValues={searchParams}
      />

      <FormModal open={modalOpen} onOpenChange={setModalOpen} record={currentRecord} actionRef={actionRef} />

      <DetailDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        record={currentRecord}
        columns={columns as any}
        onEdit={() => handleEdit(currentRecord)}
        onDelete={() => {
          handleDelete(currentRecord)
          setDetailOpen(false)
        }}
      />
    </>
  )
}
