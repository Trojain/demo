// TVmaze 剧集模块配置。
// 当前接入的是公开 REST API，公共读接口默认无需认证。
// 你提供的 API Key 先保存在这里，便于后续如果接入 Premium 用户接口时继续扩展。
export const TV_API_CONFIG = {
  baseUrl: 'https://api.tvmaze.com',
  apiKey: 'AlpSl6PCuFGQlI2Z0-g9-nxifOS6HyMI',
  defaultCountry: 'CN',
  defaultPageSize: 20,
  homeShowIndexPage: 0,
  // 首页推荐卡片数量控制，避免首屏过长。
  homeSectionLimits: {
    todayCount: 8,
    webCount: 8,
    tomorrowCount: 6,
    featuredCount: 8
  }
}

// 上线前小程序后台需要配置的域名。
export const TV_REQUIRED_DOMAINS = [
  'https://api.tvmaze.com',
  'https://static.tvmaze.com'
]

// 首页类型入口，基于本地映射完成类型浏览。
export const TV_GENRE_OPTIONS = [
  { label: '剧情', value: 'Drama' },
  { label: '喜剧', value: 'Comedy' },
  { label: '科幻', value: 'Science-Fiction' },
  { label: '犯罪', value: 'Crime' },
  { label: '动画', value: 'Animation' },
  { label: '悬疑', value: 'Mystery' }
]

// 首页地区筛选。默认按你的要求展示国内 CN 数据。
export const TV_REGION_OPTIONS = [
  { label: '国内', value: 'CN' },
  { label: '海外', value: 'US' }
]

// 搜索页模式切换。show 负责剧集，people 负责演员，single 负责精确匹配。
export const TV_SEARCH_MODES = [
  { label: '剧名', value: 'show' },
  { label: '演员', value: 'people' },
  { label: '精确', value: 'single' }
]

// 搜索页快捷热词，作为首搜入口。
export const TV_HOT_KEYWORDS = [
  'The Office',
  'Breaking Bad',
  'Friends',
  'Sherlock',
  'The Last of Us',
  'Game of Thrones'
]

// 本地搜索历史存储键。
export const TV_SEARCH_HISTORY_KEY = 'tv_search_history'
