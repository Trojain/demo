import './public-path.js';  // 必须放在最前面，确保 __webpack_public_path__ 在 Webpack 加载资源前就生效
import Vue from 'vue';
import App from './App.vue';

Vue.config.productionTip = false;

let instance = null;

function render (props = {}) {
    const { container, eventBus } = props;
    window.__EVENT_BUS__ = eventBus; // 全局暴露eventBus
    instance = new Vue({
        render: h => h(App)
    }).$mount(container ? container.querySelector('#app') : '#app');
}

if (!window.__POWERED_BY_QIANKUN__) {
    render();
}

export async function bootstrap () { }

export async function mount (props) {
    try {
        render(props);
    } catch (error) {
        console.error('微应用加载失败:', error);
    }
}

export async function unmount () {
    instance.$destroy();
    instance.$el.innerHTML = '';
    instance = null;
}
