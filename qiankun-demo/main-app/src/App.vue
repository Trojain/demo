<template>
    <h1>主应用</h1>
    <router-link to="/app-vue2">Vue2 应用</router-link>
    |
    <router-link to="/app-react">React 应用</router-link>
    |
    <router-link to="/app-vue3">Vue3 应用</router-link>

    <div id="subapp-container"></div>
</template>

<script setup>
import { onMounted } from 'vue';
import { ElLoading } from 'element-plus';
import eventBus from './utils/eventBus';

onMounted(() => {
    // 订阅loading事件
    eventBus.on('loading', () => {
        const loadingInstance = ElLoading.service({ fullscreen: true });
        setTimeout(() => {
            loadingInstance.close();
        }, 3000);
    });
});
</script>

<style scoped></style>
