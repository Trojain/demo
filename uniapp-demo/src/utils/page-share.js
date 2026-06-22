const DEFAULT_SHARE_TITLE = 'uniapp-demo'

function getCurrentPage() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  return pages.length ? pages[pages.length - 1] : null
}

function getPageOptions(page) {
  if (!page) {
    return {}
  }

  return page.options || page.$page?.options || {}
}

function buildQueryString(options) {
  return Object.keys(options || {})
    .filter((key) => options[key] !== undefined && options[key] !== null && options[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`)
    .join('&')
}

function getCurrentSharePath() {
  const page = getCurrentPage()

  if (!page || !page.route) {
    return '/pages/index/index'
  }

  const queryString = buildQueryString(getPageOptions(page))
  return queryString ? `/${page.route}?${queryString}` : `/${page.route}`
}

// 微信朋友圈分享使用 query 字段，好友分享使用 path 字段。
function getCurrentShareQuery() {
  const page = getCurrentPage()
  return buildQueryString(getPageOptions(page))
}

export function createPageShareOptions(options = {}) {
  return {
    title: options.title || DEFAULT_SHARE_TITLE,
    path: options.path || getCurrentSharePath()
  }
}

export function createPageTimelineOptions(options = {}) {
  const query = getCurrentShareQuery()
  const shareOptions = {
    title: options.title || DEFAULT_SHARE_TITLE
  }

  if (query) {
    shareOptions.query = query
  }

  return shareOptions
}
