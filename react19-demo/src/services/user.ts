import request from '@/utils/request'

export const login = (params) => {
  return request({ method: 'POST', url: '/system/login', data: params })
}

// export const userApi = {
//   login: (params) => {
//     return request({ method: 'POST', url: '/auth/login', data: params })
//   },

//   getCurrentUser: () => {
//     return request({ method: 'GET', url: '/user/current' })
//   },

//   getUserList: (params) => {
//     return request({ method: 'GET', url: '/users', params })
//   },

//   getUserDetail: (id: number) => {
//     return request({ method: 'GET', url: `/users/${id}` })
//   },

//   createUser: (data) => {
//     return request({ method: 'POST', url: '/users', data })
//   },

//   updateUser: (id: number, data) => {
//     return request({ method: 'PUT', url: `/users/${id}`, data })
//   },

//   deleteUser: (id: number) => {
//     return request({ method: 'DELETE', url: `/users/${id}` })
//   },
// }
