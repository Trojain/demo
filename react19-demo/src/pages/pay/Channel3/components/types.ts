export type PayChannel = {
  channelId: number | string
  channelName?: string
  desc?: string
  mark?: string
  createTime?: string
  enable?: 0 | 1
  status?: 0 | 1
  addressVerifyRule?: string
  [key: string]: unknown
}

export type DetailField = {
  key: keyof PayChannel
  label: string
  format?: (value: PayChannel[keyof PayChannel], record: PayChannel) => string
}

export const detailFields: DetailField[] = [
  { key: 'channelId', label: '渠道ID' },
  { key: 'channelName', label: '渠道名称' },
  { key: 'createTime', label: '注册时间' },
  { key: 'desc', label: '描述' },
  { key: 'mark', label: '备注' },
  {
    key: 'enable',
    label: '是否可见',
    format: (value) => (value === 1 ? '显示' : value === 0 ? '隐藏' : ''),
  },
  {
    key: 'status',
    label: '状态',
    format: (value) => (value === 1 ? '启用' : value === 0 ? '禁用' : ''),
  },
]

export const getDetailValue = (field: DetailField, record: PayChannel): string | number => {
  const raw = record[field.key]
  if (field.format) {
    return field.format(raw, record)
  }
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'string' || typeof raw === 'number') return raw
  return String(raw)
}
