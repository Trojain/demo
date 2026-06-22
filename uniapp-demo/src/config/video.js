// 视频解析模块配置，当前按个人 demo 纯前端直连 TikHub。
export const VIDEO_API_CONFIG = {
  // 中国大陆环境优先使用 api.tikhub.dev，海外环境可改为 https://api.tikhub.io。
  baseUrl: 'https://api.tikhub.dev',
  // TikHub Bearer Token。个人 demo 可直接写死，正式发布前建议改为后端代理保护。
  token: '1pFaCN0t0gaXw2mXOp6Rz07MKRyvZqVtz0fDt0KwSPyzlX22enGoJmjADQ==',
  // 每次解析只调用一个单条视频接口，禁止为了补充详情再请求统计、用户、评论等接口。
  timeout: 20000
}

// 视频模块依赖的合法域名，发布到小程序前需要在平台后台配置。
export const VIDEO_REQUIRED_DOMAINS = [
  'https://api.tikhub.dev'
]

export const VIDEO_PLATFORM_OPTIONS = [
  {
    value: 'douyin',
    label: '抖音'
  },
  {
    value: 'kuaishou',
    label: '快手'
  },
  {
    value: 'tiktok',
    label: 'TikTok'
  }
]
