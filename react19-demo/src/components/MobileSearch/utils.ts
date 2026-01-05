import type { ProColumns } from '@ant-design/pro-components'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

export const DATE_FORMAT = 'YYYY-MM-DD'
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'

export type DateRangeValue = [Date | null, Date | null] | undefined

// 判断是否为可搜索的列
export const isSearchableColumn = (col: ProColumns<any>) =>
  col.dataIndex && col.dataIndex !== 'operate' && col.valueType !== 'option' && !col.hideInSearch

// 构建 valueEnum 的选项列表
export const buildValueEnumOptions = (valueEnum: NonNullable<ProColumns<any>['valueEnum']>) => [
  { label: '全部', value: '' },
  ...Object.entries(valueEnum).map(([value, config]) => {
    const numericValue = Number(value)
    return {
      label: typeof config === 'object' ? (config as any).text : config,
      value: Number.isNaN(numericValue) ? value : numericValue,
    }
  }),
]

export const buildSearchMeta = (
  columns: ProColumns<any>[],
  columnFilter?: (col: ProColumns<any>) => boolean,
  excludeValueTypes?: Array<ProColumns<any>['valueType']>,
) => {
  const excludedTypes = new Set(excludeValueTypes ?? [])
  const columnsWithTransform: ProColumns<any>[] = []
  const dateValueTypeMap = new Map<string, 'dateRange' | 'dateTimeRange'>()
  const searchColumns: ProColumns<any>[] = []

  columns.forEach((col) => {
    if (typeof col.dataIndex === 'string' && (col.valueType === 'dateRange' || col.valueType === 'dateTimeRange')) {
      dateValueTypeMap.set(col.dataIndex, col.valueType)
    }
    if (col.dataIndex && typeof col.search === 'object' && typeof col.search.transform === 'function') {
      columnsWithTransform.push(col)
    }
    if (isSearchableColumn(col) && (columnFilter ? columnFilter(col) : true) && !excludedTypes.has(col.valueType)) {
      searchColumns.push(col)
    }
  })

  return { columnsWithTransform, dateValueTypeMap, searchColumns }
}

// 格式化日期
export const formatDate = (value: Date | null | undefined, format: string) => (value ? dayjs(value).format(format) : '')

// 解析日期字符串
export const parseDate = (value: string, format: string) => {
  const parsed = dayjs(value, format, true)
  return parsed.isValid() ? parsed.toDate() : null
}

// 判断是否为普通对象
export const isPlainObject = (value: unknown) => {
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

// 处理表单值的转换和过滤
export const processFormValues = <T extends Record<string, any>>(
  values: Record<string, any>,
  dateValuesRef: Record<string, DateRangeValue>,
  dateValueTypeMap: Map<string, 'dateRange' | 'dateTimeRange'>,
  columnsWithTransform: ProColumns<any>[],
): T => {
  // 合并日期字段的值
  const nextValues = { ...values, ...dateValuesRef }

  // 格式化日期值
  dateValueTypeMap.forEach((valueType, key) => {
    const value = nextValues[key]
    if (!Array.isArray(value) || value.length !== 2) return

    const startDate = dayjs(value[0])
    const endDate = dayjs(value[1])
    if (!startDate.isValid() || !endDate.isValid()) {
      nextValues[key] = undefined
      return
    }
    const format = valueType === 'dateTimeRange' ? DATETIME_FORMAT : DATE_FORMAT
    nextValues[key] = [startDate.format(format), endDate.format(format)]
  })

  // 应用 transform 并删除原始字段
  const transformedValues: Record<string, any> = {}
  columnsWithTransform.forEach((col) => {
    const name = col.dataIndex as string
    const rawValue = nextValues[name]
    if (rawValue === '' || rawValue === undefined || rawValue === null) return

    const transform = (col.search as any).transform
    const result = transform(rawValue, name, nextValues)
    if (result === undefined || result === null) return

    delete nextValues[name] // 删除原始字段
    if (isPlainObject(result)) {
      Object.assign(transformedValues, result)
    } else {
      transformedValues[name] = result
    }
  })

  // 过滤空值
  return Object.fromEntries(
    Object.entries({ ...nextValues, ...transformedValues }).filter(
      ([, value]) => value !== '' && value !== undefined && value !== null,
    ),
  ) as T
}
