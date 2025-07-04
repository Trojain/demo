import { createApp } from 'vue';
import App from './App.vue';
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

let app = undefined;

const render = props => {
    const { container } = props;
    app = createApp(App);
    app.mount(container ? container.querySelector('#app') : '#app');
};

const initQianKun = () => {
    renderWithQiankun({
        bootstrap () { },
        mount (props) {
            render(props);
        },
        unmount () {
            app.unmount();
        },
        update () { }
    });
};

// 判断是否在主应用中运行
qiankunWindow.__POWERED_BY_QIANKUN__ ? initQianKun() : render({});
