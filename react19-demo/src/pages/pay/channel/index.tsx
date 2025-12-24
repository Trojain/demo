import { Button, Switch, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import { ProTable } from '@ant-design/pro-components'
import { useProTableConfig } from '@/hooks/useProTableConfig'

export default function PayChannelPage() {
  const columns = [
    { title: '渠道ID', dataIndex: 'id' },
    { title: '渠道名称', dataIndex: 'name' },
    { title: '描述', dataIndex: 'description' },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 200,
      ellipsis: true,
    },
    {
      title: '是否可见',
      dataIndex: 'visible',
      render: (visible: boolean) => <Tag color={visible ? 'green' : 'default'}>{visible ? '显示' : '隐藏'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: () => <Switch checked defaultChecked />,
    },
    {
      title: '操作',
      dataIndex: 'operate',
      valueType: 'option',
      render: (_, entity) => [
        <Button type="link" key="edit" size="small" icon={<EditOutlined />}>
          编辑
        </Button>,
        <Button type="link" key="delete" size="small" icon={<DeleteOutlined />} danger>
          删除
        </Button>,
      ],
    },
  ]

  const dataSource = [
    { key: 1, id: 41, name: 'ERC20', description: 'ERC20', remark: 'ERC20ERC20ERC20ERC20ERC20ERC...', visible: true },
    { key: 2, id: 42, name: 'TRC20', description: 'TRC20', remark: 'TRC20', visible: true },
    { key: 3, id: 43, name: 'BTC', description: 'BTC', remark: 'BTC', visible: true },
    { key: 4, id: 44, name: 'USD', description: 'USD', remark: 'US Dollar', visible: true },
    { key: 5, id: 45, name: 'HKD', description: 'HKD', remark: 'HKD', visible: true },
    { key: 6, id: 46, name: 'AUD', description: 'AUD', remark: 'Australian Dollar', visible: true },
    { key: 7, id: 47, name: 'BGN', description: 'BGN', remark: 'BGN', visible: true },
    { key: 8, id: 48, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 9, id: 49, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 10, id: 50, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 11, id: 51, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 12, id: 52, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 13, id: 53, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 14, id: 54, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 15, id: 55, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 16, id: 56, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 17, id: 57, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 18, id: 58, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 19, id: 59, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 20, id: 60, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
    { key: 21, id: 60, name: 'BRL', description: 'BRL', remark: 'BRL', visible: true },
  ]

  return (
    <ProTable
      {...useProTableConfig()}
      headerTitle="支付渠道"
      columns={columns}
      dataSource={dataSource}
      rowKey="key"
      toolBarRender={() => [
        <Button key="export" icon={<ReloadOutlined />}>
          导出
        </Button>,
        <Button key="reset" icon={<ReloadOutlined />}>
          重置
        </Button>,
        <Button key="settings" icon={<SettingOutlined />} />,
        <Button key="delete" danger icon={<DeleteOutlined />}>
          删除
        </Button>,
        <Button key="add" type="primary" icon={<PlusOutlined />}>
          添加支付渠道
        </Button>,
      ]}
    />
  )
}
