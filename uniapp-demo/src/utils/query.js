export function encodeQueryObject(query) {
  return encodeURIComponent(JSON.stringify(query || {}))
}

export function decodeQueryObject(value) {
  if (!value) {
    return {}
  }

  try {
    return JSON.parse(decodeURIComponent(value))
  } catch (_error) {
    return {}
  }
}
