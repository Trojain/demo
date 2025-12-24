# 🚀 SaaS Admin Classic

> 基于 React 19 + Ant Design 6 + Vite 7 的企业级后台管理系统模板

---

## 📖 新手入门指南

### 第一步：安装依赖

```bash
pnpm install
# 或者 npm install
```

### 第二步：启动开发服务器

```bash
pnpm dev
# 或者 npm run dev
```

浏览器访问：http://localhost:3000

### 第三步：开始开发

- 登录页：`/login`
- 仪表盘：`/`（需要登录）

---

## 🎯 核心特性一览

| 特性                | 说明                   | 收益             |
| ------------------- | ---------------------- | ---------------- |
| ⚡ **懒加载**       | 页面按需加载           | 首屏速度快 50%+  |
| 🔐 **路由鉴权**     | AuthGuard 自动拦截     | 安全可靠         |
| 🎨 **主题切换**     | 亮/暗色主题 + CSS 变量 | 实时切换主题     |
| 📦 **状态管理**     | Zustand + 持久化       | 轻量级、无 Redux |
| 🛡️ **TypeScript**   | 严格模式类型检查       | 减少 Bug         |
| 🔥 **Fast Refresh** | Vite 极速热更新        | 开发体验好       |
| 🏷️ **路由标签页**   | RouteTabs 多标签管理   | 工作流程更高效   |
| 🌐 **全局 UI 注入** | 任意文件使用 message   | 突破 Hooks 限制  |

---

## 🛠 技术栈详解

### 核心框架

| 依赖                           | 版本    | 说明             |
| ------------------------------ | ------- | ---------------- |
| **React**                      | ^19.2.0 | 最新稳定版       |
| **Ant Design**                 | ^6.1.1  | 企业级 UI 组件库 |
| **@ant-design/pro-components** | ^2.8.10 | 高级业务组件     |
| **Vite**                       | ^7.3.0  | 极速构建工具     |
| **React Router**               | ^7.1.0  | 声明式路由       |

### 状态管理 & 工具

| 依赖        | 版本     | 说明                    |
| ----------- | -------- | ----------------------- |
| **Zustand** | ^5.0.3   | 轻量级状态管理          |
| **Axios**   | ^1.7.9   | HTTP 请求封装           |
| **ahooks**  | ^3.8.1   | React Hooks 工具库      |
| **dayjs**   | ^1.11.13 | 日期处理（替代 moment） |
| **ECharts** | ^5.6.0   | 图表可视化              |

### 代码质量

| 依赖           | 版本     | 说明               |
| -------------- | -------- | ------------------ |
| **TypeScript** | ^5.7.2   | 类型安全           |
| **ESLint**     | ^9.18.0  | 代码规范检查       |
| **Prettier**   | ^3.4.2   | 代码格式化         |
| **Stylelint**  | ^16.12.0 | CSS 样式检查       |
| **Husky**      | ^9.1.7   | Git 提交前自动检查 |
| **Vitest**     | ^2.1.8   | 单元测试框架       |

---

## 📂 目录结构（重点理解）

