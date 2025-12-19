import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserInfo {
  token?: string
  username?: string
  [key: string]: any
}

interface UserStore {
  userInfo: UserInfo | null
  setUserInfo: (info: UserInfo) => void
  clearUserInfo: () => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      userInfo: null,
      setUserInfo: (info) => {
        set({ userInfo: info })
      },
      clearUserInfo: () => {
        set({ userInfo: null })
      },
    }),
    { name: 'user-storage' },
  ),
)

export const getToken = () => {
  return useUserStore.getState().userInfo?.token
}

export const clearUserInfo = () => {
  return useUserStore.getState().clearUserInfo()
}
