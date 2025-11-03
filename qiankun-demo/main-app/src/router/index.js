import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/:app(app-vue2|app-react|app-vue3)/:catchAll(.*)*',
    component: {
      template: '<div id="subapp-container"></div>'
    }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
