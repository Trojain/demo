<template>
    <h1>主应用</h1>
    <router-link to="/yd-vue2">Vue2 应用</router-link>
    |
    <router-link to="/yd-react">React 应用</router-link>
    |
    <router-link to="/yd-vue3">Vue3 应用</router-link>

    <router-view v-slot="{ Component }">
        <keep-alive>
            <component :is="Component" />
        </keep-alive>
    </router-view>
    <div id="yd-container"></div>
</template>

<script setup>
import { onMounted } from 'vue';
import { ElLoading } from 'element-plus';

onMounted(() => {
    // 订阅loading事件
    window._QIANKUN_YD.event.on('loading', () => {
        const loadingInstance = ElLoading.service({ fullscreen: true });
        setTimeout(() => {
            loadingInstance.close();
        }, 3000);
    });
});
</script>

<style scoped></style>
