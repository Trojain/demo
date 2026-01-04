import { Drawer } from 'antd'
import type { ProDescriptionsItemProps } from '@ant-design/pro-components'
import { ProDescriptions } from '@ant-design/pro-components'
import { useIsMobile } from '@/hooks/useIsMobile'

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  record: any
  columns: ProDescriptionsItemProps<any>[]
}

const DetailDrawer: React.FC<DetailDrawerProps> = ({ open, onClose, record, columns }) => {
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
