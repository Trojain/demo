// API 类型定义
export interface LoginParams {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  userInfo: {
    id: number
    username: string
    nickname: string
    avatar?: string
  }
}

export interface User {
  id: number
  username: string
  nickname: string
  email?: string
  phone?: string
  avatar?: string
  role: string
  status: number
  createTime: string
}

export interface PageParams {
  page: number
  pageSize: number
  keyword?: string
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
