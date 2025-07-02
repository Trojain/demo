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

onMounted(() => {
    // 订阅loading事件
    window._QIANKUN_YD.event?.on('loading', () => {
        const loadingInstance = ElLoading.service({ fullscreen: true });
        setTimeout(() => {
            loadingInstance.close();
        }, 3000);
    });

    window._QIANKUN_YD.event?.on('change-user', (eventName, data) => {
        console.log('主应用中收到用户变更事件：', data);
    });
});
</script>

<style scoped></style>