```
react19-demo/
├── 📄 index.html               # 【入口】HTML 模板
├── 📄 package.json             # 【配置】项目依赖和脚本
├── 📄 vite.config.ts           # 【配置】Vite 构建配置
├── 📄 tsconfig.json            # 【配置】TypeScript 配置
├── 📄 eslint.config.js         # 【配置】ESLint 代码规范
├── 📄 .prettierrc              # 【配置】Prettier 格式化
├── 📄 .stylelintrc.json        # 【配置】Stylelint 样式检查
├── 📄 .env.development         # 【环境】开发环境变量
├── 📄 .env.production          # 【环境】生产环境变量
│
├── 📁 public/                  # 【静态资源】不参与编译
│
└── 📁 src/                     # 【源代码】主要开发目录
    ├── 📄 main.tsx             # 【入口】程序启动文件
    ├── 📄 App.tsx              # 【根组件】路由 + 全局初始化
    ├── 📄 env.d.ts             # 【类型】环境变量类型定义
    ├── 📄 vite-env.d.ts        # 【类型】Vite 环境类型
    │
    ├── 📁 assets/              # 【静态资源】参与编译的资源
    │   └── images/             # - 图片资源
    │
    ├── 📁 components/          # 【通用组件】可复用组件
    │   ├── AuthGuard/          # - 路由鉴权守卫
    │   ├── HeaderActions/      # - 头部操作栏（用户/通知）
    │   ├── Loading/            # - 加载动画
    │   └── RouteTabs/          # - 路由标签页
    │
    ├── 📁 hooks/               # 【自定义 Hooks】公共 Hook
    │
    ├── 📁 layouts/             # 【布局组件】页面框架
    │   ├── BasicLayout/        # - 基础布局（侧边栏 + 头部 + 内容区）
    │   └── GlobalLayout/       # - 全局布局（主题 + 配置）
    │
    ├── 📁 pages/               # 【页面组件】业务页面
    │   ├── 404/                # - 404 错误页
    │   ├── Dashboard/          # - 仪表盘首页
    │   ├── Login/              # - 登录页
    │   ├── Pay/                # - 支付模块
    │   └── System/             # - 系统管理模块
    │       ├── Setting/        #   - 系统设置
    │       └── User/           #   - 用户管理
    │
    ├── 📁 router/              # 【路由配置】所有路由定义
    │   ├── index.tsx           # - 路由入口
    │   ├── config.tsx          # - 路由配置（懒加载 + 嵌套）
    │   └── utils.tsx           # - 路由工具函数
    │
    ├── 📁 services/            # 【API 服务】后端接口封装
    │   └── user.ts             # - 用户相关 API
    │
    ├── 📁 store/               # 【状态管理】全局状态
    │   ├── tabs.ts             # - 标签页状态
    │   ├── theme.ts            # - 主题状态
    │   └── user.ts             # - 用户状态
    │
    ├── 📁 styles/              # 【样式文件】全局样式
    │   ├── global.scss         # - 全局 CSS
    │   ├── theme.scss          # - 主题样式（亮/暗色）
    │   └── variables.scss      # - SCSS 变量
    │
    ├── 📁 test/                # 【测试文件】单元测试
    │   └── setup.ts            # - 测试环境配置
    │
    └── 📁 utils/               # 【工具函数】公共方法
        ├── globalUI.ts         # - 全局 UI 工具（message/modal）
        ├── lazyLoad.tsx        # - 懒加载包裹器
        └── request.ts          # - Axios 封装（核心）
```

---

## 🔥 核心架构解析

### 1️⃣ 全局 UI 注入（突破 Hooks 限制）

```typescript
// src/utils/globalUI.ts - 定义全局 UI 实例
export const globalUI = {
  message: {...},  // Antd message
  modal: {...},    // Antd modal
  navigate: () => {}  // Router navigate
}

export const setGlobalUI = (message, modal, navigate) => {
  globalUI.message = message  // 注入实例
  globalUI.modal = modal
  globalUI.navigate = navigate
}
```

**使用场景**：在任意 `.ts` 文件中使用 `globalUI.message.error('xxx')`

---

### 2️⃣ 请求封装（src/utils/request.ts）

```typescript
// 全局单例
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
})

// 请求拦截：自动添加 Token
instance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截：401 防抖弹窗
let isRelogging = false
if (error.response?.status === 401 && !isRelogging) {
  isRelogging = true
  modal.warning({ title: '登录过期', onOk: () => navigate('/login') })
}
```

**关键点**：

- ✅ 单例模式：TCP 连接复用
- ✅ 防抖 401：10 个并发请求只弹 1 次

---

### 3️⃣ 路由设计（配置式 + 懒加载）

```typescript
// src/router/config.tsx - 统一路由配置
export const menuRoutes: AppRouteConfig[] = [
  {
    path: '/dashboard',
    name: '仪表盘',
    icon: <DashboardOutlined />,
    component: lazy(() => import('@/pages/Dashboard')),
  },
  {
    path: '/system',
    name: '系统管理',
    icon: <SettingOutlined />,
    children: [
      { path: 'user', name: '个人中心', component: lazy(() => import('@/pages/System/User')) },
      { path: 'setting', name: '账号设置', component: lazy(() => import('@/pages/System/Setting')) },
    ],
  },
]
```

**关键点**：

- ✅ 配置式路由：菜单与路由统一管理
- ✅ `lazy()` 懒加载：自动代码分割
- ✅ AuthGuard：自动拦截未登录用户

---

### 4️⃣ 状态管理（Zustand + 持久化）

```typescript
// src/store/user.ts
export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      userInfo: null,
      setUserInfo: (info) => set({ userInfo: info }),
      clearUserInfo: () => set({ userInfo: null }),
    }),
    { name: 'user-storage' }, // 自动持久化到 localStorage
  ),
)

// 组件外获取状态
export const getToken = () => useUserStore.getState().userInfo?.token
```

