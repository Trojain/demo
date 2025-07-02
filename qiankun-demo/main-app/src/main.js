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
        name: 'react-app',
        entry: '//localhost:2001',
        container: '#subapp-container',
        activeRule: '/app-react',
        props: {}
    },
    {
        name: 'vue2-app',
        entry: '//localhost:2002',
        container: '#subapp-container',
        activeRule: '/app-vue2',
        props: {}
    },
    {
        name: 'vue3-app',
        entry: '//localhost:2003',
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
