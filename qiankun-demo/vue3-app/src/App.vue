<template>
  <img src="/vite.svg" class="logo" alt="Vite logo" />
  <HelloWorld msg="Vite + Vue" />
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue';
import HelloWorld from './components/HelloWorld.vue';

const props = defineProps({
  actions: {
    type: Object,
    default: null
  }
});

const handleGlobalStateChange = (state, prevState) => {
  if (state.vue2ToVue3 && state.vue2ToVue3 !== prevState.vue2ToVue3) {
    console.log('vue3-app received message from vue2-app:', state.vue2ToVue3);
  }
};

onMounted(() => {
  props.actions?.onGlobalStateChange?.(handleGlobalStateChange, true);
});

onBeforeUnmount(() => {
  props.actions?.offGlobalStateChange?.(handleGlobalStateChange);
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
