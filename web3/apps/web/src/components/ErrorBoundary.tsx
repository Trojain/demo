import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button, Result } from 'antd';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  /** 最近一次捕获到的页面渲染错误 */
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('页面渲染异常', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <Result
        status="error"
        title="页面渲染失败"
        subTitle="请刷新页面，或查看控制台定位具体错误。"
        extra={<Button onClick={() => window.location.reload()}>刷新页面</Button>}
      >
        <Alert type="error" message={this.state.error.message} />
      </Result>
    );
  }
}
