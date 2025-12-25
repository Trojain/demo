import { request } from '@/utils/request'

export const getPayChannelList = (params: any) => {
  return request({ method: 'GET', url: '/pay/channel/list', params })
}

export const addPayChannel = (params) => {
  return request({ method: 'POST', url: '/pay/channel/add', data: params })
}

export const editPayChannel = (params) => {
  return request({ method: 'POST', url: '/pay/channel/edit', data: params })
}
