import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// uni-app Vite 配置，保持官方插件链路，确保微信、支付宝、抖音小程序编译一致
export default defineConfig({
  plugins: [uni()],
  css: {
    preprocessorOptions: {
      scss: {
        // 使用 Sass modern compiler API，减少 legacy JS API 弃用告警。
        api: 'modern-compiler'
      }
    }
  }
})
