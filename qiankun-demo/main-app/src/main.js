import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { registerMicroApps, start } from 'qiankun';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import actions from './utils/globalState';

const app = createApp(App);

app.use(ElementPlus);
app.use(router);
app.mount('#app');

const handleGlobalMessage = (state, prevState) => {
  if (state.globalMessage && state.globalMessage !== prevState.globalMessage) {
    console.log('Main app received global message:', state.globalMessage);
  }
};

actions.onGlobalStateChange(handleGlobalMessage, true);

registerMicroApps(
  [
    {
      name: 'react-app',
      entry: '//localhost:2001',
      container: '#subapp-container',
      activeRule: '/app-react',
      props: { actions }
    },
    {
      name: 'vue2-app',
      entry: '//localhost:2002',
      container: '#subapp-container',
      activeRule: '/app-vue2',
      props: { actions }
    },
    {
      name: 'vue3-app',
      entry: '//localhost:2003',
      container: '#subapp-container',
      activeRule: '/app-vue3',
      props: { actions }
    }
  ],
  {
    beforeLoad: [app => console.log('before load', app.name)],
    beforeMount: [app => console.log('before mount', app.name)],
    afterMount: [app => console.log('after mount', app.name)],
    beforeUnmount: [app => console.log('before unmount', app.name)],
    afterUnmount: [app => console.log('after unmount', app.name)]
  }
);

start({
  sandbox: {
    experimentalStyleIsolation: true
  }
});
