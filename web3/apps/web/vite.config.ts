import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 固定前端开发端口，避免 3102 被占用时 Vite 自动切到其他端口导致代理地址混乱。
    port: 3102,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3101',
      '/ws': {
        target: 'ws://localhost:3101',
        ws: true,
      },
    },
  },
})
