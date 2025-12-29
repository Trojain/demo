import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TabItem {
  label: string
  key: string
  closable?: boolean
}

interface TabStore {
  tabs: TabItem[]
  activeKey: string
  setActiveKey: (key: string) => void
  addTab: (tab: TabItem) => void
  removeTab: (key: string) => void
  closeOtherTabs: (key: string) => void
  closeAllTabs: () => void
  clearTabs: () => void
}

export const useTabStore = create<TabStore>()(
  persist(
    (set) => ({
      tabs: [{ label: '首页', key: '/dashboard', closable: false }],
      activeKey: '/dashboard',
      setActiveKey: (key) => set((state) => (state.activeKey === key ? state : { activeKey: key })),
      addTab: (tab) =>
        set((state) => {
          const exists = state.tabs.some((t) => t.key === tab.key)
          if (exists) {
            // 相同 activeKey 不更新
            if (state.activeKey === tab.key) return state
            return { activeKey: tab.key }
          }
          return {
            tabs: [...state.tabs, tab],
            activeKey: tab.key,
          }
        }),
      removeTab: (key) =>
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.key !== key)
          let newActiveKey = state.activeKey
          if (state.activeKey === key) {
            const index = state.tabs.findIndex((t) => t.key === key)
            newActiveKey = newTabs[index - 1]?.key || newTabs[0]?.key || '/'
          }
          return { tabs: newTabs, activeKey: newActiveKey }
        }),
      closeOtherTabs: (key) =>
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.key === key || t.closable === false)
          return { tabs: newTabs, activeKey: key }
        }),
      closeAllTabs: () =>
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.closable === false)
          const newActiveKey = newTabs[0]?.key || '/dashboard'
          return { tabs: newTabs, activeKey: newActiveKey }
        }),
      clearTabs: () => set({ tabs: [], activeKey: '/' }),
    }),
    { name: 'tabs-storage' },
  ),
)
