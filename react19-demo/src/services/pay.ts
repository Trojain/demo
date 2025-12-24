import { request } from '@/utils/request'

export const getPayChannelList = (params: any) => {
  return request({ method: 'GET', url: '/pay/channel/list', params })
}
