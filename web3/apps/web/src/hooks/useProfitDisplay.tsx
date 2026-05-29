import { useMemo, type ReactNode } from 'react'
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'
import { Typography } from 'antd'
import { Decimal } from 'decimal.js'

interface ProfitDisplayOptions {
  /** 后缀文案，例如 USDT 或 % */
  suffix?: string
  /** 最大小数位 */
  maximumFractionDigits?: number
}

const PROFIT_COLOR = '#16a34a'
const LOSS_COLOR = '#dc2626'
const ZERO_COLOR = '#667085'

function parseDecimal(value?: string | number) {
  try {
    const decimal = new Decimal(value ?? 0)
    return decimal.isFinite() ? decimal : new Decimal(0)
  } catch {
    return new Decimal(0)
  }
}

function formatAbsValue(value: Decimal, maximumFractionDigits: number) {
  return value.abs().toNumber().toLocaleString(undefined, {
    maximumFractionDigits,
  })
}

export function useProfitDisplay() {
  return useMemo(() => {
    const render = (value?: string | number, options?: ProfitDisplayOptions): ReactNode => {
      const decimal = parseDecimal(value)
      const suffix = options?.suffix ? ` ${options.suffix.trim()}` : ''
      const maximumFractionDigits = options?.maximumFractionDigits ?? 4

      if (decimal.isZero()) {
        return (
          <Typography.Text style={{ color: ZERO_COLOR }}>
            {formatAbsValue(decimal, maximumFractionDigits)}
            {suffix}
          </Typography.Text>
        )
      }

      const profitable = decimal.greaterThan(0)
      const color = profitable ? PROFIT_COLOR : LOSS_COLOR
      const Icon = profitable ? ArrowUpOutlined : ArrowDownOutlined

      return (
        <Typography.Text style={{ color, fontWeight: 600 }}>
          <Icon style={{ marginRight: 4 }} />
          {formatAbsValue(decimal, maximumFractionDigits)}
          {suffix}
        </Typography.Text>
      )
    }

    return {
      /** 盈亏金额展示，盈利为绿色向上箭头，亏损为红色向下箭头 */
      renderMoney: (value?: string | number, suffix = 'USDT') => render(value, { suffix, maximumFractionDigits: 4 }),
      /** 盈亏比例展示，盈利为绿色向上箭头，亏损为红色向下箭头 */
      renderPercent: (value?: string | number) => render(value, { suffix: '%', maximumFractionDigits: 2 }),
      /** 自定义后缀和精度的盈亏展示 */
      render,
    }
  }, [])
}
