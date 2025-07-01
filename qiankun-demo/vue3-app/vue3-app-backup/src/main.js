import { createApp } from 'vue';
import App from './App.vue';
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

let app = undefined;

const render = props => {
    console.log('子应用（app-vue3）', props);
    const { container } = props;
    app = createApp(App);
    app.mount(container ? container.querySelector('#app') : '#app');
};

const initQianKun = () => {
    renderWithQiankun({
        bootstrap() {},
        mount(props) {
            render(props);
        },
        unmount() {
            app.unmount();
        },
        update() {}
    });
};

qiankunWindow.__POWERED_BY_QIANKUN__ ? initQianKun() : render({});
