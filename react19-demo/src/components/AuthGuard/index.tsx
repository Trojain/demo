import { Navigate, useLocation } from 'react-router-dom'
import { useUserStore } from '@/store/user'

interface AuthGuardProps {
  children: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const userInfo = useUserStore((state) => state.userInfo)
  const location = useLocation()

  if (!userInfo?.token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
