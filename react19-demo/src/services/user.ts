import request from '@/utils/request'

export const login = (params: any) => {
  return request({ method: 'POST', url: '/system/login', data: params })
}

export const logout = (params?: any) => {
  return request({ method: 'POST', url: '/system/loginOut', data: params })
}
