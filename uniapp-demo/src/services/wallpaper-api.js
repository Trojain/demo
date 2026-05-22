import { WALLPAPER_API_CONFIG, WALLPAPER_CARD_TONES } from '@/config/wallpaper'
import { normalizeDisplayText, normalizeDisplayTextList } from '@/utils/display-text'

export const WALLPAPER_ERROR_CODES = {
  REQUEST_FAILED: 'WALLPAPER_REQUEST_FAILED'
}

function buildQueryString(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined && params[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function createWallpaperError(message, detail = {}) {
  const error = new Error(message)
  error.code = WALLPAPER_ERROR_CODES.REQUEST_FAILED
  error.detail = detail
  return error
}

function normalizeImageUrl(url) {
  if (!url) {
    return ''
  }

  if (url.startsWith('//')) {
    return `https:${url}`
  }

  if (url.startsWith('http://p') || url.startsWith('http://img')) {
    return url.replace('http://', 'https://')
  }

  return url
}

function sanitizeTags(tagText) {
  if (!tagText) {
    return []
  }

  return normalizeDisplayTextList(
    String(tagText)
    .split(/[，,]/)
    .map(item => item.trim())
    .filter(Boolean)
  )
}

function buildWallpaperTitle(item) {
  if (item.utag) {
    return item.utag
  }

  const tags = sanitizeTags(item.tag)
  if (tags.length > 0) {
    return tags[0]
  }

  return item.title || item.imgcut || '高清壁纸'
}

function buildWallpaperResolution(item) {
  const width = item.img_width || item.width || 0
  const height = item.img_height || item.height || 0

  if (width && height) {
    return `${width} x ${height}`
  }

  return item.resolution || item.rdata || ''
}

function buildWallpaperTime(item) {
  return item.create_time || item.update_time || ''
}

function requestWallpaperApi(url, params) {
  const finalUrl = `${url}?${buildQueryString(params)}`

  return new Promise((resolve, reject) => {
    uni.request({
      url: finalUrl,
      method: 'GET',
      timeout: 12000,
      success: (res) => {
        const statusCode = res.statusCode || 0

        if (statusCode >= 200 && statusCode < 300) {
          resolve(res.data || {})
          return
        }

        reject(createWallpaperError(`壁纸接口请求失败：${statusCode}`, { statusCode, data: res.data }))
      },
      fail: (error) => {
        reject(createWallpaperError('壁纸网络请求失败', { error }))
      }
    })
  })
}

function normalizeCategory(item, index) {
  return {
    id: String(item.id || item.cid || index + 1),
    label: normalizeDisplayText(item.name || `分类 ${index + 1}`),
    tone: WALLPAPER_CARD_TONES[index % WALLPAPER_CARD_TONES.length],
    orderNum: Number(item.order_num || 0),
    tag: normalizeDisplayText(item.tag || ''),
    createTime: item.create_time || ''
  }
}

function normalizeWallpaper(item, index) {
  const previewUrl = normalizeImageUrl(
    item.img_1024_768 ||
      item.img_960_540 ||
      item.img_800_600 ||
      item.cover ||
      item.thumb ||
      item.url
  )
  const imageUrl = normalizeImageUrl(
    item.url ||
      item.img_1600_900 ||
      item.img_1440_900 ||
      item.img_1366_768 ||
      item.img_1280_800 ||
      item.img_1024_768 ||
      previewUrl
  )

  return {
    id: String(item.id || item.url || index + 1),
    title: normalizeDisplayText(buildWallpaperTitle(item)),
    utag: normalizeDisplayText(item.utag || ''),
    tags: sanitizeTags(item.tag),
    previewUrl,
    imageUrl,
    categoryId: String(item.cid || item.category_id || ''),
    categoryName: normalizeDisplayText(item.rname || item.category_name || ''),
    resolution: buildWallpaperResolution(item),
    createTime: buildWallpaperTime(item)
  }
}

export function fetchWallpaperCategories() {
  return requestWallpaperApi(WALLPAPER_API_CONFIG.categoryUrl, {
    c: 'WallPaper',
    a: 'getAllCategoriesV2',
    from: '360chrome'
  }).then((data) => {
    return Array.isArray(data.data) ? data.data.map(normalizeCategory) : []
  })
}

export function fetchWallpaperByCategory(params = {}) {
  const page = params.page || 1
  const pageSize = Math.min(params.pageSize || WALLPAPER_API_CONFIG.defaultPageSize, WALLPAPER_API_CONFIG.maxPageSize)
  const start = (page - 1) * pageSize + 1

  return requestWallpaperApi(WALLPAPER_API_CONFIG.listUrl, {
    c: 'WallPaper',
    a: 'getAppsByCategory',
    cid: params.categoryId,
    start,
    count: pageSize,
    from: '360chrome'
  }).then((data) => {
    const rawList = Array.isArray(data.data) ? data.data : []
    const list = rawList.map(normalizeWallpaper).filter(item => item.imageUrl || item.previewUrl)

    return {
      page,
      pageSize,
      list,
      isFinished: list.length < pageSize
    }
  })
}
