<template>
    <div id="app">
        <button @click="openLoading">打开全局的loading</button>
    </div>
</template>

<script>
export default {
    methods: {
        openLoading() {
            // 发布loading事件
            window.__EVENT_BUS__.emit('loading');

            window.__EVENT_BUS__.emit('vue2-to-vue3', { msg: 'hello vue3 from vue2' });
        }
    }
};
</script>
