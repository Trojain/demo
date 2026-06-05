/**
 * 生成服务端本地日期字符串。
 * 当前运行环境固定为本地服务器时区，用于风控日维度统计与快照归档。
 */
export function formatLocalDate(input: Date) {
  const year = input.getFullYear()
  const month = String(input.getMonth() + 1).padStart(2, '0')
  const day = String(input.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 按本地日历天偏移日期字符串。
 */
export function shiftLocalDate(date: string, offsetDays: number) {
  const current = new Date(`${date}T00:00:00`)
  current.setDate(current.getDate() + offsetDays)
  return formatLocalDate(current)
}

/**
 * 将 ISO 时间或 Date 对象转换为服务端本地日期字符串。
 * 用于保证日报聚合、趋势图和明细查询都走同一归档口径。
 */
export function toLocalDateString(input: string | Date) {
  const value = input instanceof Date ? input : new Date(input)
  return formatLocalDate(value)
}
