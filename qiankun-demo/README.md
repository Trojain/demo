# 运行和打包

-   npm run start 一键启动所有应用
-   npm run build 一键打包所有应用

---

# 端口

-   主应用 main-app： Vue 3 localhost:2000
-   微应用 react-app：React19 localhost:2001
-   微应用 vue2-app： vue2 localhost:2002
-   微应用 vue3-app： vue3 localhost:2003

---

# 生命周期

## 主应用生命周期

非函数，而是注册子应用时的钩子

```js
registerMicroApps(
    [
        {
            name: 'react-app',
            entry: '//localhost:2001',
            container: '#container',
            activeRule: '/app-react'
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
```

## 2. 子应用生命周期

每个子应用（无论是 React、Vue2、Vue3）必须导出以下生命周期函数：

### 1. 初始化

-   bootstrap 只会在微应用初始化的时候调用一次，下次微应用重新进入时会直接调用 mount 钩子，不会再重复触发 bootstrap
-   通常用于执行一些初始化操作，如初始化全局变量、配置等在当前实现中，该函数为空，意味着没有额外的初始化逻辑

```js
export async function bootstrap() {}
```

### 2. 挂载

-   应用每次进入都会调用 mount 方法
-   通常在这里触发应用的渲染方法

```js
export async function mount(props) {
    render(props);
}
```

### 3. 卸载

-   应用每次 切出/卸载 会调用的方法
-   通常在这里卸载微应用的应用实例

```js
export async function unmount() {
    instance.$destroy();
    instance.$el.innerHTML = '';
    instance = null;
}
```

### 4. 更新

-   应用每次 切出/重新进入都会调用的方法
-   通常在这里更新微应用的数据

```js
export async function update(props) {}
```

## 3. 流程图

```js
主应用         子应用
 ↓               ↓
 beforeLoad →    bootstrap
 ↓               ↓
 beforeMount →   mount
 ↓               ↓
 afterMount      ↑
 ↓
 ...切换路由...
 ↓               ↓
 beforeUnmount → unmount
 ↓               ↓
 afterUnmount
```

---

# 判断运行环境

-   在非 qiankun 环境下时，也能独立运行
-   若不是由 qiankun 驱动，则直接调用 `render()` 函数进行渲染，用于本地开发调试

## 1. 在 webpack 下

```js
if (!window.__POWERED_BY_QIANKUN__) {
    render();
}
```

### 2. 在 vite 下

```js
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper';

qiankunWindow.__POWERED_BY_QIANKUN__ ? initQianKun() : render({});
```

---

# `__webpack_public_path__`

确保资源路径在被主应用正确加载

```js
if (window.__POWERED_BY_QIANKUN__) {
    __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}
```

-   `__webpack_public_path__` 是 Webpack 用来动态设置资源加载前缀的变量。

-   `window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__` 是 qiankun 在运行时注入的子应用静态资源前缀。

## 为什么需要它？

-   当子应用被主应用通过 entry: '//localhost:2001' 加载时：
-   子应用的 JS、CSS 被动态插入；
-   如果不手动设置 `__webpack_public_path__`，则 Webpack 默认会使用构建时的路径加载静态资源（如图片、异步 chunk）；
-   这会导致 资源路径错误（404）或跨域问题。
