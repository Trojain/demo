import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import compression from 'vite-plugin-compression'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'antd-vendor': ['antd', '@ant-design/icons', '@ant-design/cssinjs'],
            'utils-vendor': ['axios', 'dayjs', 'lodash-es', 'classnames'],
            'charts-vendor': ['@ant-design/plots'],
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
