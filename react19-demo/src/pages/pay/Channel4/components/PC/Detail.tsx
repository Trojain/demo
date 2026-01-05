import { Drawer } from 'antd'
import type { ProDescriptionsItemProps } from '@ant-design/pro-components'
import { ProDescriptions } from '@ant-design/pro-components'
import { useIsMobile } from '@/hooks/useIsMobile'
import { type PayChannel, detailFields, getDetailValue } from '../types'

interface DetailProps {
  open: boolean
  onClose: () => void
  record?: PayChannel
}

const Detail: React.FC<DetailProps> = ({ open, onClose, record }) => {
  const isMobile = useIsMobile()
  const detailColumns: ProDescriptionsItemProps<PayChannel>[] = detailFields.map((field) => ({
    title: field.label,
    dataIndex: field.key,
    render: (_: any, entity: PayChannel) => getDetailValue(field, entity),
  }))

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

export default Detail
