import { createApp } from 'vue';
import App from './App.vue';
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

let app = null;

const render = props => {
    const { container, eventBus } = props;
    app = createApp(App, { eventBus }); //  将 eventBus 作为 props 传入 App.vue
    app.mount(container ? container.querySelector('#app') : '#app');
};

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

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
    render({})
}
