import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  DatePicker,
  Dialog,
  Ellipsis,
  Form,
  InfiniteScroll,
  Input,
  List,
  Popup,
  PullToRefresh,
  Radio,
  SearchBar,
  Space,
  SwipeAction,
  SwipeActionRef,
  Switch,
  Tag,
  Toast,
} from 'antd-mobile'
import { AddOutline, FilterOutline } from 'antd-mobile-icons'
import dayjs from 'dayjs'
import { editPayChannel, getPayChannelList } from '@/services'
import type { PayChannel } from '../types'
import Detail from './Detail'

const MobileForm = lazy(() => import('./Form'))

const PAGE_SIZE = 10

type FilterChoice = '' | 0 | 1

type FilterValues = {
  channelId?: string
  searchTime?: [Date | null, Date | null]
  desc?: string
  mark?: string
  enable?: FilterChoice
  status?: FilterChoice
}

type FilterPayload = Omit<FilterValues, 'enable' | 'status'> & {
  enable?: '' | 0 | 1
  status?: '' | 0 | 1
}

type SwipeActionItemProps = {
  item: PayChannel
  onEdit: (record: PayChannel) => void
  onDelete: (record: PayChannel) => void
  onDetail: (record: PayChannel) => void
  onStatusChange: (checked: boolean, entity: PayChannel) => void
}