**收益**：

- ✅ 无 Redux 样板代码
- ✅ 自动持久化
- ✅ 支持组件外访问

---

### 5️⃣ 样式管理（SCSS + 主题）

```scss
// src/styles/variables.scss
$primary-color: #1890ff;
$spacing-md: 16px;
$border-radius-base: 4px;
$box-shadow-base: 0 2px 8px rgba(0, 0, 0, 0.15);
```

```typescript
// src/main.tsx - Ant Design 主题配置
<ConfigProvider
  locale={zhCN}
  theme={{
    token: { colorPrimary: '#1677ff' },
    cssVar: true,
  }}
>
```

**收益**：一处修改，全局生效

---

## 🛠️ 常用命令

| 命令              | 说明                             |
| ----------------- | -------------------------------- |
| `pnpm dev`        | 启动开发服务器（默认 3000 端口） |
| `pnpm build`      | 生产构建（tsc + vite build）     |
| `pnpm preview`    | 预览生产构建结果                 |
| `pnpm lint`       | ESLint 代码检查                  |
| `pnpm lint:fix`   | 自动修复 ESLint 错误             |
| `pnpm lint:style` | Stylelint 样式检查               |
| `pnpm format`     | Prettier 格式化代码              |
| `pnpm type-check` | TypeScript 类型检查              |
| `pnpm test`       | 运行 Vitest 单元测试             |
| `pnpm prepare`    | 安装 Husky Git hooks             |

> **Node 版本要求**：`>= 20.0.0`

---

## 🎓 学习路径建议

### 新手入门

1. 启动项目：`pnpm install && pnpm dev`
2. 理解入口：`src/main.tsx` → `src/App.tsx`
3. 看懂路由：`src/router/config.tsx`
4. 理解鉴权：`src/components/AuthGuard/index.tsx`
5. 学习请求：`src/utils/request.ts` + `src/utils/globalUI.ts`

### 进阶开发

| 任务                | 操作步骤                                                           |
| ------------------- | ------------------------------------------------------------------ |
| **添加新页面**      | 1. 在 `src/pages/` 创建组件 2. 在 `src/router/config.tsx` 添加路由 |
| **封装新 API**      | 在 `src/services/` 创建服务文件                                    |
| **添加状态管理**    | 在 `src/store/` 创建 Zustand store                                 |
| **全局样式变量**    | 在 `src/styles/variables.scss` 添加变量                            |
| **添加自定义 Hook** | 在 `src/hooks/` 创建 Hook 文件                                     |

---

## ⚠️ 常见问题

<details>
<summary><b>Q1: 首次运行报错？</b></summary>

删除 `node_modules` 和 `pnpm-lock.yaml`，重新 `pnpm install`

</details>

<details>
<summary><b>Q2: 登录后白屏？</b></summary>

检查浏览器 Console 错误，通常是 token 格式或 API 地址问题

</details>

<details>
<summary><b>Q3: 如何修改主题色？</b></summary>

1. 修改 `src/main.tsx` 中 `ConfigProvider` 的 `token.colorPrimary`
2. 修改 `src/styles/variables.scss` 中的 `$primary-color`
</details>

<details>
<summary><b>Q4: 如何在非组件文件中使用 message/modal？</b></summary>

使用 `globalUI`：

```typescript
import { globalUI } from '@/utils/globalUI'

globalUI.message.success('操作成功')
globalUI.modal.warning({ title: '提示', content: '...' })
```

</details>

<details>
<summary><b>Q5: 如何添加新页面？</b></summary>

1. 在 `src/pages/` 创建页面组件
2. 在 `src/router/config.tsx` 添加路由配置
3. 热更新自动生效，无需重启
</details>

---

## 📝 环境变量配置

```bash
# .env.development (开发环境)
VITE_API_BASE_URL=http://adminclub.mz.com:32731/mg
VITE_APP_TITLE=SaaS Admin Classic

# .env.production (生产环境)
VITE_API_BASE_URL=https://api.production.com
VITE_APP_TITLE=SaaS Admin Classic
```

**使用方式**：

```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL
const title = import.meta.env.VITE_APP_TITLE
```

---

## 📚 推荐文档

- [React 19 官方文档](https://react.dev)
- [Ant Design 6 文档](https://ant.design)
- [Vite 官方文档](https://vitejs.dev)
- [React Router 文档](https://reactrouter.com)

---

## � License

MIT

---

**⭐ 如果这个项目对你有帮助，欢迎 Star！**
