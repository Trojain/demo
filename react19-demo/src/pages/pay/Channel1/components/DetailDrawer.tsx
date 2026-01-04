import { Button, Drawer, Popconfirm } from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import type { ProDescriptionsItemProps } from '@ant-design/pro-components'
import { ProDescriptions } from '@ant-design/pro-components'
import { useIsMobile } from '@/hooks/useIsMobile'

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  record: any
  columns: ProDescriptionsItemProps<any>[]
  onEdit?: () => void
  onDelete?: () => void
}

const DetailDrawer: React.FC<DetailDrawerProps> = ({ open, onClose, record, columns, onEdit, onDelete }) => {
  const isMobile = useIsMobile()
  // 过滤掉操作列
  const detailColumns = columns.filter((col) => col.valueType !== 'option' && col.dataIndex !== 'operate')

  return (
    <Drawer
      title="渠道详情"
      placement={isMobile ? 'bottom' : 'right'}
      width={isMobile ? '100%' : '60%'}
      height={isMobile ? '92vh' : undefined}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        <div style={{ display: 'flex', gap: 8 }}>
          {onEdit && (
            <Button type="primary" size="small" icon={<EditOutlined />} onClick={onEdit}>
              编辑
            </Button>
          )}
          {onDelete && (
            <Popconfirm title="确认删除？" onConfirm={onDelete}>
              <Button type="primary" danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </div>
      }
    >
      {record && (
        <ProDescriptions
          size="small"
          bordered={!isMobile}
          column={isMobile ? 1 : 2}
          title={record.channelName}
          dataSource={record}
          columns={detailColumns}
        />
      )}
    </Drawer>
  )
}

export default DetailDrawer
