import { Suspense, lazy } from 'react'
import { PageLoading } from '@ant-design/pro-components'
import { useIsMobile } from '@/hooks/useIsMobile'

const PCList = lazy(() => import('./components/PC'))
const MobileList = lazy(() => import('./components/Mobile'))

export default function PayChannelPage() {
  const isMobile = useIsMobile()

  return <Suspense fallback={<PageLoading />}>{isMobile ? <MobileList /> : <PCList />}</Suspense>
}
