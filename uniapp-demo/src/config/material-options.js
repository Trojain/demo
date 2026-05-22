// 素材模块分类，value 需和底层接口 category 参数保持一致。
export const MATERIAL_CATEGORIES = [
  { label: '背景', value: 'backgrounds', tone: 'blue', query: '背景素材' },
  { label: '时尚', value: 'fashion', tone: 'rose', query: '时尚素材' },
  { label: '自然', value: 'nature', tone: 'green', query: '自然素材' },
  { label: '科学', value: 'science', tone: 'cyan', query: '科学素材' },
  { label: '教育', value: 'education', tone: 'amber', query: '教育素材' },
  { label: '情绪', value: 'feelings', tone: 'violet', query: '情绪素材' },
  { label: '健康', value: 'health', tone: 'teal', query: '健康素材' },
  { label: '人物', value: 'people', tone: 'orange', query: '人物素材' },
  { label: '宗教', value: 'religion', tone: 'indigo', query: '宗教素材' },
  { label: '地点', value: 'places', tone: 'slate', query: '地点素材' },
  { label: '动物', value: 'animals', tone: 'lime', query: '动物素材' },
  { label: '工业', value: 'industry', tone: 'steel', query: '工业素材' },
  { label: '电脑', value: 'computer', tone: 'blue', query: '电脑素材' },
  { label: '美食', value: 'food', tone: 'red', query: '美食素材' },
  { label: '运动', value: 'sports', tone: 'green', query: '运动素材' },
  { label: '交通', value: 'transportation', tone: 'cyan', query: '交通素材' },
  { label: '旅行', value: 'travel', tone: 'amber', query: '旅行素材' },
  { label: '建筑', value: 'buildings', tone: 'slate', query: '建筑素材' },
  { label: '商业', value: 'business', tone: 'indigo', query: '商业素材' },
  { label: '音乐', value: 'music', tone: 'rose', query: '音乐素材' }
]

// 快捷筛选配置，key 对应底层接口参数名，页面展示直接使用 options.label。
export const MATERIAL_FILTER_GROUPS = [
  {
    key: 'editors_choice',
    options: [{ label: '精选', value: true }]
  },
  {
    key: 'order',
    options: [
      { label: '热门', value: 'popular' },
      { label: '最新', value: 'latest' }
    ]
  },
  {
    key: 'orientation',
    options: [
      { label: '全部', value: 'all' },
      { label: '电脑', value: 'horizontal' },
      { label: '手机', value: 'vertical' }
    ]
  }
]

// 媒体类型筛选，图片和视频共用素材模块查询页。
export const MATERIAL_MEDIA_OPTIONS = [
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' }
]

export const DEFAULT_MATERIAL_FILTERS = {
  q: '',
  category: '',
  media_type: 'image',
  editors_choice: false,
  order: 'popular',
  image_type: 'all',
  video_type: 'all',
  orientation: 'all',
  // 默认使用中文搜索语义。
  lang: 'zh'
}
