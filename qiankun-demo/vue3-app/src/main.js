import { qiankunWindow, renderWithQiankun } from 'vite-plugin-qiankun/dist/helper';
import { createApp } from 'vue';
import App from './App.vue';

let app = null;
let appActions = null;

const noopActions = {
  onGlobalStateChange: () => {},
  offGlobalStateChange: () => {},
  setGlobalState: () => {}
};

const render = (props = {}) => {
  const { container, actions } = props;
  appActions = actions || noopActions;
  app = createApp(App, { actions: appActions });
  app.mount(container ? container.querySelector('#app') : '#app');
};

renderWithQiankun({
  bootstrap() {},
  mount(props) {
    render(props);
  },
  unmount() {
    if (app) {
      app.unmount();
      app = null;
    }
    appActions = null;
  },
  update() {}
});

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render();
}
