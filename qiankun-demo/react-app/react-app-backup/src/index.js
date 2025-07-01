import './public-path';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

let root = null;

function render(props = {}) {
    const { container } = props;
    const rootElement = container ? container.querySelector('#root') : document.getElementById('root');

    root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

if (!window.__POWERED_BY_QIANKUN__) {
    render();
}

export async function bootstrap() {
    console.log('[react-app] bootstraped');
}

export async function mount(props) {
    console.log('[react-app] mount with props', props);
    render(props);
}

export async function unmount() {
    root?.unmount();
}
