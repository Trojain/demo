// 素材模块接口配置，后续可平滑切到自有代理。
export const MATERIAL_API_CONFIG = {
  baseUrl: 'https://pixabay.com/api/',
  videoBaseUrl: 'https://pixabay.com/api/videos/',
  apiKey: '55929207-7677b1e0948cb3a8b735ffc9c',
  // 默认每次请求 10 条，降低首屏加载压力和免费接口频率消耗。
  defaultPageSize: 10,
  maxPageSize: 50
}

// 素材模块依赖的合法域名，三端小程序发布前需要在对应平台后台配置。
export const MATERIAL_REQUIRED_DOMAINS = [
  'https://pixabay.com',
  'https://cdn.pixabay.com'
]
