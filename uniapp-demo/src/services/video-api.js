import { VIDEO_API_CONFIG, VIDEO_PLATFORM_OPTIONS } from '@/config/video'

export const VIDEO_ERROR_CODES = {
  TOKEN_MISSING: 'VIDEO_TOKEN_MISSING',
  UNSUPPORTED_PLATFORM: 'VIDEO_UNSUPPORTED_PLATFORM',
  LINK_EMPTY: 'VIDEO_LINK_EMPTY',
  RATE_LIMIT: 'VIDEO_RATE_LIMIT',
  AUTH_FAILED: 'VIDEO_AUTH_FAILED',
  QUOTA_EMPTY: 'VIDEO_QUOTA_EMPTY',
  REQUEST_FAILED: 'VIDEO_REQUEST_FAILED',
  DOWNLOAD_URL_MISSING: 'VIDEO_DOWNLOAD_URL_MISSING'
}

const VIDEO_ENDPOINTS = {
  douyin: '/api/v1/douyin/app/v3/fetch_one_video_by_share_url',
  kuaishou: '/api/v1/kuaishou/app/fetch_one_video_by_url',
  tiktok: '/api/v1/tiktok/app/v3/fetch_one_video_by_share_url'
}

function buildQueryString(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined && params[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function createVideoError(message, code, detail = {}) {
  const error = new Error(message)
  error.code = code
  error.detail = detail
  return error
}

function isConfiguredToken() {
  const token = VIDEO_API_CONFIG.token || ''
  return token && token !== '请替换为你的 TikHub Token'
}

function cleanShareUrl(url) {
  return String(url || '').replace(/[)\]}.,，。；;：:]+$/, '')
}

