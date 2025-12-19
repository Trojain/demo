import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

const uiHolder = {
  message: {
    error: (msg: string) => console.error(msg),
    warning: console.warn,
    success: console.log,
  } as any,
  modal: { warning: console.warn, confirm: console.warn } as any,
  navigate: (path: string) => {
    window.location.href = path
  },
}

export const setRequestUi = (message: any, modal: any, navigate: any) => {
  uiHolder.message = message
  uiHolder.modal = modal
  uiHolder.navigate = navigate
}

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

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

instance.interceptors.response.use(
  (response) => {
    const { code, data, message } = response.data
    if (code === 200 || code === 0) return data

    uiHolder.message.error(message || '请求失败')
    return Promise.reject(new Error(message || '请求失败'))
  },
  (error: AxiosError<any>) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          if (!isRelogging) {
            isRelogging = true
            uiHolder.modal.warning({
              title: '登录过期',
              content: '您的登录已过期，请重新登录',
              onOk: () => {
                isRelogging = false
                localStorage.removeItem('token')
                uiHolder.navigate('/login')
              },
            })
          }
          break
        case 403:
          uiHolder.message.error('没有权限访问')
          break
        case 500:
          uiHolder.message.error('服务器错误')
          break
        default:
          uiHolder.message.error(error.response.data?.message || '请求失败')
      }
    } else {
      uiHolder.message.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export const request = async <T = any>(config: AxiosRequestConfig): Promise<T> => {
  return instance.request<any, T>(config)
}

export default request
