import { useEffect, useState } from 'react'
import { Input } from 'antd'
import { CalendarPicker, DatePicker } from 'antd-mobile'
import { DATETIME_FORMAT, DATE_FORMAT, type DateRangeValue, formatDate } from './utils'

// 日期范围选择器
type DateRangeFieldProps = {
  value?: DateRangeValue
  onChange?: (value?: DateRangeValue) => void
  placeholder?: string
}

export const DateRangeField = ({ value, onChange, placeholder }: DateRangeFieldProps) => {
  const [visible, setVisible] = useState(false)
  const hasValue = value?.[0] && value?.[1]
  const displayValue = hasValue ? `${formatDate(value?.[0], DATE_FORMAT)} ~ ${formatDate(value?.[1], DATE_FORMAT)}` : ''

  return (
    <>
      <Input placeholder={placeholder} readOnly value={displayValue} onClick={() => setVisible(true)} />
      <CalendarPicker
        selectionMode="range"
        visible={visible}
        value={hasValue ? [value![0]!, value![1]!] : null}
        onClose={() => setVisible(false)}
        onConfirm={(nextValue) => {
          setVisible(false)
          onChange?.(nextValue ?? undefined)
        }}
      />
    </>
  )
}

// 日期时间范围选择器
type DateTimeRangeFieldProps = {
  value?: DateRangeValue
  onChange?: (value?: DateRangeValue) => void
  placeholders?: [string, string]
  fieldName?: string
  onValueChange?: (fieldName: string, value: DateRangeValue) => void
}

export const DateTimeRangeField = ({
  value,
  onChange,
  placeholders,
  fieldName,
  onValueChange,
}: DateTimeRangeFieldProps) => {
  const [startPlaceholder, endPlaceholder] = placeholders ?? ['开始时间', '结束时间']
  const [internalValue, setInternalValue] = useState<DateRangeValue>(value)

  useEffect(() => {
    setInternalValue(value)
  }, [value])

  const updateValue = (newValue: DateRangeValue) => {
    setInternalValue(newValue)
    if (fieldName && onValueChange) {
      onValueChange(fieldName, newValue)
    }
    onChange?.(newValue)
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <DatePicker
        precision="second"
        value={internalValue?.[0] ?? null}
        onConfirm={(v) => updateValue([v, internalValue?.[1] ?? null])}
      >
        {(pickerValue, actions) => (
          <Input
            placeholder={startPlaceholder}
            readOnly
            value={formatDate(pickerValue, DATETIME_FORMAT)}
            onClick={actions.open}
          />
        )}
      </DatePicker>
      <DatePicker
        precision="second"
        value={internalValue?.[1] ?? null}
        onConfirm={(v) => updateValue([internalValue?.[0] ?? null, v])}
      >
        {(pickerValue, actions) => (
          <Input
            placeholder={endPlaceholder}
            readOnly
            value={formatDate(pickerValue, DATETIME_FORMAT)}
            onClick={actions.open}
          />
        )}
      </DatePicker>
    </div>
  )
}
