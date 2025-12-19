import Loading from '@/components/Loading'
import { Suspense } from 'react'

export const lazyLoad = (children: React.ReactNode) => {
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}
