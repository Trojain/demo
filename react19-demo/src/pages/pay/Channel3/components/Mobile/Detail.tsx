import { Button, List, NavBar, Popup } from 'antd-mobile'
import { type PayChannel, detailFields, getDetailValue } from '../types'

interface DetailProps {
  open: boolean
  record?: PayChannel
  onClose: () => void
  onEdit: (record: PayChannel) => void
}

export default function Detail({ open, record, onClose, onEdit }: DetailProps) {
  return (
    <Popup visible={open} showCloseButton onMaskClick={onClose} onClose={onClose}>
      <NavBar back={null}>渠道详情</NavBar>
      {record && (
        <List mode="card">
          {detailFields.map((field) => (
            <List.Item key={String(field.key)} children={field.label} description={getDetailValue(field, record)} />
          ))}
        </List>
      )}
      <div style={{ padding: 24, display: 'flex', gap: 12 }}>
        <Button block color="danger">
          删除
        </Button>
        <Button block color="primary" onClick={() => record && onEdit(record)} disabled={!record}>
          编辑
        </Button>
      </div>
    </Popup>
  )
}
