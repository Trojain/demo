import { MATERIAL_API_CONFIG } from '@/config/material'
import { DEFAULT_MATERIAL_FILTERS } from '@/config/material-options'
import { normalizeDisplayText } from '@/utils/display-text'

export const MATERIAL_ERROR_CODES = {
  RATE_LIMIT: 'MATERIAL_RATE_LIMIT',
  REQUEST_FAILED: 'MATERIAL_REQUEST_FAILED'
}

function buildQueryString(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined && params[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function stringifyResponseData(data) {
  if (typeof data === 'string') {
    return data
  }

  try {
    return JSON.stringify(data || {})
  } catch (_error) {
    return ''
  }
}

function isRateLimitResponse(statusCode, data) {
  const responseText = stringifyResponseData(data).toLowerCase()

  return (
    statusCode === 429 ||
    responseText.includes('rate') ||
    responseText.includes('limit') ||
    responseText.includes('too many')
  )
}

function createMaterialError(message, code, detail = {}) {
  const error = new Error(message)
  error.code = code
  error.detail = detail
  return error
}

function normalizeImage(item) {
  return {
    mediaType: 'image',
    id: item.id,
    pageURL: item.pageURL,
    type: item.type,
    tags: normalizeDisplayText(item.tags || ''),
    previewURL: item.previewURL,
    webformatURL: item.webformatURL,
    largeImageURL: item.largeImageURL || item.webformatURL,
    imageWidth: item.imageWidth,
    imageHeight: item.imageHeight,
    user: item.user || '素材来源',
    userImageURL: item.userImageURL,
    views: item.views || 0,
    downloads: item.downloads || 0,
    likes: item.likes || 0
  }
}

function normalizeVideo(item) {
  const videos = item.videos || {}
  const video = videos.medium || videos.small || videos.large || videos.tiny || {}

  return {
    mediaType: 'video',
    id: item.id,
    pageURL: item.pageURL,
    type: item.type || 'video',
    tags: normalizeDisplayText(item.tags || ''),
    previewURL: video.thumbnail || '',
    webformatURL: video.thumbnail || '',
    largeImageURL: video.thumbnail || '',
    videoURL: video.url || '',
    imageWidth: video.width || 0,
    imageHeight: video.height || 0,
    duration: item.duration || 0,
    user: item.user || '素材来源',
    userImageURL: item.userImageURL,
    views: item.views || 0,
    downloads: item.downloads || 0,
    likes: item.likes || 0
  }
}

export function searchMaterialAssets(filters = {}) {
  const mergedFilters = {
    ...DEFAULT_MATERIAL_FILTERS,
    ...filters
  }

  const isVideoSearch = mergedFilters.media_type === 'video'
  const requestUrl = isVideoSearch ? MATERIAL_API_CONFIG.videoBaseUrl : MATERIAL_API_CONFIG.baseUrl
  const requestParams = {
    key: MATERIAL_API_CONFIG.apiKey,
    q: mergedFilters.q,
    category: mergedFilters.category,
    editors_choice: mergedFilters.editors_choice ? 'true' : 'false',
    order: mergedFilters.order,
    lang: mergedFilters.lang,
    safesearch: 'true',
    page: mergedFilters.page || 1,
    per_page: Math.min(mergedFilters.per_page || MATERIAL_API_CONFIG.defaultPageSize, MATERIAL_API_CONFIG.maxPageSize)
  }

  if (isVideoSearch) {
    requestParams.video_type = mergedFilters.video_type
  } else {
    requestParams.image_type = mergedFilters.image_type
    requestParams.orientation = mergedFilters.orientation
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${requestUrl}?${buildQueryString(requestParams)}`,
      method: 'GET',
      timeout: 12000,
      success: (res) => {
        const statusCode = res.statusCode || 0

        if (statusCode >= 200 && statusCode < 300) {
          const data = res.data || {}
          const normalizeItem = isVideoSearch ? normalizeVideo : normalizeImage
          const list = Array.isArray(data.hits) ? data.hits.map(normalizeItem) : []

          resolve({
            total: data.total || 0,
            totalHits: data.totalHits || 0,
            list
          })
          return
        }

        reject(
          createMaterialError(
            `素材请求失败：${statusCode}`,
            isRateLimitResponse(statusCode, res.data) ? MATERIAL_ERROR_CODES.RATE_LIMIT : MATERIAL_ERROR_CODES.REQUEST_FAILED,
            {
              statusCode,
              data: res.data
            }
          )
        )
      },
      fail: (error) => {
        reject(
          createMaterialError('素材网络请求失败', MATERIAL_ERROR_CODES.REQUEST_FAILED, {
            error
          })
        )
      }
    })
  })
}
