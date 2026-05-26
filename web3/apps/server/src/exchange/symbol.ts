export function toOkxInstId(symbol: string) {
  const normalized = symbol.trim().toUpperCase()
  if (normalized.includes('-')) {
    return normalized
  }

  if (normalized.endsWith('USDT')) {
    return `${normalized.slice(0, -4)}-USDT`
  }

  return normalized
}

export function toBinanceSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replaceAll('-', '')
}

export function toDisplaySymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase()
  if (normalized.includes('-')) {
    return normalized
  }

  if (normalized.endsWith('USDT')) {
    return `${normalized.slice(0, -4)}-USDT`
  }

  return normalized
}
