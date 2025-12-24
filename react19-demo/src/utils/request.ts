// HTTP 请求封装
import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { clearUserInfo, getToken } from '@/store/user'
import { globalUI } from './globalUI'

export interface ApiResponse<T = any> {
  code: number
  data: T
  message: string
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

let isRelogging = false

// 请求拦截器：注入 satoken
instance.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) config.headers.satoken = token
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器：统一错误处理
instance.interceptors.response.use(
  (response) => {
    const { message } = globalUI
    const { code, message: msg } = response.data
    if (code !== undefined && code !== 200 && code !== 0) {
      message.error(msg || '请求失败')
      return Promise.reject(new Error(msg || '请求失败'))
    }
    return response.data
  },
  (error: AxiosError<any>) => {
    const { message, modal, navigate } = globalUI
    if (error.response) {
      switch (error.response.status) {
        case 401:
          if (!isRelogging) {
            isRelogging = true
            modal.warning({
              title: '登录过期',
              content: '请重新登录',
              onOk: () => {
                isRelogging = false
                clearUserInfo()
                navigate('/login')
              },
            })
          }
          break
        case 403:
          message.error('没有权限')
          break
        case 500:
          message.error('服务器错误')
          break
        default:
          message.error(error.response.data?.message || '请求失败')
      }
    } else {
      message.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  },
)

export const request = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return instance.request<any, T>(config)
}

export default request
