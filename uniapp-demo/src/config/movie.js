// TMDB 影视模块配置。当前项目是纯前端直连，因此 Bearer Token 会随小程序包下发。
export const MOVIE_API_CONFIG = {
  baseUrl: 'https://api.themoviedb.org/3',
  imageFallbackBaseUrl: 'https://image.tmdb.org/t/p/',
  // 纯前端调试时可在 bearer 和 apiKey 之间切换，便于排查认证链路问题。
  authMode: 'bearer',
  bearerToken: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3ZjM1YmI0MzY1OGIzMDc1YmY2YzIwN2Y0MTBkNTRlMCIsIm5iZiI6MTc3OTQyMTg1NS44NjUsInN1YiI6IjZhMGZkMjlmY2ZjMTVhMDI2ZTczNzg4ZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.V1TwLVWQxN7z6nwk2HLVPYN8FmyE_n3jQs3m4bU1NTU',
  apiKey: '7f35bb43658b3075bf6c207f410d54e0',
  accountId: '23179638',
  // 需求已确认统一使用中文。
  defaultLanguage: 'zh-CN',
  defaultPage: 1,
  defaultPageSize: 20
}

// 小程序上线前需配置的 TMDB 请求与图片域名。
export const MOVIE_REQUIRED_DOMAINS = [
  'https://api.themoviedb.org',
  'https://image.tmdb.org'
]

// 搜索页媒体类型切换。
export const MOVIE_SEARCH_TYPE_OPTIONS = [
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'tv' },
  { label: '综合', value: 'multi' }
]

// 分类页常用排序方式，便于直接映射 discover/movie 参数。
export const MOVIE_DISCOVER_SORT_OPTIONS = [
  { label: '热门', value: 'popularity.desc' },
  { label: '最新', value: 'primary_release_date.desc' },
  { label: '高分', value: 'vote_average.desc' }
]

// 搜索页常见关键词，作为纯前端 demo 的快捷搜索入口。
export const MOVIE_QUICK_KEYWORDS = [
  { label: '科幻', keyword: '科幻' },
  { label: '动作', keyword: '动作' },
  { label: '悬疑', keyword: '悬疑' },
  { label: '喜剧', keyword: '喜剧' },
  { label: '动画', keyword: '动画' },
  { label: '爱情', keyword: '爱情' },
  { label: '犯罪', keyword: '犯罪' },
  { label: '冒险', keyword: '冒险' }
]

// 首页展示数量控制，保证首屏结构紧凑。
export const MOVIE_HOME_SECTION_LIMITS = {
  popularMovieCount: 8,
  popularTvCount: 8,
  trendingCount: 8,
  genreCount: 8
}
