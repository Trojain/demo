import { useEffect, useMemo, useRef } from 'react'
import { FilterOutlined } from '@ant-design/icons'
import type { ProColumns, ProFormInstance } from '@ant-design/pro-components'
import { DrawerForm, ProForm, ProFormSelect, ProFormText } from '@ant-design/pro-components'
import { DateRangeField, DateTimeRangeField } from './DateFields'
import {
  DATETIME_FORMAT,
  DATE_FORMAT,
  type DateRangeValue,
  buildSearchMeta,
  buildValueEnumOptions,
  parseDate,
  processFormValues,
} from './utils'

export interface MobileSearchProps<T extends Record<string, any> = Record<string, any>> {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSearch: (values: T) => void
  onReset: () => void
  columns: ProColumns<any>[]
  initialValues?: T
  title?: string
  width?: number | string
  submitText?: string
  resetText?: string
  columnFilter?: (col: ProColumns<any>) => boolean
  excludeValueTypes?: Array<ProColumns<any>['valueType']>
}

export const SearchButton = ({ hasSearch, onClick }: { hasSearch?: boolean; onClick: () => void }) => (
  <FilterOutlined
    style={{ fontSize: 20, color: hasSearch ? '#1890ff' : '#666', cursor: 'pointer' }}
    onClick={onClick}
  />
)

export default function MobileSearch<T extends Record<string, any> = Record<string, any>>({
  open,
  onOpenChange,
  onSearch,
  onReset,
  columns,
  initialValues,
  title = '搜索',
  width = '85%',
  submitText = '确定',
  resetText = '重置',
  columnFilter,
  excludeValueTypes,
}: MobileSearchProps<T>) {
  const formRef = useRef<ProFormInstance>()
  const dateValuesRef = useRef<Record<string, DateRangeValue>>({})

  const { columnsWithTransform, dateValueTypeMap, searchColumns } = useMemo(
    () => buildSearchMeta(columns, columnFilter, excludeValueTypes),
    [columns, columnFilter, excludeValueTypes],
  )

  // 初始化表单值
  useEffect(() => {
    if (!open) return
    if (initialValues && Object.keys(initialValues).length > 0) {
      const nextValues = { ...(initialValues as Record<string, any>) }
      dateValueTypeMap.forEach((valueType, key) => {
        const value = nextValues[key]
        if (!Array.isArray(value) || value.length !== 2) return
        if (value[0] instanceof Date || typeof value[0] !== 'string') return
        const format = valueType === 'dateTimeRange' ? DATETIME_FORMAT : DATE_FORMAT
        const start = parseDate(value[0], format)
        const end = parseDate(value[1], format)
        nextValues[key] = start && end ? [start, end] : undefined
      })
      formRef.current?.setFieldsValue(nextValues)
    } else {
      formRef.current?.resetFields()
    }
  }, [open, initialValues, dateValueTypeMap])

  // 渲染表单项
  const renderFormItem = (col: ProColumns<any>) => {
    const { title: colTitle, dataIndex, valueEnum, valueType } = col
    const name = dataIndex as string | number | (string | number)[]
    const key = Array.isArray(name) ? name.join('.') : String(name)
    const label = typeof colTitle === 'string' ? colTitle : ''

    if (valueType === 'dateRange') {
      return (
        <ProForm.Item key={key} name={name} label={colTitle}>
          <DateRangeField placeholder={label ? `请选择${label}` : ''} />
        </ProForm.Item>
      )
    }

    if (valueType === 'dateTimeRange') {
      return (
        <div key={key} className="ant-form-item">
          <div className="ant-form-item-label">
            <label>{colTitle}</label>
          </div>
          <div className="ant-form-item-control">
            <DateTimeRangeField
              fieldName={key}
              onValueChange={(k, v) => {
                dateValuesRef.current[k] = v
              }}
              placeholders={[`${label}开始`, `${label}结束`]}
            />
          </div>
        </div>
      )
    }

    if (valueEnum) {
      return (
        <ProFormSelect
          key={key}
          name={name}
          label={colTitle}
          options={buildValueEnumOptions(valueEnum)}
          initialValue=""
        />
      )
    }

    return <ProFormText key={key} name={name} label={colTitle} placeholder={label ? `请输入${label}` : ''} />
  }

  return (
    <DrawerForm<T>
      title={title}
      open={open}
      onOpenChange={onOpenChange}
      width={width}
      formRef={formRef}
      onReset={onReset}
      drawerProps={{ destroyOnClose: true, placement: 'right' }}
      submitter={{
        searchConfig: { submitText, resetText },
        resetButtonProps: { preventDefault: false, onClick: (e) => e?.stopPropagation?.() },
      }}
      onFinish={async (values) => {
        const searchValues = processFormValues<T>(
          values as Record<string, any>,
          dateValuesRef.current,
          dateValueTypeMap,
          columnsWithTransform,
        )
        onSearch(searchValues)
        return true
      }}
    >
      {searchColumns.map(renderFormItem)}
    </DrawerForm>
  )
}