export function extractShareUrl(text) {
  const matchedList = String(text || '').match(/https?:\/\/[^\s"'<>]+/ig) || []
  const cleanedList = matchedList.map(cleanShareUrl).filter(Boolean)

  return cleanedList.find((url) => {
    const lowerUrl = url.toLowerCase()

    return (
      lowerUrl.includes('douyin.com') ||
      lowerUrl.includes('iesdouyin.com') ||
      lowerUrl.includes('kuaishou.com') ||
      lowerUrl.includes('gifshow.com') ||
      lowerUrl.includes('tiktok.com')
    )
  }) || cleanedList[0] || ''
}

export function detectVideoPlatform(text) {
  const link = extractShareUrl(text)
  const source = `${text || ''} ${link}`.toLowerCase()

  if (source.includes('douyin.com') || source.includes('iesdouyin.com')) {
    return 'douyin'
  }

  if (source.includes('kuaishou.com') || source.includes('gifshow.com')) {
    return 'kuaishou'
  }

  if (source.includes('tiktok.com')) {
    return 'tiktok'
  }

  return ''
}

function getPlatformLabel(platform) {
  const option = VIDEO_PLATFORM_OPTIONS.find((item) => item.value === platform)
  return option ? option.label : '视频平台'
}

function getObjectValue(target, paths) {
  for (let i = 0; i < paths.length; i += 1) {
    const segments = paths[i].split('.')
    let current = target

    for (let j = 0; j < segments.length; j += 1) {
      if (current === undefined || current === null) {
        current = undefined
        break
      }

      current = current[segments[j]]
    }

    if (current !== undefined && current !== null && current !== '') {
      return current
    }
  }

  return ''
}

function getFirstArrayValue(target, paths) {
  for (let i = 0; i < paths.length; i += 1) {
    const value = getObjectValue(target, [paths[i]])

    if (Array.isArray(value) && value.length) {
      const firstValue = value[0]

      if (typeof firstValue === 'string') {
        return firstValue
      }

      if (firstValue && typeof firstValue === 'object') {
        return firstValue.url || firstValue.cdn || firstValue.src || ''
      }
    }

    if (typeof value === 'string' && value) {
      return value
    }
  }

  return ''
}

function normalizeDuration(value) {
  const duration = Number(value || 0)

  if (!duration) {
    return 0
  }

  return duration > 1000 ? Math.round(duration / 1000) : Math.round(duration)
}

function normalizeCover(data) {
  return getFirstArrayValue(data, [
    'video_data.cover.url_list',
    'video_data.origin_cover.url_list',
    'video_data.dynamic_cover.url_list',
    'aweme_detail.video.cover.url_list',
    'aweme_detail.video.origin_cover.url_list',
    'itemInfo.itemStruct.video.cover.urlList',
    'itemInfo.itemStruct.video.originCover.urlList',
    'itemInfo.itemStruct.video.dynamicCover.urlList',
    'video.cover.urlList',
    'video.originCover.urlList',
    'video.dynamicCover.urlList',
    'photo.coverUrls',
    'photo.coverUrls.0.url',
    'photo.coverThumbnailUrls',
    'photo.coverThumbnailUrls.0.url',
    'cover.url_list',
    'origin_cover.url_list'
  ]) || getObjectValue(data, [
    'video_data.cover.url',
    'video_data.cover',
    'coverUrl',
    'cover_url',
    'cover',
    'thumbnail',
    'poster',
    'itemInfo.itemStruct.video.cover',
    'itemInfo.itemStruct.video.originCover',
    'video.cover',
    'video.originCover'
  ])
}

function normalizeVideoUrl(data) {
  return getObjectValue(data, [
    'original_video_url',
    'video_url',
    'download_url',
    'downloadUrl',
    'play_url',
    'playUrl',
    'videoData.url',
    'itemInfo.itemStruct.video.playAddr',
    'itemInfo.itemStruct.video.downloadAddr',
    'itemInfo.itemStruct.video.playUrl',
    'itemInfo.itemStruct.video.downloadUrl',
    'video.playAddr',
    'video.downloadAddr',
    'video.playUrl',
    'video.downloadUrl',
    'photo.photoUrl',
    'photo.mainMvUrls.0.url'
  ]) || getFirstArrayValue(data, [
    'video_data.play_addr.url_list',
    'video_data.download_addr.url_list',
    'aweme_detail.video.play_addr.url_list',
    'aweme_detail.video.download_addr.url_list',
    'itemInfo.itemStruct.video.playAddr.urlList',
    'itemInfo.itemStruct.video.downloadAddr.urlList',
    'video.playAddr.urlList',
    'video.downloadAddr.urlList',
    'video.play_addr.url_list',
    'video.download_addr.url_list',
    'mainMvUrls',
    'photo.mainMvUrls'
  ])
}

function normalizeVideoData(platform, responseData, sourceText, link) {
  const data = responseData && responseData.data ? responseData.data : responseData || {}
  const videoData = getObjectValue(data, ['video_data']) || {}
  const author = getObjectValue(data, [
    'author.nickname',
    'author.name',
    'aweme_detail.author.nickname',
    'itemInfo.itemStruct.author.nickname',
    'itemInfo.itemStruct.author.uniqueId',
    'itemInfo.itemStruct.author.id',
    'photo.userName',
    'photo.user_name',
    'user.name',
    'userName'
  ])
  const title = getObjectValue(data, [
    'desc',
    'title',
    'caption',
    'aweme_detail.desc',
    'itemInfo.itemStruct.desc',
    'itemInfo.itemStruct.contents.0.desc',
    'photo.caption',
    'photo.title',
    'share_info.share_title'
  ])
  const videoUrl = normalizeVideoUrl(data)
  const coverUrl = normalizeCover(data)
  const duration = normalizeDuration(getObjectValue(data, [
    'duration',
    'video_data.duration',
    'aweme_detail.video.duration',
    'itemInfo.itemStruct.video.duration',
    'photo.duration',
    'video.duration'
  ]))

  return {
    platform,
    platformLabel: getPlatformLabel(platform),
    sourceText,
    sourceUrl: link,
    title: title || '视频作品',
    author: author || '作者',
    coverUrl,
    videoUrl,
    duration,
    videoId: getObjectValue(data, [
      'video_id',
      'aweme_id',
      'aweme_detail.aweme_id',
      'itemInfo.itemStruct.id',
      'itemInfo.itemStruct.id_str',
      'photo.id',
      'id'
    ]),
    width: getObjectValue(videoData, ['width']) || getObjectValue(data, ['photo.width', 'video.width', 'itemInfo.itemStruct.video.width']),
    height: getObjectValue(videoData, ['height']) || getObjectValue(data, ['photo.height', 'video.height', 'itemInfo.itemStruct.video.height'])
  }
}

function mapRequestError(statusCode, data) {
  const code = Number(statusCode || data?.code || 0)

  if (code === 401 || code === 403) {
    return VIDEO_ERROR_CODES.AUTH_FAILED
  }

  if (code === 402) {
    return VIDEO_ERROR_CODES.QUOTA_EMPTY
  }

  if (code === 429) {
    return VIDEO_ERROR_CODES.RATE_LIMIT
  }

  return VIDEO_ERROR_CODES.REQUEST_FAILED
}

function requestTikHub(path, params) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${VIDEO_API_CONFIG.baseUrl}${path}?${buildQueryString(params)}`,
      method: 'GET',
      timeout: VIDEO_API_CONFIG.timeout,
      header: {
        Authorization: `Bearer ${VIDEO_API_CONFIG.token}`
      },
      success: (res) => {
        const statusCode = res.statusCode || 0
        const data = res.data || {}
        const responseCode = Number(data.code || statusCode)

        if (statusCode >= 200 && statusCode < 300 && responseCode >= 200 && responseCode < 300) {
          resolve(data)
          return
        }

        reject(createVideoError(data.message_zh || data.message || '视频解析失败', mapRequestError(statusCode, data), {
          statusCode,
          data
        }))
      },
      fail: (error) => {
        reject(createVideoError('视频解析请求失败', VIDEO_ERROR_CODES.REQUEST_FAILED, {
          error
        }))
      }
    })
  })
}

export function parseShortVideo(sourceText) {
  const link = extractShareUrl(sourceText)

  if (!String(sourceText || '').trim()) {
    return Promise.reject(createVideoError('请先粘贴视频分享链接', VIDEO_ERROR_CODES.LINK_EMPTY))
  }

  if (!link) {
    return Promise.reject(createVideoError('未识别到有效链接', VIDEO_ERROR_CODES.LINK_EMPTY))
  }

  if (!isConfiguredToken()) {
    return Promise.reject(createVideoError('请先配置 TikHub Token', VIDEO_ERROR_CODES.TOKEN_MISSING))
  }

  const platform = detectVideoPlatform(sourceText)

  if (!platform) {
    return Promise.reject(createVideoError('暂只支持抖音、快手和 TikTok 链接', VIDEO_ERROR_CODES.UNSUPPORTED_PLATFORM))
  }

  let params = {}

  if (platform === 'douyin') {
    params = {
      share_url: link
    }
  }

  if (platform === 'kuaishou') {
    params = {
      // 快手 App 接口使用 share_text，直接传入完整分享文案能兼容复制口令和裸链接。
      share_text: sourceText
    }
  }

  if (platform === 'tiktok') {
    params = {
      share_url: link
    }
  }

  return requestTikHub(VIDEO_ENDPOINTS[platform], params).then((responseData) => {
    const video = normalizeVideoData(platform, responseData, sourceText, link)

    if (!video.videoUrl) {
      throw createVideoError('接口未返回可下载视频地址', VIDEO_ERROR_CODES.DOWNLOAD_URL_MISSING, {
        responseData
      })
    }

    return video
  })
}
