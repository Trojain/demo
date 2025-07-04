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
        }
    }
};
</script>
