// 权限守卫组件
import { Navigate, useLocation } from 'react-router-dom'

interface AuthGuardProps {
  children: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const token = localStorage.getItem('token')
  const location = useLocation()

  // 如果没有 Token，重定向到登录页
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 有 Token，渲染子路由
  return children
}
