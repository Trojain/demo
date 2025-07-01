import './qiankun.js';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { registerMicroApps, start } from 'qiankun';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

const app = createApp(App);

app.use(ElementPlus);
app.use(router);
app.mount('#app');

registerMicroApps([
    {
        name: 'vue2-app',
        entry: '//localhost:3001',
        container: '#subapp-container',
        activeRule: '/app-vue2',
        props: {}
    },
    {
        name: 'react-app',
        entry: '//localhost:3002',
        container: '#subapp-container',
        activeRule: '/app-react',
        props: {}
    },
    {
        name: 'vue3-app',
        entry: '//localhost:3003',
        container: '#subapp-container',
        activeRule: '/app-vue3',
        props: {}
    }
]);

start({
    sandbox: {
        experimentalStyleIsolation: true
    }
});
