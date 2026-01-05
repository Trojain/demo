import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import compression from 'vite-plugin-compression'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 🔥 优化：将正则定义放在函数外部，避免重复创建，提升构建性能
const REGEX = {
  // React 19 核心生态 (包含 use-sync-external-store 等底层依赖)
  REACT_CORE:
    /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|use-sync-external-store|zustand)[\\/]/,

  // 移动端 UI (独立，绝对不能混入 PC)
  ANTD_MOBILE: /[\\/]node_modules[\\/](antd-mobile|antd-mobile-icons)[\\/]/,

  // 图表库 (体积巨大，优先匹配)
  CHARTS: /[\\/]node_modules[\\/](@ant-design[\\/]plots|@antv|d3-|d3|zrender|dagre)[\\/]/,

  // PC 端 UI (包含 antd, @ant-design 以及大量 rc- 组件)
  // 关键修正：rc-[^/]+ 精准匹配 rc-table 等包名，不贪婪
  UI_PC: /[\\/]node_modules[\\/](antd|@ant-design|rc-[^/]+|@rc-component)[\\/]/,

  // 工具库
  UTILS: /[\\/]node_modules[\\/](axios|dayjs|lodash|lodash-es|ahooks|classnames)[\\/]/,
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  const isAnalyze = mode === 'analyze'

  return {
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler', { target: '19' }]],
        },
      }),
      // 打包分析
      isAnalyze && visualizer({ open: true, filename: 'dist/analyze.html', gzipSize: true, brotliSize: true }),
      // 生产环境压缩
      isProd && compression({ algorithm: 'gzip', ext: '.gz' }),
      isProd && compression({ algorithm: 'brotliCompress', ext: '.br' }),
    ].filter(Boolean),

    // 1. 路径别名
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        lodash: 'lodash-es',
      },
    },

    // 2. CSS 配置
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          additionalData: `@use "@/styles/variables.scss" as *;`,
        },
      },
      modules: {
        localsConvention: 'camelCaseOnly',
        scopeBehaviour: 'local',
        generateScopedName: '[name]__[local]___[hash:base64:5]',
      },
    },

    // 3. 开发服务器
    server: {
      port: 3000,
      host: true,
      open: true,
      cors: true,
    },

    // 4. 构建配置
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsDir: 'assets',
      cssCodeSplit: true,
      sourcemap: !isProd,
      chunkSizeWarningLimit: 1500,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (REGEX.REACT_CORE.test(id)) return 'react-core'
            if (REGEX.ANTD_MOBILE.test(id)) return 'ui-mobile'
            if (REGEX.CHARTS.test(id)) return 'charts-vendor'
            if (REGEX.UI_PC.test(id)) return 'ui-pc'
            if (REGEX.UTILS.test(id)) return 'utils-vendor'
            return 'vendor-common'
          },
        },
      },
    },

    // 5. Esbuild 生产环境优化
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [],
    },

    // 6. 依赖预构建
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'antd',
        '@ant-design/icons',
        'antd-mobile',
        'antd-mobile-icons',
        'axios',
        'dayjs',
        '@ant-design/plots',
        'lodash-es',
      ],
    },

    // 7. 测试环境配置
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  }
})
