<template>
  <h1>Host App</h1>
  <router-link to="/app-vue2">Vue2 App</router-link>
  |
  <router-link to="/app-react">React App</router-link>
  |
  <router-link to="/app-vue3">Vue3 App</router-link>

  <div id="subapp-container"></div>
</template>

<script setup>
import { ElLoading } from 'element-plus';
import { onBeforeUnmount, onMounted } from 'vue';
import actions from './utils/globalState';

let loadingInstance = null;
let loadingTimer = null;

const handleGlobalStateChange = state => {
  if (state.loading) {
    if (!loadingInstance) {
      loadingInstance = ElLoading.service({ fullscreen: true });
    }
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      loadingInstance?.close();
      loadingInstance = null;
      actions.setGlobalState({ loading: false });
    }, 3000);
  } else if (loadingInstance) {
    clearTimeout(loadingTimer);
    loadingInstance.close();
    loadingInstance = null;
  }
};

onMounted(() => {
  actions.onGlobalStateChange(handleGlobalStateChange, true);
});

onBeforeUnmount(() => {
  actions.offGlobalStateChange(handleGlobalStateChange);
  clearTimeout(loadingTimer);
  if (loadingInstance) {
    loadingInstance.close();
    loadingInstance = null;
  }
});
</script>

<style scoped></style>