// 子组件处理 SwipeAction 引用和关闭逻辑
const SwipeActionItem = ({ item, onEdit, onDelete, onDetail, onStatusChange }: SwipeActionItemProps) => {
  const swipeRef = useRef<SwipeActionRef>(null)

  const rightActions = [
    {
      key: 'edit',
      text: '编辑',
      color: 'primary',
      onClick: async () => {
        swipeRef.current?.close()
        // 延迟打开弹窗，等待侧滑动画完成/重置
        setTimeout(() => onEdit(item), 300)
      },
    },
    {
      key: 'delete',
      text: '删除',
      color: 'danger',
      onClick: async () => {
        swipeRef.current?.close()
        setTimeout(() => onDelete(item), 300)
      },
    },
  ]

  return (
    <SwipeAction
      ref={swipeRef}
      key={item.channelId}
      rightActions={rightActions as any}
      closeOnAction={false}
      closeOnTouchOutside={true}
    >
      <List.Item
        prefix={
          <div
            style={{
              width: 40,
              height: 40,
              background: '#eee',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.channelName?.[0]}
          </div>
        }
        extra={
          <Switch
            checked={item.status === 1}
            onChange={(checked) => onStatusChange(checked, item)}
            style={{ '--height': '24px', '--width': '40px' }}
          />
        }
        description={
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#666' }}>
              <Ellipsis direction="end" content={item.desc || '暂无描述'} rows={1} />
            </div>
            <div style={{ marginTop: 4 }}>
              {item.createTime && <div style={{ marginBottom: 4, color: '#999', fontSize: 12 }}>{item.createTime}</div>}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {item.enable === 1 ? <Tag color="success">显示</Tag> : <Tag color="default">隐藏</Tag>}
                {item.mark && (
                  <div style={{ marginLeft: 6, flex: 1, minWidth: 0, color: '#999' }}>
                    <Ellipsis direction="end" content={item.mark} rows={1} />
                  </div>
                )}
              </div>
            </div>
          </div>
        }
        children={item.channelName}
        onClick={() => onDetail(item)}
      />
    </SwipeAction>
  )
}

const MobileList = () => {
  const [data, setData] = useState<PayChannel[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [filters, setFilters] = useState<FilterPayload>({}) // 统一筛选状态
  const [filterOpen, setFilterOpen] = useState(false) // 筛选弹窗控制
  const [modalOpen, setModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<PayChannel | undefined>(undefined)

  // 时间选择器显示状态
  const [activePickerIndex, setActivePickerIndex] = useState<0 | 1 | null>(null)

  const [filterForm] = Form.useForm()

  // 防止重复请求和首次挂载冗余调用
  const loadingRef = useRef(false)
  const isFirstMount = useRef(true)

  const fetchList = useCallback(
    (current: number) =>
      getPayChannelList({
        current,
        pageSize: PAGE_SIZE,
        channelName: keyword,
        ...filters,
      }),
    [keyword, filters],
  )

  const refresh = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      setPage(1)
      setHasMore(true)
      const response = await fetchList(1)
      if (response?.data) {
        setData(response.data)
        setHasMore((response.total ?? 0) > response.data.length)
        setPage(2)
      } else {
        setData([])
        setHasMore(false)
      }
    } finally {
      loadingRef.current = false
    }
  }, [fetchList])

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const response = await fetchList(page)
      if (response?.data) {
        const nextList = page === 1 ? response.data : [...data, ...response.data]
        setData(nextList)
        setHasMore((response.total ?? 0) > nextList.length)
        setPage(page + 1)
      } else {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    } finally {
      loadingRef.current = false
    }
  }, [fetchList, page, data])

  const handleSearch = (val: string) => {
    setKeyword(val)
  }

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    refresh()
  }, [refresh])

  // 处理时间选择器确认
  const handleDateChange = (index: 0 | 1, val: Date) => {
    const current = (filterForm.getFieldValue('searchTime') as FilterValues['searchTime']) ?? [null, null]
    const newVal = [...current] as [Date | null, Date | null]
    newVal[index] = val
    filterForm.setFieldsValue({ searchTime: newVal })
  }

  const handleFilterReset = () => {
    filterForm.resetFields()
    setFilters({})
    setFilterOpen(false)
  }

  const handleFilterConfirm = () => {
    const values = filterForm.getFieldsValue() as FilterValues
    setFilters(values)
    setFilterOpen(false)
  }

  const handleAdd = () => {
    setCurrentRecord(undefined)
    setModalOpen(true)
  }

  useEffect(() => {
    filterForm.setFieldsValue({ enable: '', status: '' })
  }, [filterForm])

  const handleEdit = (record: PayChannel) => {
    setCurrentRecord(record)
    setDetailOpen(false)
    setModalOpen(true)
  }

  const handleDelete = (record: PayChannel) => {
    const label = record?.channelName ? ` ${record.channelName}` : ''
    Dialog.confirm({
      content: `确认删除${label}？`,
      onConfirm: async () => {
        Toast.show({ icon: 'success', content: '删除成功' })
        refresh()
      },
    })
  }

  const handleDetail = (record: PayChannel) => {
    setCurrentRecord(record)
    setDetailOpen(true)
  }

  const handleStatusChange = async (checked: boolean, entity: PayChannel) => {
    const newStatus = (checked ? 1 : 0) as 0 | 1
    const newData = data.map((item) => (item.channelId === entity.channelId ? { ...item, status: newStatus } : item))
    setData(newData)

    try {
      await editPayChannel({ ...entity, status: newStatus })
      Toast.show({ icon: 'success', content: '操作成功' })
    } catch {
      refresh()
    }
  }

  const searchTimeValue = filterForm.getFieldValue('searchTime') as FilterValues['searchTime'] | undefined

  return (
    <div style={{ height: 'calc(100vh - 46px)', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <div style={{ background: '#fff', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar
            placeholder="请输入渠道名称"
            onSearch={handleSearch}
            onChange={(val) => !val && handleSearch('')}
            showCancelButton={false}
          />
        </div>
        <FilterOutline
          fontSize={24}
          color={Object.keys(filters).length > 0 ? 'var(--adm-color-primary)' : '#666'}
          onClick={() => setFilterOpen(true)}
        />
        <AddOutline fontSize={24} color="var(--adm-color-primary)" onClick={handleAdd} />
      </div>

      <Popup
        visible={filterOpen}
        onMaskClick={() => setFilterOpen(false)}
        position="right"
        bodyStyle={{ width: '85vw' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: 16, fontSize: 18, fontWeight: 'bold', borderBottom: '1px solid #eee' }}>筛选</div>
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            <Form layout="vertical" form={filterForm} initialValues={{ enable: '', status: '' }}>
              <Form.Item name="channelId" label="渠道ID">
                <Input placeholder="请输入渠道ID" clearable />
              </Form.Item>
              <Form.Item name="searchTime" label="注册时间">
                <Form.Subscribe to={['searchTime']}>
                  {({ searchTime }) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          border: '1px solid #eee',
                          padding: '4px 8px',
                          borderRadius: 4,
                          color: searchTime?.[0] ? '#333' : '#ccc',
                          fontSize: 14,
                        }}
                        onClick={() => setActivePickerIndex(0)}
                      >
                        {searchTime?.[0] ? dayjs(searchTime[0]).format('YYYY-MM-DD HH:mm:ss') : '开始时间'}
                      </div>
                      <span>-</span>
                      <div
                        style={{
                          flex: 1,
                          border: '1px solid #eee',
                          padding: '4px 8px',
                          borderRadius: 4,
                          color: searchTime?.[1] ? '#333' : '#ccc',
                          fontSize: 14,
                        }}
                        onClick={() => setActivePickerIndex(1)}
                      >
                        {searchTime?.[1] ? dayjs(searchTime[1]).format('YYYY-MM-DD HH:mm:ss') : '结束时间'}
                      </div>
                    </div>
                  )}
                </Form.Subscribe>
              </Form.Item>
              <Form.Item name="desc" label="描述">
                <Input placeholder="请输入描述" clearable />
              </Form.Item>
              <Form.Item name="mark" label="备注">
                <Input placeholder="请输入备注" clearable />
              </Form.Item>
              <Form.Item name="enable" label="是否可见">
                <Radio.Group>
                  <Space direction="horizontal">
                    <Radio value="">全部</Radio>
                    <Radio value={1}>显示</Radio>
                    <Radio value={0}>隐藏</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Radio.Group>
                  <Space direction="horizontal">
                    <Radio value="">全部</Radio>
                    <Radio value={1}>启用</Radio>
                    <Radio value={0}>禁用</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
            </Form>
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 12, borderTop: '1px solid #eee' }}>
            <Button block onClick={handleFilterReset}>
              重置
            </Button>
            <Button block color="primary" onClick={handleFilterConfirm}>
              确定
            </Button>
          </div>
        </div>
      </Popup>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <PullToRefresh onRefresh={refresh}>
          <List mode="card">
            {data.map((item) => (
              <SwipeActionItem
                key={item.channelId}
                item={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDetail={handleDetail}
                onStatusChange={handleStatusChange}
              />
            ))}
          </List>
          <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
        </PullToRefresh>
      </div>

      <Detail open={detailOpen} record={currentRecord} onClose={() => setDetailOpen(false)} onEdit={handleEdit} />

      <DatePicker
        visible={activePickerIndex !== null}
        value={
          activePickerIndex !== null && searchTimeValue?.[activePickerIndex]
            ? searchTimeValue[activePickerIndex]
            : undefined
        }
        onClose={() => setActivePickerIndex(null)}
        precision="second"
        onConfirm={(val) => {
          if (activePickerIndex === null) return
          handleDateChange(activePickerIndex, val)
          setActivePickerIndex(null)
        }}
      />

      <Suspense fallback={null}>
        <MobileForm open={modalOpen} onOpenChange={setModalOpen} record={currentRecord} onSaved={refresh} />
      </Suspense>
    </div>
  )
}

export default MobileList
