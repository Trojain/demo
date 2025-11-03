import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import qiankun from 'vite-plugin-qiankun';
import { name } from './package.json';

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve';
  return {
    base: isDev ? '/' : '/app-vue3/', // 构建后的路径前缀，要和主应用中 activeRule 一致(activeRule: '/app-vue3')
    plugins: [
      vue(),
      qiankun(name, {
        useDevMode: true
      })
    ],
    server: {
      open: false,
      port: 2003,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'static',
      sourcemap: true
    }
  };
});
