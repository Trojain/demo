import request from '@/utils/request'

export const login = (params) => {
  return request({ method: 'POST', url: '/system/login', data: params })
}
