import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import qiankun from 'vite-plugin-qiankun';
import { name } from './package.json';

export default defineConfig({
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
    }
});
