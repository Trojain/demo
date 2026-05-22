import {
  TV_API_CONFIG,
  TV_GENRE_OPTIONS,
  TV_HOT_KEYWORDS,
  TV_REGION_OPTIONS,
  TV_SEARCH_HISTORY_KEY,
  TV_SEARCH_MODES
} from '@/config/tv'
import {
  mapTvCountryCode,
  mapTvGenreList,
  mapTvLanguage,
  mapTvPlatformType,
  mapTvStatus,
  mapTvType,
  normalizeDisplayText,
  normalizeDisplayTextList
} from '@/utils/display-text'

export const TV_ERROR_CODES = {
  REQUEST_FAILED: 'TV_REQUEST_FAILED',
  NETWORK_FAILED: 'TV_NETWORK_FAILED',
  RATE_LIMITED: 'TV_RATE_LIMITED',
  REMOTE_FAILED: 'TV_REMOTE_FAILED'
}

function createTvError(message, detail = {}) {
  const error = new Error(message)
  error.code = detail.code || TV_ERROR_CODES.REQUEST_FAILED
  error.detail = detail
  return error
}

function buildQueryString(params = {}) {
  return Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined && params[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function buildUrl(path, params = {}) {
  const queryString = buildQueryString(params)
  return queryString ? `${TV_API_CONFIG.baseUrl}${path}?${queryString}` : `${TV_API_CONFIG.baseUrl}${path}`
}

function requestTvApi(path, params = {}) {
  const requestUrl = buildUrl(path, params)

  return new Promise((resolve, reject) => {
    uni.request({
      url: requestUrl,
      method: 'GET',
      timeout: 12000,
      header: {
        accept: 'application/json'
      },
      success: (res) => {
        const statusCode = res.statusCode || 0
        const responseData = res.data

        if (statusCode >= 200 && statusCode < 300) {
          resolve(responseData)
          return
        }

        if (statusCode === 429) {
          reject(createTvError('TVmaze 请求过于频繁', {
            code: TV_ERROR_CODES.RATE_LIMITED,
            statusCode,
            data: responseData
          }))
          return
        }

        reject(createTvError(`TVmaze 接口请求失败：${statusCode}`, {
          code: TV_ERROR_CODES.REQUEST_FAILED,
          statusCode,
          data: responseData
        }))
      },
      fail: (error) => {
        reject(createTvError('TVmaze 网络请求失败', {
          code: TV_ERROR_CODES.NETWORK_FAILED,
          error
        }))
      }
    })
  })
}

export function getTvErrorMessage(error) {
  if (error?.code === TV_ERROR_CODES.RATE_LIMITED) {
    return 'TVmaze 请求频繁，请稍后再试'
  }

  if (error?.code === TV_ERROR_CODES.NETWORK_FAILED) {
    return '当前网络无法连接 TVmaze，请检查代理、合法域名或调试器网络环境'
  }

  return normalizeDisplayText(
    error?.detail?.error?.errMsg ||
      error?.message ||
      'TVmaze 接口请求失败'
  )
}

function stripHtmlTags(value) {
  return normalizeDisplayText(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function buildScoreValue(score) {
  const numericScore = Number(score || 0)
  return Number.isFinite(numericScore) ? numericScore : 0
}

function buildImageUrl(image, fallback = '') {
  if (!image) {
    return fallback
  }

  if (typeof image.url === 'string') {
    return image.url
  }

  return image.original || image.medium || fallback || ''
}

function buildCountryInfo(showOrPerson = {}) {
  const country = showOrPerson.country || showOrPerson.network?.country || showOrPerson.webChannel?.country || {}
  const countryCode = normalizeDisplayText(country.code || '')

  return {
    countryCode,
    countryName: mapTvCountryCode(countryCode) || normalizeDisplayText(country.name || '')
  }
}

function normalizeScheduleItem(item, listType) {
  const show = item.show || item._embedded?.show || {}
  const rawEpisodeTitle = normalizeDisplayText(item.name || '')
  const rawShowName = normalizeDisplayText(show.name || '')
  const countryInfo = buildCountryInfo(show)

  return {
    id: String(item.id || show.id || ''),
    showId: String(show.id || ''),
    seasonId: String(item.season || ''),
    episodeNumber: Number(item.number || 0),
    seasonNumber: Number(item.season || 0),
    title: rawEpisodeTitle || rawShowName || '未命名单集',
    showName: rawShowName || rawEpisodeTitle || '未命名剧集',
    summary: stripHtmlTags(item.summary || show.summary || ''),
    airtime: item.airtime || show.schedule?.time || '',
    airstamp: item.airstamp || '',
    airdate: item.airdate || '',
    runtime: Number(item.runtime || show.runtime || 0),
    networkName: normalizeDisplayText(show.network?.name || show.webChannel?.name || ''),
    platformType: mapTvPlatformType(show.webChannel ? '流媒体' : '电视台'),
    listType,
    posterUrl: buildImageUrl(show.image),
    backdropUrl: buildImageUrl(show.image),
    rating: buildScoreValue(show.rating?.average),
    genres: mapTvGenreList(show.genres || []),
    countryCode: countryInfo.countryCode,
    countryName: countryInfo.countryName
  }
}

function normalizeShowCard(show) {
  const countryInfo = buildCountryInfo(show)

  return {
    id: String(show.id || ''),
    name: normalizeDisplayText(show.name || '未命名剧集'),
    summary: stripHtmlTags(show.summary || ''),
    status: mapTvStatus(show.status || ''),
    language: mapTvLanguage(show.language || ''),
    premiered: show.premiered || '',
    ended: show.ended || '',
    officialSite: show.officialSite || '',
    rating: buildScoreValue(show.rating?.average),
    weight: Number(show.weight || 0),
    genres: mapTvGenreList(show.genres || []),
    scheduleDays: normalizeDisplayTextList(show.schedule?.days || []),
    scheduleTime: show.schedule?.time || '',
    networkName: normalizeDisplayText(show.network?.name || show.webChannel?.name || ''),
    webChannelName: normalizeDisplayText(show.webChannel?.name || ''),
    imageUrl: buildImageUrl(show.image),
    posterUrl: buildImageUrl(show.image),
    backgroundUrl: buildImageUrl(show.image),
    type: mapTvType(show.type || ''),
    countryCode: countryInfo.countryCode,
    countryName: countryInfo.countryName
  }
}

function normalizePersonCard(person) {
  const countryInfo = buildCountryInfo(person)

  return {
    id: String(person.id || ''),
    name: normalizeDisplayText(person.name || '未命名演员'),
    country: countryInfo.countryName,
    countryCode: countryInfo.countryCode,
    birthday: person.birthday || '',
    deathday: person.deathday || '',
    gender: normalizeDisplayText(person.gender || ''),
    imageUrl: buildImageUrl(person.image),
    summary: ''
  }
}

function normalizeSeasonItem(season) {
  return {
    id: String(season.id || ''),
    number: Number(season.number || 0),
    episodeOrder: Number(season.episodeOrder || 0),
    premiereDate: season.premiereDate || '',
    endDate: season.endDate || '',
    imageUrl: buildImageUrl(season.image),
    summary: stripHtmlTags(season.summary || ''),
    title: `第 ${season.number || 0} 季`
  }
}

function normalizeEpisodeItem(episode) {
  return {
    id: String(episode.id || ''),
    name: normalizeDisplayText(episode.name || '未命名单集'),
    number: Number(episode.number || 0),
    season: Number(episode.season || 0),
    code: normalizeDisplayText(episode.code || ''),
    runtime: Number(episode.runtime || 0),
    airdate: episode.airdate || '',
    airtime: episode.airtime || '',
    airstamp: episode.airstamp || '',
    summary: stripHtmlTags(episode.summary || ''),
    imageUrl: buildImageUrl(episode.image)
  }
}

function normalizeCastItem(item) {
  const person = item.person || {}
  const character = item.character || {}

  return {
    id: String(person.id || ''),
    name: normalizeDisplayText(person.name || '未命名演员'),
    characterName: normalizeDisplayText(character.name || ''),
    imageUrl: buildImageUrl(person.image, buildImageUrl(character.image)),
    person
  }
}

function normalizeImageItem(item) {
  return {
    id: `${item.id || ''}-${item.type || ''}-${item.main ? 'main' : 'sub'}`,
    type: normalizeDisplayText(item.type || ''),
    isMain: Boolean(item.main),
    imageUrl: buildImageUrl(item.resolutions?.original, buildImageUrl(item.resolutions?.medium))
  }
}

function normalizeAkaItem(item) {
  return {
    id: `${item.name || ''}-${item.country?.name || ''}`,
    name: normalizeDisplayText(item.name || ''),
    countryName: normalizeDisplayText(item.country?.name || '')
  }
}

function normalizeShowDetail(show) {
  return {
    ...normalizeShowCard(show),
    averageRuntime: Number(show.averageRuntime || show.runtime || 0),
    type: normalizeDisplayText(show.type || ''),
    updated: Number(show.updated || 0),
    ratingCountHint: show.rating?.average ? '基于公开评分字段' : '',
    externals: show.externals || {}
  }
}

function normalizePersonDetail(person) {
  return {
    ...normalizePersonCard(person),
    updated: Number(person.updated || 0),
    url: person.url || ''
  }
}

function normalizeCreditShowItem(item, creditType) {
  const embeddedShow = item._embedded?.show || {}
  const embeddedEpisode = item._embedded?.episode || {}

  if (creditType === 'guest') {
    return {
      id: String(embeddedEpisode.id || item._links?.show?.href || ''),
      title: normalizeDisplayText(embeddedEpisode.name || '未命名单集'),
      subtitle: embeddedEpisode.code || '',
      showName: normalizeDisplayText(embeddedEpisode._embedded?.show?.name || ''),
      imageUrl: buildImageUrl(embeddedEpisode.image),
      showId: String(embeddedEpisode._embedded?.show?.id || ''),
      creditType
    }
  }

  return {
    id: String(embeddedShow.id || ''),
    title: normalizeDisplayText(embeddedShow.name || '未命名剧集'),
    subtitle: normalizeDisplayTextList(embeddedShow.genres || []).join(' / '),
    showName: normalizeDisplayText(embeddedShow.name || ''),
    imageUrl: buildImageUrl(embeddedShow.image),
    showId: String(embeddedShow.id || ''),
    creditType
  }
}

function getTodayAndTomorrow() {
  const today = new Date()
  const tomorrow = addDays(today, 1)
  return {
    today: formatDate(today),
    tomorrow: formatDate(tomorrow)
  }
}

function sortByRating(list = []) {
  return [...list].sort((left, right) => right.rating - left.rating)
}

function dedupeById(list = []) {
  const seenIds = new Set()

  return list.filter((item) => {
    if (!item?.id || seenIds.has(item.id)) {
      return false
    }

    seenIds.add(item.id)
    return true
  })
}

function matchRegion(item, region = '') {
  if (!region) {
    return true
  }

  return item.countryCode === region
}

function filterShowsByGenre(list = [], genre = '') {
  if (!genre) {
    return list
  }

  return list.filter(item => Array.isArray(item.genres) && item.genres.includes(genre))
}

function filterShowsByRegion(list = [], region = '') {
  return list.filter(item => matchRegion(item, region))
}

function filterPeopleByRegion(list = [], region = '') {
  return list.filter(item => matchRegion(item, region))
}

function mapScheduleItemToShowCard(item) {
  return {
    id: item.showId,
    name: item.showName,
    summary: item.summary,
    status: '',
    language: '',
    premiered: item.airdate,
    ended: '',
    officialSite: '',
    rating: item.rating,
    weight: 0,
    genres: item.genres,
    scheduleDays: [],
    scheduleTime: item.airtime,
    networkName: item.networkName,
    webChannelName: item.platformType === '流媒体' ? item.networkName : '',
    imageUrl: item.posterUrl,
    posterUrl: item.posterUrl,
    backgroundUrl: item.backdropUrl,
    type: item.platformType,
    countryCode: item.countryCode,
    countryName: item.countryName
  }
}

function buildFeaturedShowsByRegion(todayList = [], webList = [], tomorrowList = [], fallbackShows = [], region = '') {
  const scheduleFeatured = dedupeById(
    sortByRating(
      todayList
        .concat(webList)
        .concat(tomorrowList)
        .filter(item => item.showId && item.rating > 0)
        .map(mapScheduleItemToShowCard)
    )
  )

  const scheduleRegionList = filterShowsByRegion(scheduleFeatured, region)
  const fallbackRegionList = filterShowsByRegion(fallbackShows, region)
    .filter(item => item.rating >= 7)

  return dedupeById(scheduleRegionList.concat(fallbackRegionList))
    .slice(0, TV_API_CONFIG.homeSectionLimits.featuredCount)
}

export function getTvHotKeywords() {
  return TV_HOT_KEYWORDS
}

export function getTvGenreOptions() {
  return TV_GENRE_OPTIONS
}

export function getTvRegionOptions() {
  return TV_REGION_OPTIONS
}

export function getTvSearchModes() {
  return TV_SEARCH_MODES
}

export function fetchTvHomeData(country = TV_API_CONFIG.defaultCountry) {
  const { today, tomorrow } = getTodayAndTomorrow()

  return Promise.all([
    requestTvApi('/schedule', { country, date: today }),
    requestTvApi('/schedule/web', { country, date: today }),
    requestTvApi('/schedule', { country, date: tomorrow }),
    requestTvApi('/shows', { page: TV_API_CONFIG.homeShowIndexPage })
  ]).then(([todayList, webList, tomorrowList, featuredShows]) => {
    const normalizedToday = Array.isArray(todayList)
      ? todayList.map(item => normalizeScheduleItem(item, 'today')).slice(0, TV_API_CONFIG.homeSectionLimits.todayCount)
      : []
    const normalizedWeb = Array.isArray(webList)
      ? webList.map(item => normalizeScheduleItem(item, 'web')).slice(0, TV_API_CONFIG.homeSectionLimits.webCount)
      : []
    const normalizedTomorrow = Array.isArray(tomorrowList)
      ? tomorrowList.map(item => normalizeScheduleItem(item, 'tomorrow')).slice(0, TV_API_CONFIG.homeSectionLimits.tomorrowCount)
      : []
    const normalizedFallbackShows = Array.isArray(featuredShows)
      ? sortByRating(featuredShows.map(normalizeShowCard))
      : []
    const featured = buildFeaturedShowsByRegion(
      normalizedToday,
      normalizedWeb,
      normalizedTomorrow,
      normalizedFallbackShows,
      country
    )

    return {
      today,
      tomorrow,
      todayEpisodes: normalizedToday,
      webEpisodes: normalizedWeb,
      tomorrowEpisodes: normalizedTomorrow,
      featuredShows: featured,
      genres: TV_GENRE_OPTIONS,
      country
    }
  })
}

export function browseShowsByGenre(genre, region = '') {
  return requestTvApi('/shows', { page: TV_API_CONFIG.homeShowIndexPage }).then((data) => {
    const list = Array.isArray(data) ? data.map(normalizeShowCard) : []
    return sortByRating(filterShowsByRegion(filterShowsByGenre(list, genre), region))
  })
}

export function searchTvShows(keyword, region = '') {
  return requestTvApi('/search/shows', { q: keyword }).then((data) => {
    const list = Array.isArray(data)
      ? data.map(item => normalizeShowCard(item.show || {}))
      : []
    return filterShowsByRegion(list, region)
  })
}

export function searchTvPeople(keyword, region = '') {
  return requestTvApi('/search/people', { q: keyword }).then((data) => {
    const list = Array.isArray(data)
      ? data.map(item => normalizePersonCard(item.person || {}))
      : []
    return filterPeopleByRegion(list, region)
  })
}

export function searchTvShowExact(keyword, region = '') {
  return requestTvApi('/singlesearch/shows', { q: keyword })
    .then((data) => {
      const list = data ? [normalizeShowCard(data)] : []
      return filterShowsByRegion(list, region)
    })
    .catch((error) => {
      if (error?.detail?.statusCode === 404) {
        return []
      }

      return Promise.reject(error)
    })
}

export function fetchTvShowDetail(showId) {
  return Promise.all([
    requestTvApi(`/shows/${showId}`),
    requestTvApi(`/shows/${showId}/cast`),
    requestTvApi(`/shows/${showId}/seasons`),
    requestTvApi(`/shows/${showId}/images`),
    requestTvApi(`/shows/${showId}/akas`)
  ]).then(([show, cast, seasons, images, akas]) => {
    return {
      detail: normalizeShowDetail(show || {}),
      cast: Array.isArray(cast) ? cast.map(normalizeCastItem).slice(0, 12) : [],
      seasons: Array.isArray(seasons) ? seasons.map(normalizeSeasonItem) : [],
      images: Array.isArray(images) ? images.map(normalizeImageItem).filter(item => item.imageUrl).slice(0, 12) : [],
      akas: Array.isArray(akas) ? akas.map(normalizeAkaItem).filter(item => item.name) : []
    }
  })
}

export function fetchTvSeasonPageData(showId, seasonId = '') {
  return Promise.all([
    requestTvApi(`/shows/${showId}`),
    requestTvApi(`/shows/${showId}/seasons`)
  ]).then(([show, seasons]) => {
    const normalizedShow = normalizeShowDetail(show || {})
    const normalizedSeasons = Array.isArray(seasons) ? seasons.map(normalizeSeasonItem) : []
    const currentSeason = normalizedSeasons.find(item => item.id === seasonId) || normalizedSeasons[0] || null

    if (!currentSeason) {
      return {
        show: normalizedShow,
        seasons: [],
        currentSeason: null,
        episodes: []
      }
    }

    return requestTvApi(`/seasons/${currentSeason.id}/episodes`).then((episodes) => {
      return {
        show: normalizedShow,
        seasons: normalizedSeasons,
        currentSeason,
        episodes: Array.isArray(episodes) ? episodes.map(normalizeEpisodeItem) : []
      }
    })
  })
}

export function fetchTvPersonDetail(personId) {
  return Promise.all([
    requestTvApi(`/people/${personId}`),
    requestTvApi(`/people/${personId}/castcredits`, { embed: 'show' }),
    requestTvApi(`/people/${personId}/crewcredits`, { embed: 'show' }),
    requestTvApi(`/people/${personId}/guestcastcredits`, { embed: 'episode' })
  ]).then(([person, castCredits, crewCredits, guestCredits]) => {
    return {
      person: normalizePersonDetail(person || {}),
      castCredits: Array.isArray(castCredits)
        ? castCredits.map(item => normalizeCreditShowItem(item, 'cast')).filter(item => item.showId)
        : [],
      crewCredits: Array.isArray(crewCredits)
        ? crewCredits.map(item => normalizeCreditShowItem(item, 'crew')).filter(item => item.showId)
        : [],
      guestCredits: Array.isArray(guestCredits)
        ? guestCredits.map(item => normalizeCreditShowItem(item, 'guest'))
        : []
    }
  })
}

export function getTvSearchHistory() {
  const storedValue = uni.getStorageSync(TV_SEARCH_HISTORY_KEY)
  return Array.isArray(storedValue) ? storedValue : []
}

export function saveTvSearchHistory(keyword) {
  const trimmedKeyword = String(keyword || '').trim()

  if (!trimmedKeyword) {
    return getTvSearchHistory()
  }

  const nextHistory = [trimmedKeyword]
    .concat(getTvSearchHistory().filter(item => item !== trimmedKeyword))
    .slice(0, 8)

  uni.setStorageSync(TV_SEARCH_HISTORY_KEY, nextHistory)
  return nextHistory
}

export function clearTvSearchHistory() {
  uni.removeStorageSync(TV_SEARCH_HISTORY_KEY)
}
