import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { registerMicroApps, start } from 'qiankun';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import eventBus from './utils/eventBus';

const app = createApp(App);

app.use(ElementPlus);
app.use(router);
app.mount('#app');

eventBus.on('global-message', (data) => {
    console.log('主应用接收到子应用传递过来的数据：', data);
});

registerMicroApps([
    {
        name: 'react-app',
        entry: '//localhost:2001',
        container: '#subapp-container',
        activeRule: '/app-react',
        props: { eventBus } // 子应用获取主应用通信能力（如 eventBus）的唯一标准方式就是通过 props 传入
    },
    {
        name: 'vue2-app',
        entry: '//localhost:2002',
        container: '#subapp-container',
        activeRule: '/app-vue2',
        props: { eventBus }
    },
    {
        name: 'vue3-app',
        entry: '//localhost:2003',
        container: '#subapp-container',
        activeRule: '/app-vue3',
        props: { eventBus }
    }
], {
    beforeLoad: [app => console.log('before load', app.name)],
    beforeMount: [app => console.log('before mount', app.name)],
    afterMount: [app => console.log('after mount', app.name)],
    beforeUnmount: [app => console.log('before unmount', app.name)],
    afterUnmount: [app => console.log('after unmount', app.name)],
});

start({
    sandbox: {
        experimentalStyleIsolation: true
    }
});
