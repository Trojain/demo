/**
 * 错误边界组件：捕获子组件渲染错误，防止整个应用崩溃白屏
 * 使用 react-error-boundary 库实现
 */
import { type FallbackProps, ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
import { useNavigate } from 'react-router-dom'
import { Button, Result } from 'antd'
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons'

/** 错误回退组件 */
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const navigate = useNavigate()
  const isDev = import.meta.env.DEV

  const handleGoHome = () => {
    resetErrorBoundary()
    navigate('/dashboard')
  }

  return (
    <div style={{ padding: 24, minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Result
        status="error"
        title="页面出错了"
        subTitle={isDev ? error.message : '抱歉，页面发生了一些错误，请尝试刷新或返回首页'}
        extra={[
          <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={resetErrorBoundary}>
            重新加载
          </Button>,
          <Button key="home" icon={<HomeOutlined />} onClick={handleGoHome}>
            返回首页
          </Button>,
        ]}
      >
        {isDev && (
          <div
            style={{
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: 4,
              padding: 16,
              marginTop: 16,
              textAlign: 'left',
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, color: '#cf1322' }}>
              {error.stack}
            </pre>
          </div>
        )}
      </Result>
    </div>
  )
}

interface ErrorBoundaryProps {
  children: React.ReactNode
}

/** 错误边界包装组件 */
export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const handleError = (error: Error, info: React.ErrorInfo) => {
    // 可接入 Sentry 等错误监控平台
    console.error('[ErrorBoundary] 捕获到错误:', error)
    console.error('[ErrorBoundary] 组件堆栈:', info.componentStack)
  }

  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback} onError={handleError}>
      {children}
    </ReactErrorBoundary>
  )
}

export default ErrorBoundary
