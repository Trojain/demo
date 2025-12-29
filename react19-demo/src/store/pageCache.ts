import { create } from 'zustand'

// 最大缓存页面数量，超出时淘汰最久未访问的页面
const MAX_CACHED_PAGES = 10

// 缓存页面信息
export interface CachedPage {
  key: string // 缓存唯一标识：pathname?normalizedSearch
  pathname: string // 路由路径
  search: string // 规范化后的查询参数
  lastAccess: number // 最后访问时间戳，用于 LRU 淘汰
}

interface PageCacheStore {
  cachedPages: CachedPage[] // 已缓存的页面列表
  addCachedPage: (pathname: string, search?: string) => void // 添加或更新缓存页面
  updateLastAccess: (key: string) => void // 更新页面访问时间
  removeCachedPage: (key: string) => void // 移除单个缓存页面
  removeCachedPages: (keys: string[]) => void // 批量移除缓存页面
  clearCache: () => void // 清空所有缓存
}

// 规范化 search：按 key 排序、过滤空值（确保相同参数生成相同 key）
export const normalizeSearch = (search: string): string => {
  const params = new URLSearchParams(search)
  const entries: [string, string][] = []
  params.forEach((value, key) => {
    if (value !== '') entries.push([key, value])
  })
  entries.sort((a, b) => a[0].localeCompare(b[0]))
  return new URLSearchParams(entries).toString()
}

// 生成缓存 key：pathname?normalizedSearch
export const generateCacheKey = (pathname: string, search = ''): string => {
  const normalized = normalizeSearch(search)
  return normalized ? `${pathname}?${normalized}` : pathname
}

// 找到最旧页面索引，用于 LRU 淘汰（避免全量排序）
const findOldestPageIndex = (pages: CachedPage[]): number => {
  if (pages.length === 0) return -1
  let oldestIndex = 0
  let oldestTime = pages[0]!.lastAccess
  for (let i = 1; i < pages.length; i++) {
    if (pages[i]!.lastAccess < oldestTime) {
      oldestTime = pages[i]!.lastAccess
      oldestIndex = i
    }
  }
  return oldestIndex
}

// 页面缓存 Store
export const usePageCacheStore = create<PageCacheStore>((set) => ({
  cachedPages: [],

  addCachedPage: (pathname: string, search = '') => {
    set((state) => {
      const key = generateCacheKey(pathname, search)
      const normalizedSearch = normalizeSearch(search)
      const now = Date.now()

      // 已存在则更新访问时间（保持原位置，避免 Tab 顺序变化）
      const existingIndex = state.cachedPages.findIndex((p) => p.key === key)
      if (existingIndex !== -1) {
        const existing = state.cachedPages[existingIndex]!
        const updated = Object.assign({}, existing, { lastAccess: now })
        return {
          cachedPages: [
            ...state.cachedPages.slice(0, existingIndex),
            updated,
            ...state.cachedPages.slice(existingIndex + 1),
          ],
        }
      }

      // 新增缓存页面
      const newPage: CachedPage = { key, pathname, search: normalizedSearch, lastAccess: now }
      let newPages: CachedPage[] = [...state.cachedPages, newPage]

      // LRU 淘汰：超出上限时移除最久未访问的页面
      while (newPages.length > MAX_CACHED_PAGES) {
        const oldestIndex = findOldestPageIndex(newPages)
        if (oldestIndex === -1) break
        newPages = [...newPages.slice(0, oldestIndex), ...newPages.slice(oldestIndex + 1)]
      }

      return { cachedPages: newPages }
    })
  },

  updateLastAccess: (key: string) => {
    set((state) => {
      const index = state.cachedPages.findIndex((p) => p.key === key)
      if (index === -1) return state
      const existing = state.cachedPages[index]!
      const updated = Object.assign({}, existing, { lastAccess: Date.now() })
      return {
        cachedPages: [...state.cachedPages.slice(0, index), updated, ...state.cachedPages.slice(index + 1)],
      }
    })
  },

  removeCachedPage: (key) => {
    set((state) => ({ cachedPages: state.cachedPages.filter((p) => p.key !== key) }))
  },

  removeCachedPages: (keys) => {
    set((state) => ({ cachedPages: state.cachedPages.filter((p) => !keys.includes(p.key)) }))
  },

  clearCache: () => set({ cachedPages: [] }),
}))
