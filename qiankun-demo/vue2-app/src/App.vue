<template>
  <div id="app">
    <button @click="openLoading">Trigger global loading</button>
  </div>
</template>

<script>
export default {
  methods: {
    openLoading() {
      const actions = this.$globalActions;
      actions?.setGlobalState({ loading: true });
      actions?.setGlobalState({
        vue2ToVue3: {
          msg: 'hello vue3 from vue2',
          timestamp: Date.now()
        }
      });
    }
  }
};
</script>
