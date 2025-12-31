import { useState } from 'react'
import { Grid } from 'antd'

const { useBreakpoint } = Grid
const MOBILE_QUERY = '(max-width: 767.98px)'

function getInitialIsMobile(defaultValue = false) {
  if (typeof window === 'undefined' || !window.matchMedia) return defaultValue
  return window.matchMedia(MOBILE_QUERY).matches
}

export function useIsMobile(defaultValue = false): boolean {
  const screens = useBreakpoint()

  // initial 仅用于“首屏兜底”，只在首次渲染计算一次
  const [initial] = useState(() => getInitialIsMobile(defaultValue))

  const md = screens?.md
  return md === undefined ? initial : !md
}
