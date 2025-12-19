import type { LoginParams, LoginResult, PageParams, PageResult, User } from '@/types/api'
import request from '@/utils/request'

// ✅ 直接导出对象，不需要 Hook
export const userApi = {
  login: (params: LoginParams) => {
    return request<LoginResult>({ method: 'POST', url: '/auth/login', data: params })
  },

  getCurrentUser: () => {
    return request<User>({ method: 'GET', url: '/user/current' })
  },

  getUserList: (params: PageParams) => {
    return request<PageResult<User>>({ method: 'GET', url: '/users', params })
  },

  getUserDetail: (id: number) => {
    return request<User>({ method: 'GET', url: `/users/${id}` })
  },

  createUser: (data: Partial<User>) => {
    return request<User>({ method: 'POST', url: '/users', data })
  },

  updateUser: (id: number, data: Partial<User>) => {
    return request<User>({ method: 'PUT', url: `/users/${id}`, data })
  },

  deleteUser: (id: number) => {
    return request({ method: 'DELETE', url: `/users/${id}` })
  },
}
