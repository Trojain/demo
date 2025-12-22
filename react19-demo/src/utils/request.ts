/**
 * HTTP 请求封装：自动添加 token、统一错误处理、401 自动跳转
 */
import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { clearUserInfo, getToken } from '@/store/user'
import { globalUI } from './globalUI'

/** 统一响应结构 */
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

let isRelogging = false // 防止重复弹出登录过期提示

// 请求拦截器：自动添加 token
instance.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器：统一处理业务错误和HTTP错误
instance.interceptors.response.use(
  (response) => {
    const { message } = globalUI
    const { code, data, message: msg } = response.data
    if (code !== undefined) {
      if (code === 200 || code === 0) {
        return data !== undefined ? data : response.data
      }
      message.error(msg || '请求失败')
      return Promise.reject(new Error(msg || '请求失败'))
    }

    return response.data
  },
  (error: AxiosError<any>) => {
    const { message, modal, navigate } = globalUI
    if (error.response) {
      switch (error.response.status) {
        case 401: // 未授权，跳转登录
          if (!isRelogging) {
            isRelogging = true
            modal.warning({
              title: '登录过期',
              content: '您的登录已过期，请重新登录',
              onOk: () => {
                isRelogging = false
                clearUserInfo()
                navigate('/login')
              },
            })
          }
          break
        case 403:
          message.error('没有权限访问')
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

/** 导出请求函数 */
export const request = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return instance.request<any, T>(config)
}

export default request
