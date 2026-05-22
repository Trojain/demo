// 统一处理接口返回的展示文案，避免敏感词直接透出到页面。
export function normalizeDisplayText(value) {
  if (typeof value !== 'string') {
    return value || ''
  }

  return value.replace(/美女/g, '女神')
}

export function normalizeDisplayTextList(list = []) {
  return list.map(item => normalizeDisplayText(item)).filter(Boolean)
}
