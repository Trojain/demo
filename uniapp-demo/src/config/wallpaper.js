// 360 壁纸模块接口配置，当前直接请求公开接口，后续可按平台要求切到代理层。
export const WALLPAPER_API_CONFIG = {
  categoryUrl: 'http://cdn.apc.360.cn/index.php',
  listUrl: 'http://wallpaper.apc.360.cn/index.php',
  defaultPageSize: 20,
  maxPageSize: 30
}

// 360 壁纸模块发布前需要确认的请求与图片域名。
export const WALLPAPER_REQUIRED_DOMAINS = [
  'http://cdn.apc.360.cn',
  'http://wallpaper.apc.360.cn',
  'https://p0.ssl.qhimg.com',
  'https://p1.ssl.qhimg.com',
  'https://p2.ssl.qhimg.com',
  'https://p3.ssl.qhimg.com'
]

export const WALLPAPER_CARD_TONES = [
  'blue',
  'rose',
  'green',
  'cyan',
  'amber',
  'violet',
  'teal',
  'orange',
  'indigo',
  'slate',
  'lime',
  'steel',
  'red'
]
