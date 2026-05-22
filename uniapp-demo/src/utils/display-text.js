// 统一处理接口返回的展示文案，避免敏感词直接透出到页面。
export function normalizeDisplayText(value) {
  if (typeof value !== 'string') {
    return value || ''
  }

  return value.replace(/美女/g, '女神')
}

export function normalizeDisplayTextList(list = []) {
  return list.map(item => normalizeDisplayText(item)).filter(Boolean)
}

// TVmaze 常见枚举字段的中文映射。
// 这里只处理稳定、可枚举的字段，剧名和简介这类自由文本不在此范围内。
const TV_TYPE_MAP = {
  Scripted: '剧情剧',
  Reality: '真人秀',
  Animation: '动画',
  TalkShow: '脱口秀',
  'Talk Show': '脱口秀',
  GameShow: '游戏节目',
  'Game Show': '游戏节目',
  Documentary: '纪录片',
  Variety: '综艺',
  PanelShow: '综艺谈话',
  'Panel Show': '综艺谈话',
  News: '新闻',
  Sports: '体育',
  AwardShow: '颁奖礼',
  'Award Show': '颁奖礼'
}

const TV_STATUS_MAP = {
  Running: '连载中',
  Ended: '已完结',
  'To Be Determined': '待定',
  'In Development': '开发中',
  Canceled: '已取消',
  Cancelled: '已取消'
}

const TV_GENRE_MAP = {
  Drama: '剧情',
  Comedy: '喜剧',
  Crime: '犯罪',
  Thriller: '惊悚',
  Mystery: '悬疑',
  Horror: '恐怖',
  Romance: '爱情',
  Family: '家庭',
  Music: '音乐',
  History: '历史',
  War: '战争',
  Western: '西部',
  Anime: '动漫',
  Animation: '动画',
  Fantasy: '奇幻',
  Adventure: '冒险',
  Action: '动作',
  Supernatural: '超自然',
  'Science-Fiction': '科幻',
  Science: '科学',
  Medical: '医疗',
  Legal: '律政',
  Sports: '体育',
  Food: '美食',
  Travel: '旅行',
  Children: '儿童'
}

const TV_PLATFORM_TYPE_MAP = {
  流媒体: '流媒体',
  电视台: '电视台'
}

const TV_LANGUAGE_MAP = {
  English: '英语',
  Chinese: '中文',
  Mandarin: '普通话',
  Cantonese: '粤语',
  Japanese: '日语',
  Korean: '韩语',
  Spanish: '西班牙语',
  French: '法语',
  German: '德语',
  Russian: '俄语',
  Thai: '泰语',
  Italian: '意大利语',
  Portuguese: '葡萄牙语'
}

const TV_COUNTRY_CODE_MAP = {
  CN: '中国',
  US: '美国',
  GB: '英国',
  JP: '日本',
  KR: '韩国',
  TH: '泰国',
  FR: '法国',
  DE: '德国',
  ES: '西班牙',
  IT: '意大利'
}

function mapDisplayValue(value, mapping) {
  if (!value) {
    return ''
  }

  return mapping[value] || normalizeDisplayText(value)
}

export function mapTvType(value) {
  return mapDisplayValue(value, TV_TYPE_MAP)
}

export function mapTvStatus(value) {
  return mapDisplayValue(value, TV_STATUS_MAP)
}

export function mapTvGenre(value) {
  return mapDisplayValue(value, TV_GENRE_MAP)
}

export function mapTvGenreList(list = []) {
  return list.map(item => mapTvGenre(item)).filter(Boolean)
}

export function mapTvPlatformType(value) {
  return mapDisplayValue(value, TV_PLATFORM_TYPE_MAP)
}

export function mapTvLanguage(value) {
  return mapDisplayValue(value, TV_LANGUAGE_MAP)
}

export function mapTvCountryCode(value) {
  return mapDisplayValue(value, TV_COUNTRY_CODE_MAP)
}
