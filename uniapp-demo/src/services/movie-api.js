import {
  MOVIE_API_CONFIG,
  MOVIE_DISCOVER_SORT_OPTIONS,
  MOVIE_HOME_SECTION_LIMITS
} from '@/config/movie'
import { normalizeDisplayText } from '@/utils/display-text'

export const MOVIE_ERROR_CODES = {
  REQUEST_FAILED: 'MOVIE_REQUEST_FAILED',
  NETWORK_FAILED: 'MOVIE_NETWORK_FAILED',
  AUTH_FAILED: 'MOVIE_AUTH_FAILED',
  REMOTE_FAILED: 'MOVIE_REMOTE_FAILED'
}

let cachedImageBaseUrl = ''
let imageBaseUrlPromise = null

function buildQueryString(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined && params[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function createMovieError(message, detail = {}) {
  const error = new Error(message)
  error.code = detail.code || MOVIE_ERROR_CODES.REQUEST_FAILED
  error.detail = detail
  return error
}

function requestMovieApi(path, params = {}, options = {}) {
  const queryParams = options.includeLanguage === false
    ? { ...params }
    : { language: MOVIE_API_CONFIG.defaultLanguage, ...params }
  const headers = {
    accept: 'application/json'
  }

  if (MOVIE_API_CONFIG.authMode === 'apiKey') {
    queryParams.api_key = MOVIE_API_CONFIG.apiKey
  } else {
    headers.Authorization = `Bearer ${MOVIE_API_CONFIG.bearerToken}`
  }

  const requestUrl = `${MOVIE_API_CONFIG.baseUrl}${path}?${buildQueryString(queryParams)}`

  return new Promise((resolve, reject) => {
    uni.request({
      url: requestUrl,
      method: 'GET',
      timeout: 12000,
      header: headers,
      success: (res) => {
        const statusCode = res.statusCode || 0
        const responseData = res.data || {}

        if (statusCode >= 200 && statusCode < 300) {
          if (responseData.success === false) {
            reject(createMovieError(responseData.status_message || '影视接口返回失败', {
              code: MOVIE_ERROR_CODES.REMOTE_FAILED,
              statusCode,
              data: responseData
            }))
            return
          }

          resolve(responseData)
          return
        }

        const errorCode = statusCode === 401 || statusCode === 403
          ? MOVIE_ERROR_CODES.AUTH_FAILED
          : MOVIE_ERROR_CODES.REQUEST_FAILED

        reject(createMovieError(`影视接口请求失败：${statusCode}`, {
          code: errorCode,
          statusCode,
          data: responseData
        }))
      },
      fail: (error) => {
        reject(createMovieError('影视接口网络请求失败', {
          code: MOVIE_ERROR_CODES.NETWORK_FAILED,
          error
        }))
      }
    })
  })
}

export function getMovieErrorMessage(error) {
  if (error?.code === MOVIE_ERROR_CODES.NETWORK_FAILED) {
    return '当前网络无法连接 TMDB，请检查代理、合法域名或调试器网络环境'
  }

  if (error?.code === MOVIE_ERROR_CODES.AUTH_FAILED) {
    return 'TMDB 认证失败，请检查 authMode、Bearer Token 或 API Key 配置'
  }

  const remoteMessage = normalizeDisplayText(
    error?.detail?.data?.status_message ||
      error?.detail?.error?.errMsg ||
      error?.message ||
      ''
  )

  return remoteMessage || '影视接口请求失败'
}

// 图片基础地址理论上可通过 /configuration 获取，这里做一次缓存，失败时再回退到 TMDB 官方固定域名。
function getImageBaseUrl() {
  if (cachedImageBaseUrl) {
    return Promise.resolve(cachedImageBaseUrl)
  }

  if (imageBaseUrlPromise) {
    return imageBaseUrlPromise
  }

  imageBaseUrlPromise = requestMovieApi('/configuration', {}, { includeLanguage: false })
    .then((data) => {
      const secureBaseUrl = data?.images?.secure_base_url || MOVIE_API_CONFIG.imageFallbackBaseUrl
      cachedImageBaseUrl = secureBaseUrl
      return secureBaseUrl
    })
    .catch(() => {
      cachedImageBaseUrl = MOVIE_API_CONFIG.imageFallbackBaseUrl
      return cachedImageBaseUrl
    })

  return imageBaseUrlPromise
}

function buildImageUrl(baseUrl, size, filePath) {
  if (!filePath) {
    return ''
  }

  return `${baseUrl}${size}${filePath}`
}

function normalizeGenre(genre) {
  return {
    id: String(genre.id || ''),
    label: normalizeDisplayText(genre.name || '')
  }
}

function buildTitle(item) {
  return normalizeDisplayText(
    item.title ||
      item.name ||
      item.original_title ||
      item.original_name ||
      '未命名影视'
  )
}

function buildOriginalTitle(item) {
  return normalizeDisplayText(item.original_title || item.original_name || '')
}

function buildReleaseDate(item) {
  return item.release_date || item.first_air_date || ''
}

function buildMediaType(item, forcedType = '') {
  if (forcedType) {
    return forcedType
  }

  return item.media_type === 'tv' ? 'tv' : 'movie'
}

function normalizeMediaCard(item, imageBaseUrl, forcedType = '') {
  const mediaType = buildMediaType(item, forcedType)

  return {
    id: String(item.id || ''),
    mediaType,
    title: buildTitle(item),
    originalTitle: buildOriginalTitle(item),
    overview: normalizeDisplayText(item.overview || ''),
    posterUrl: buildImageUrl(imageBaseUrl, 'w500', item.poster_path),
    backdropUrl: buildImageUrl(imageBaseUrl, 'w780', item.backdrop_path),
    voteAverage: Number(item.vote_average || 0),
    voteCount: Number(item.vote_count || 0),
    releaseDate: buildReleaseDate(item),
    genreIds: Array.isArray(item.genre_ids) ? item.genre_ids.map(id => String(id)) : [],
    popularity: Number(item.popularity || 0)
  }
}

function normalizeMediaDetail(item, imageBaseUrl, mediaType) {
  return {
    id: String(item.id || ''),
    mediaType,
    title: buildTitle(item),
    originalTitle: buildOriginalTitle(item),
    overview: normalizeDisplayText(item.overview || ''),
    tagline: normalizeDisplayText(item.tagline || ''),
    posterUrl: buildImageUrl(imageBaseUrl, 'w500', item.poster_path),
    backdropUrl: buildImageUrl(imageBaseUrl, 'w1280', item.backdrop_path),
    voteAverage: Number(item.vote_average || 0),
    voteCount: Number(item.vote_count || 0),
    releaseDate: buildReleaseDate(item),
    status: normalizeDisplayText(item.status || ''),
    originalLanguage: item.original_language || '',
    genres: Array.isArray(item.genres) ? item.genres.map(normalizeGenre) : [],
    runtime: Number(item.runtime || 0),
    numberOfSeasons: Number(item.number_of_seasons || 0),
    numberOfEpisodes: Number(item.number_of_episodes || 0),
    episodeRunTime: Array.isArray(item.episode_run_time) ? item.episode_run_time : [],
    originCountry: Array.isArray(item.origin_country) ? item.origin_country.join(' / ') : '',
    productionCountries: Array.isArray(item.production_countries)
      ? item.production_countries.map(country => normalizeDisplayText(country.name || '')).join(' / ')
      : ''
  }
}

function normalizeRecommendationList(results, imageBaseUrl, mediaType) {
  return Array.isArray(results)
    ? results.map(item => normalizeMediaCard(item, imageBaseUrl, mediaType))
    : []
}

function buildDiscoverParams(filters = {}) {
  const params = {
    page: filters.page || MOVIE_API_CONFIG.defaultPage,
    sort_by: filters.sortBy || MOVIE_DISCOVER_SORT_OPTIONS[0].value
  }

  if (filters.genreId) {
    params.with_genres = filters.genreId
  }

  if (filters.year) {
    params.primary_release_year = filters.year
  }

  // 高分排序时增加投票门槛，避免被低票数长尾影片干扰。
  if (params.sort_by === 'vote_average.desc') {
    params['vote_count.gte'] = 200
  }

  return params
}

export function createMovieYearOptions() {
  const currentYear = new Date().getFullYear()
  const options = [{ label: '全部年份', value: '' }]

  for (let index = 0; index < 6; index += 1) {
    const year = String(currentYear - index)
    options.push({
      label: year,
      value: year
    })
  }

  return options
}

export function fetchMovieGenres() {
  return requestMovieApi('/genre/movie/list').then((data) => {
    const genres = Array.isArray(data.genres) ? data.genres.map(normalizeGenre) : []
    return genres
  })
}

export function fetchMovieHomeData() {
  return Promise.all([
    getImageBaseUrl(),
    requestMovieApi('/movie/popular', { page: 1 }),
    requestMovieApi('/tv/popular', { page: 1 }),
    // 趋势接口同样支持 language，这里保持与模块统一的中文返回策略。
    requestMovieApi('/trending/all/day', { page: 1 }),
    fetchMovieGenres()
  ]).then(([imageBaseUrl, movieData, tvData, trendingData, genres]) => {
    const popularMovies = Array.isArray(movieData.results)
      ? movieData.results
          .map(item => normalizeMediaCard(item, imageBaseUrl, 'movie'))
          .slice(0, MOVIE_HOME_SECTION_LIMITS.popularMovieCount)
      : []
    const popularTvShows = Array.isArray(tvData.results)
      ? tvData.results
          .map(item => normalizeMediaCard(item, imageBaseUrl, 'tv'))
          .slice(0, MOVIE_HOME_SECTION_LIMITS.popularTvCount)
      : []
    const trendingItems = Array.isArray(trendingData.results)
      ? trendingData.results
          .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
          .map(item => normalizeMediaCard(item, imageBaseUrl))
          .slice(0, MOVIE_HOME_SECTION_LIMITS.trendingCount)
      : []

    return {
      popularMovies,
      popularTvShows,
      trendingItems,
      genres: genres.slice(0, MOVIE_HOME_SECTION_LIMITS.genreCount)
    }
  })
}

export function discoverMovies(filters = {}) {
  return Promise.all([
    getImageBaseUrl(),
    requestMovieApi('/discover/movie', buildDiscoverParams(filters))
  ]).then(([imageBaseUrl, data]) => {
    const list = Array.isArray(data.results)
      ? data.results.map(item => normalizeMediaCard(item, imageBaseUrl, 'movie'))
      : []

    return {
      page: Number(data.page || filters.page || MOVIE_API_CONFIG.defaultPage),
      totalPages: Number(data.total_pages || 0),
      totalResults: Number(data.total_results || 0),
      list
    }
  })
}

export function searchMovieMedia(filters = {}) {
  const searchType = filters.searchType || 'movie'
  const endpoint = searchType === 'tv' ? '/search/tv' : searchType === 'multi' ? '/search/multi' : '/search/movie'

  return Promise.all([
    getImageBaseUrl(),
    requestMovieApi(endpoint, {
      query: filters.keyword,
      page: filters.page || MOVIE_API_CONFIG.defaultPage,
      include_adult: false
    })
  ]).then(([imageBaseUrl, data]) => {
    const rawList = Array.isArray(data.results) ? data.results : []
    const list = rawList
      .filter(item => searchType !== 'multi' || item.media_type === 'movie' || item.media_type === 'tv')
      .map(item => normalizeMediaCard(item, imageBaseUrl, searchType === 'multi' ? '' : searchType))

    return {
      page: Number(data.page || filters.page || MOVIE_API_CONFIG.defaultPage),
      totalPages: Number(data.total_pages || 0),
      totalResults: Number(data.total_results || 0),
      list
    }
  })
}

export function fetchMovieDetail(params = {}) {
  const mediaType = params.mediaType === 'tv' ? 'tv' : 'movie'

  return Promise.all([
    getImageBaseUrl(),
    requestMovieApi(`/${mediaType}/${params.id}`)
  ]).then(([imageBaseUrl, data]) => {
    return normalizeMediaDetail(data, imageBaseUrl, mediaType)
  })
}

export function fetchMovieRecommendations(params = {}) {
  const mediaType = params.mediaType === 'tv' ? 'tv' : 'movie'

  return Promise.all([
    getImageBaseUrl(),
    requestMovieApi(`/${mediaType}/${params.id}/recommendations`, { page: 1 })
  ]).then(([imageBaseUrl, data]) => {
    return normalizeRecommendationList(data.results, imageBaseUrl, mediaType).slice(0, 12)
  })
}
