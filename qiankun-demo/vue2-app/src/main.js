import Vue from 'vue';
import App from './App.vue';
import './public-path.js';

Vue.config.productionTip = false;

let instance = null;
let currentActions = null;

const noopActions = {
  onGlobalStateChange: () => {},
  setGlobalState: () => {},
  offGlobalStateChange: () => {}
};

function render(props = {}) {
  const { container, actions } = props;
  currentActions = actions || noopActions;
  Vue.prototype.$globalActions = currentActions;

  instance = new Vue({
    render: h => h(App)
  }).$mount(container ? container.querySelector('#app') : '#app');
}

if (!window.__POWERED_BY_QIANKUN__) {
  render();
}

export async function bootstrap() {}

export async function mount(props) {
  try {
    render(props);
  } catch (error) {
    console.error('Micro app mount failed:', error);
  }
}

export async function unmount() {
  if (instance) {
    instance.$destroy();
    instance.$el.innerHTML = '';
    instance = null;
  }
  Vue.prototype.$globalActions = undefined;
  currentActions = null;
}
