<template>
    <img src="/vite.svg" class="logo" alt="Vite logo" />
    <HelloWorld msg="Vite + Vue" />
</template>

<script setup>
import { onMounted } from 'vue';
import HelloWorld from './components/HelloWorld.vue';

const props = defineProps(['eventBus']);

onMounted(() => {
    props.eventBus?.on('vue2-to-vue3', data => {
        console.log('vue3-app 收到了来自 vue2-app 的消息:', data);
    });
});
</script>

<style scoped>
.logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
}
.logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
}
</style>
