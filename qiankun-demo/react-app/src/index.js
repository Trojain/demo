import './public-path.js';  // 必须放在最前面，确保 __webpack_public_path__ 在 Webpack 加载资源前就生效
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

let root = null;

function render (props = {}) {
    const { container } = props;
    // 如果存在 container，则在 container 中查找 #root 元素，否则在整个文档中查找 #root 元素
    const rootElement = container ? container.querySelector('#root') : document.getElementById('root');
    // 创建 React 根实例
    root = ReactDOM.createRoot(rootElement);
    // 在严格模式下渲染应用，并将 props 传递给 App 组件
    root.render(
        <React.StrictMode>
            <App {...props} />
        </React.StrictMode>
    );
}

if (!window.__POWERED_BY_QIANKUN__) {
    render();
}

export async function bootstrap () { }

export async function mount (props) {
    render(props);
}

export async function unmount () {
    root?.unmount();
    root = null;
}
