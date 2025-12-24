import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '*.config.js'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactPlugin.configs.flat.recommended,
      reactPlugin.configs.flat['jsx-runtime'],
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_|^entity$',
          varsIgnorePattern: '^_',
        },
      ],

      // ========== TypeScript 宽松规则 ==========
      '@typescript-eslint/no-explicit-any': 'off', // 允许 any 类型
      '@typescript-eslint/no-non-null-assertion': 'off', // 允许非空断言 (!)
      '@typescript-eslint/ban-ts-comment': 'off', // 允许 @ts-ignore 等注释
      '@typescript-eslint/no-empty-function': 'off', // 允许空函数

      // ========== React 宽松规则 ==========
      'react-hooks/exhaustive-deps': 'warn', // 依赖检查改为警告（不阻塞）

      // ========== 通用规则 ==========
      'no-console': 'off', // 允许 console (开发时常用)
      'no-debugger': 'warn', // debugger 改为警告
      'no-empty': 'off', // 允许空代码块

      // ========== React 额外规则 ==========
      'react/prop-types': 'off', // TS 项目不需要 prop-types
      'react/display-name': 'off', // 允许组件不写 displayName
      'react/no-unescaped-entities': 'off', // 允许 JSX 中使用 ' " > }
      'react/no-children-prop': 'off', // 允许 children 作为 prop 传递
    },
  },
  eslintConfigPrettier,
)
