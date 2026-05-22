# uni-app 项目创建进度

## v0.1.0 时间轴

### 2026-05-20

已完成：

- 确认项目使用 `pnpm` 管理依赖。
- 确认项目使用 JavaScript，不引入 TypeScript 源码。
- 创建 uni-app Vue3 Vite 项目基础结构。
- 配置微信、支付宝、抖音小程序运行和构建脚本。
- 配置 `src/manifest.json` 中三端小程序基础节点。
- 在应用生命周期和首页加载流程加入必要调试日志。

已确认决策：

- 技术栈选择 `uni-app + Vue 3 + Vite + JavaScript`。
- 依赖版本选择跟随官方 Vue3 Vite 模板的稳定组合。
- `@dcloudio/*` 相关包锁定为 `3.0.0-5000720260410001`。
- `vue` 锁定为 `3.4.21`，和 uni-app 编译链中的 Vue 编译器版本保持一致。
- `vite` 锁定为 `5.2.8`，符合 `@dcloudio/vite-plugin-uni` 的兼容要求。
- `@dcloudio/types` 锁定为 `3.4.28`，满足 `@dcloudio/uni-app` 的 peer 依赖要求。
- `packageManager` 标记为 `pnpm@11.1.3`，本机当前可用版本为 `pnpm@10.30.3`。

待办和后期优化：

- 接入真实微信、支付宝、抖音小程序 appid。
- 根据业务需要引入状态管理、请求封装和环境变量配置。
- 后续如需组件库，再评估 `uni-ui` 是否符合页面复杂度。

已知坑位：

- `pnpm dlx` 默认写入用户缓存目录，在当前环境会触发权限问题，已通过项目级 `.npmrc` 固定安装缓存目录。
- GitHub 模板压缩包下载在当前网络下失败，项目文件按官方模板结构手工生成。
- 未执行小程序 build，符合本次要求中的非必要不执行构建。

## v0.1.1 时间轴

### 2026-05-20

已完成：

- 执行 `pnpm install` 并生成 `pnpm-lock.yaml`。
- 将 `vue`、`@vue/runtime-core`、`@dcloudio/types` 固定到和 uni-app 编译链兼容的精确版本。
- 配置 `pnpm.onlyBuiltDependencies`，允许 `esbuild`、`core-js`、`core-js-pure` 完成必要安装脚本。
- 验证 `pnpm list --depth 0`、`pnpm exec vite --version`、`pnpm exec uni --help` 可正常执行。

已确认决策：

- 当前环境使用本机 `pnpm@10.30.3` 完成依赖安装，`packageManager` 继续声明推荐版本 `pnpm@11.1.3`。
- 因全局工具目录无写入权限，已在 `.npmrc` 中关闭 `manage-package-manager-versions` 自动管理。

待办和后期优化：

- 如需严格启用 `pnpm@11.1.3`，建议在有全局工具目录权限的终端执行 `pnpm self-update` 后再安装。
- 后续接入真实业务时，再补充请求封装、环境配置和平台差异处理。

已知坑位：

- `vue-i18n@9.1.9` 会提示维护状态警告，这是当前 uni-app 依赖链的兼容选择，后续需等待官方编译链升级后再评估迁移。
- `pnpm exec uni --help` 会输出 Node 循环依赖警告，不影响当前 CLI 帮助信息读取。

## v0.1.2 时间轴

### 2026-05-20

已完成：

- 修复 Vite 启动时报 `Preprocessor dependency "sass" not found` 的问题。
- 安装 `sass@1.99.0` 到 `devDependencies`，支持 `.vue` 文件中的 `lang="scss"` 和 `src/uni.scss`。
- 将 `@parcel/watcher` 加入 `pnpm.onlyBuiltDependencies`，允许其完成文件监听相关安装脚本。
- 执行 `pnpm install` 同步锁文件。
- 验证 `pnpm list sass --depth 0` 和 `pnpm exec uni --help` 可正常执行。

已确认决策：

- 保留 SCSS 写法，继续使用 `uni.scss` 管理 uni-app 常用样式变量。
- 不改成纯 CSS，避免后续丢失变量能力和样式组织能力。

待办和后期优化：

- 后续新增页面时，优先复用 `src/uni.scss` 中的样式变量。

已知坑位：

- `sass` 是开发期依赖，缺失时会导致 Vite 无法解析 `lang="scss"`。

## v0.2.0 时间轴

### 2026-05-20

已完成：

- 按 Pixabay API 文档分类实现首页分类入口，分类值覆盖 `backgrounds`、`fashion`、`nature`、`science`、`education`、`feelings`、`health`、`people`、`religion`、`places`、`animals`、`industry`、`computer`、`food`、`sports`、`transportation`、`travel`、`buildings`、`business`、`music`。
- 实现快捷搜索配置，支持 `editors_choice`、`order`、`image_type`、`orientation` 四类参数组合。
- 新增 Pixabay 配置文件 `src/config/pixabay.js`，集中管理 API 地址、API key 和分页配置。
- 新增 Pixabay 分类和快捷搜索配置文件 `src/config/pixabay-options.js`。
- 新增图片查询接口封装 `src/services/pixabay-api.js`，包含请求参数整理、返回数据标准化、请求成功和失败日志。
- 新增图片保存工具 `src/utils/image-save.js`，使用 `uni.downloadFile` 和 `uni.saveImageToPhotosAlbum` 完成保存到相册。
- 新增查询参数编解码工具 `src/utils/query.js`。
- 重构首页为壁纸入口页，包含搜索入口、快捷搜索、Pixabay 官方分类和底部导航。
- 新增搜索页，支持关键词、分类、快捷筛选、分页加载、空状态和 API key 缺失提示。
- 搜索页只展示非默认筛选条件，`editors_choice` 支持再次点击取消。
- 新增壁纸详情页，支持图片预览、作者信息、统计信息和保存相册。
- 新增我的页，用于展示配置说明和后续扩展下载记录。
- 更新 `README.md`，补充 Pixabay API key 和小程序合法域名配置说明。

已确认决策：

- 第一版采用小程序端直连 Pixabay API，便于快速验证功能闭环。
- Pixabay API key 暂放在 `src/config/pixabay.js`，上线前建议改为后端代理。
- 页面分类按 Pixabay 官方 `category` 参数实现，中文仅用于展示。
- 双列布局使用 Flex 实现，减少微信、支付宝、抖音小程序 CSS 差异风险。

待办和后期优化：

- 填写真实 Pixabay API key 后，分别在微信、支付宝、抖音开发者工具中验证接口请求和图片展示。
- 在三端小程序后台配置 `pixabay.com` 和 `cdn.pixabay.com` 合法域名。
- 后续可增加收藏、下载记录、缓存 24 小时策略和后端代理。

已知坑位：

- 已废弃：未配置 API key 时搜索页展示配置提示并跳过请求。v0.2.2 已移除该阻断逻辑。
- Pixabay 图片 URL 不建议长期入库直连，正式上线建议将图片资源下载并缓存到自有服务。
- 保存相册依赖用户授权，不同小程序平台失败提示文案可能不同。

## v0.2.1 时间轴

### 2026-05-20

已完成：

- 按需求移除首页 `pages/index/index` 的快捷搜索模块。
- 首页保留顶部搜索入口、Pixabay 官方分类网格和底部导航。
- 删除首页中不再使用的 `QUICK_FILTER_GROUPS` 引入、`quickFilterGroups` 数据和 `goFilter` 方法。

已确认决策：

- 快捷筛选能力继续保留在搜索页，避免首页信息过载。
- `src/config/pixabay-options.js` 中的 `QUICK_FILTER_GROUPS` 保留，供搜索页继续复用。

待办和后期优化：

- 后续根据实际视觉效果调整首页分类卡片高度和间距。

## v0.2.2 时间轴

### 2026-05-20

已完成：

- 移除 Pixabay API key 的前端阻断判断。
- 删除搜索页 API key 缺失提示卡片。
- 删除 `hasPixabayApiKey` 方法和搜索页 `hasApiKey` 状态。
- 搜索页现在直接发起 Pixabay 请求，失败时统一进入请求错误日志和 toast 提示。

已确认决策：

- `src/config/pixabay.js` 继续保留 `apiKey` 配置项。
- API key 已由用户配置，前端不再因为空值判断主动跳过请求。

已知坑位：

- 如果 API key 无效或小程序合法域名未配置，搜索页会显示请求失败，需要看 `[PixabayApi]` 和 `[SearchPage]` 日志定位。

## v0.2.3 时间轴

### 2026-05-20

已完成：

- 将搜索页快捷筛选区从多行分组面板改为一行紧凑筛选栏。
- `精选` 改为直接开关 `editors_choice`。
- `排序`、`类型`、`方向` 改为点击后通过 `uni.showActionSheet` 选择。
- 紧凑筛选栏支持横向滚动，避免小屏设备上按钮挤压变形。
- 保留原有 `QUICK_FILTER_GROUPS` 配置，页面只改变展示和交互方式。

已确认决策：

- 暂不引入 `vant-weapp`，继续使用 uni-app 原生能力和自定义样式，保证微信、支付宝、抖音三端兼容。
- 筛选项使用 `uni.showActionSheet`，减少页面纵向占用。

待办和后期优化：

- 在真实设备上观察 `uni.showActionSheet` 三端样式差异，必要时再改为自定义底部弹层。

## v0.2.4 时间轴

### 2026-05-20

已完成：

- 将 Pixabay 默认分页数量从 `20` 调整为 `10`。
- 在 `src/config/pixabay.js` 为 `defaultPageSize` 增加中文注释，说明降低首屏加载压力和免费接口频率消耗。

已确认决策：

- 只修改统一配置 `PIXABAY_API_CONFIG.defaultPageSize`，搜索页继续通过默认配置生效。
- `maxPageSize` 保持 `50`，后续特殊页面仍可按需传入更大的 `per_page`，但不会超过上限。

## v0.2.5 时间轴

### 2026-05-20

已完成：

- 移除 `QUICK_FILTER_GROUPS` 配置中的 `title` 字段。
- 搜索页已选筛选标签去掉 `推荐 / 排序 / 类型 / 方向` 这类标题前缀，直接展示选项名称。
- 搜索页紧凑筛选栏继续直接展示当前选项的 `label`。
- 为快捷搜索配置补充中文注释，说明页面展示直接使用 `options.label`。

已确认决策：

- 快捷筛选 UI 不再依赖分组标题，只依赖 `key` 和 `options`。
- 弹出选择逻辑继续通过 `key` 绑定 API 参数，不影响接口查询。

## v0.2.6 时间轴

### 2026-05-20

已完成：

- 在 `DEFAULT_SEARCH_FILTERS` 中新增 `lang: 'zh'`，将 Pixabay 默认搜索语言改为中文。
- 在 `searchPixabayImages` 请求参数中新增 `lang`，确保每次查询都会带上语言参数。
- 为 `lang` 默认值补充中文注释。

已确认决策：

- 语言参数归入统一筛选对象，后续如果增加语言切换，可以直接复用该字段。

## v0.2.7 时间轴

### 2026-05-20

已完成：

- 将手写底部导航迁移为 `pages.json` 原生 `tabBar` 配置。
- 删除首页、搜索页、我的页中的 `.bottom-nav` 模板、样式和无用跳转方法。
- 首页搜索入口改为 `uni.switchTab` 跳转搜索 Tab。
- 图片详情页继续保留 `uni.navigateTo`，因为详情页不是 Tab 页面。
- 收缩三个 Tab 页底部 padding，避免原手写底栏预留空间造成页面过长。

已确认决策：

- 第一版 TabBar 只使用文字，不配置图标资源，降低跨平台资源维护成本。
- Tab 页面之间使用小程序原生 TabBar 管理选中态和页面切换。

待办和后期优化：

- 后续如需图标，再补充普通和选中两套本地图片资源，并在 `tabBar.list` 中配置 `iconPath` 与 `selectedIconPath`。

## v0.2.8 时间轴

### 2026-05-20

已完成：

- 修复 `navigateTo:fail:can not navigate to a tab bar page` 报错。
- 新增 `src/config/storage-keys.js`，集中管理搜索页待执行筛选条件的缓存 key。
- 首页分类点击改为先写入 `SEARCH_PENDING_FILTERS_KEY`，再通过 `uni.switchTab` 切换到搜索 Tab。
- 搜索页新增 `onShow` 读取首页传入的筛选条件，读取后立即删除缓存，避免重复触发。
- 搜索页新增 `hasLoaded` 标记，首次进入搜索 Tab 时执行默认搜索，从详情页返回时不重复刷新。

已确认决策：

- TabBar 页面之间不再使用 `navigateTo` 携带 query。
- 分类筛选参数通过本地缓存跨 Tab 传递，符合小程序 TabBar 页面跳转规则。

已知坑位：

- `uni.switchTab` 不能携带 query，后续所有跳转到 Tab 页面且需要传参的场景，都应使用缓存、全局状态或事件方式处理。

## v0.2.9 时间轴

### 2026-05-20

已完成：

- 增加 Pixabay 视频接口支持，视频请求地址为 `https://pixabay.com/api/videos/`。
- 新增 `MEDIA_TYPE_OPTIONS`，支持搜索页在分类条件后切换 `图片 / 视频`。
- 在默认筛选对象中新增 `media_type: 'image'` 和 `video_type: 'all'`。
- 搜索接口封装根据 `media_type` 自动选择图片接口或视频接口。
- 图片接口继续传 `image_type` 和 `orientation`，视频接口改传 `video_type`，并隐藏视频模式下的方向筛选。
- 新增视频结果标准化逻辑，统一输出封面、视频地址、作者、标签、浏览、下载、喜欢和时长字段。
- 搜索列表中视频卡片增加“视频”标识。
- 详情页支持视频播放，视频使用小程序 `video` 组件，图片继续支持保存到相册。

已确认决策：

- 分类配置继续复用 `PIXABAY_CATEGORIES`，图片和视频共用相同分类值。
- 第一版暂不做视频保存到相册，先支持视频查询、封面展示和详情播放。

待办和后期优化：

- 后续如需视频下载，需要单独评估微信、支付宝、抖音三端保存视频到相册的权限和 API 差异。
- 如视频详情 URL 超过小程序页面跳转长度限制，可改为写入缓存后再进入详情页。

## v0.3.0 时间轴

### 2026-05-20

已完成：

- 增加 Pixabay 接口错误码 `PIXABAY_ERROR_CODES`。
- 新增限流错误识别逻辑，识别 `statusCode === 429` 以及响应内容包含 `rate`、`limit`、`too many` 的情况。
- 接口非 2xx 响应会抛出带 `code` 和 `detail` 的错误对象。
- 搜索页根据 `PIXABAY_RATE_LIMIT` 错误码显示 `请求频繁，稍后再试`。
- 其他接口失败继续显示 `图片查询失败`。

已确认决策：

- 限流识别放在接口层，页面只负责按错误码展示用户友好文案。
- 网络失败归类为 `PIXABAY_REQUEST_FAILED`，暂不显示限流文案。

已知坑位：

- 如果 Pixabay 返回的限流文案不包含 `rate`、`limit`、`too many` 且状态码也不是 `429`，会被归类为普通请求失败。

## v0.3.1 时间轴

### 2026-05-20

已完成：

- 新建 `src/pages/pixabay/` 模块目录，将 Pixabay 相关页面收拢到模块内。
- 将原 Pixabay 分类首页移动到 `src/pages/pixabay/index/index.vue`。
- 将原搜索页移动到 `src/pages/pixabay/search/index.vue`。
- 将原详情页移动到 `src/pages/pixabay/detail/index.vue`。
- 重写 `src/pages/index/index.vue` 为大类入口分发页，目前提供 `精选素材` 入口。
- 更新 `pages.json`，根 TabBar 调整为 `首页 / 我的`，Pixabay 搜索和详情作为模块内部页面。
- 将用户可见文案从“壁纸”统一调整为“素材”，例如 `搜索素材`、`精选素材`、`素材详情`。
- 删除旧 TabBar 传参缓存文件 `src/config/storage-keys.js`，Pixabay 模块内部页面恢复使用 `navigateTo` 携带查询参数。
- 详情页 query 参数从 `image` 调整为 `media`，并兼容旧的 `image` 参数。

已确认决策：

- 根首页负责未来多个内容接口的大类入口分发。
- Pixabay 只是一个素材模块，相关页面统一归入 `pages/pixabay`。
- 搜索页不再作为底部 Tab 页面，避免后续新增模块时底部导航混乱。

待办和后期优化：

- 后续接入新内容接口时，优先在根首页新增入口卡片，并按模块新建 `pages/<module>/` 页面目录。

## v0.3.2 时间轴

### 2026-05-20 15:54:34

已完成：

- 为 Pixabay 视频详情页接入“保存到相册”按钮。
- 新增 `saveNetworkVideoToAlbum` 工具方法，使用 `uni.downloadFile` 下载网络视频，再调用 `uni.saveVideoToPhotosAlbum` 保存到系统相册。
- 详情页 `saveMedia` 方法按素材类型分流，图片继续走 `saveNetworkImageToAlbum`，视频走 `saveNetworkVideoToAlbum`。
- 为视频保存链路增加中文调试日志，覆盖点击保存、开始下载、下载完成、保存成功、保存失败等关键节点。
- 为视频保存平台权限依赖增加中文注释，方便后续真机排查。

已确认决策：

- 图片和视频详情页复用同一个“保存到相册”操作入口，减少页面操作差异。
- 视频保存失败时弹出授权提示，并保留控制台错误日志。

待办和后期优化：

- 需要在微信、支付宝、抖音开发者工具和真机分别验证 `uni.saveVideoToPhotosAlbum` 的平台兼容性与权限提示表现。
- 如果某个平台不支持该 API，后续可按平台条件编译补充降级提示。

已知坑位：

- Pixabay 视频 URL 需要配置到对应小程序平台的 downloadFile 合法域名，否则会下载失败。
- 保存视频到相册依赖用户授权，授权被拒绝时需要用户在平台设置中重新开启权限。

## v0.3.3 时间轴

### 2026-05-20 16:00:16

已完成：

- 修正 Pixabay 搜索页快捷筛选中 `order` 的激活态判断。
- 默认排序值为 `popular` 时，`热门` 选项也会显示高亮背景，和当前实际选中值保持一致。
- 在搜索页高亮判断方法中补充中文注释，说明排序项的视觉处理原因。

已确认决策：

- 本次只调整 `order` 的默认高亮，不改动 `orientation` 等其他默认筛选项的展示规则，避免筛选栏默认出现过多激活态。

待办和后期优化：

- 如果后续希望“类型 / 方向”的默认值也统一高亮，可以再抽成按筛选组维度控制的配置项。

## v0.4.0 时间轴

### 2026-05-20 16:35:27

已完成：

- 将原 `pixabay` 模块整体重命名为 `material`，包含页面目录、路由路径、配置文件、服务文件、变量名、日志前缀与首页入口方法名。
- 保持素材模块原有功能不变，继续支持图片、视频、分类、排序、精选筛选、详情预览与保存到相册。
- 新增 `src/config/wallpaper.js` 和 `src/services/wallpaper-api.js`，接入 360 壁纸分类接口与分类列表接口。
- 新增 `pages/wallpaper/index`、`pages/wallpaper/list`、`pages/wallpaper/detail` 三个页面，完成壁纸分类浏览、列表分页、详情预览和保存到相册。
- 首页入口扩展为 `精选素材` 和 `360壁纸` 两个模块入口。
- 更新个人页配置说明，补充素材模块与 360 壁纸模块的合法域名提示。

已确认决策：

- `material` 模块只做命名抽象，不调整底层第三方素材接口能力。
- `wallpaper` 模块当前只接入 360 壁纸，不接入 Bing，也不做多源整合。
- 360 壁纸模块页面布局复用素材模块的结构习惯，统一保持分类卡片、双列列表和详情底部操作栏。

待办和后期优化：

- 后续如需接入 Bing 壁纸，可在 `wallpaper` 模块内增加来源切换，再补统一服务封装。
- 如果 360 的 `http` 接口在目标小程序平台受限，建议增加后端代理或中转层。
- 360 返回的图片字段可能随分类或资源类型变化，必要时继续补充 `normalizeWallpaper` 的字段兼容分支。

已知坑位：

- 360 分类接口和列表接口当前文档示例为 `http`，正式发布时需重点验证微信、支付宝、抖音对该域名和协议的限制。
- 360 图片真实下载域名可能和接口域名不同，发布前需要结合真机日志把实际图片域名补齐到平台白名单。

## v0.4.1 时间轴

### 2026-05-20 16:51:03

已完成：

- 清理 `src/` 目录下业务源码中的 `console.info`、`console.warn`、`console.error` 等调试输出。
- 删除因清理日志而失去意义的页面生命周期钩子与初始化空壳逻辑。
- 保留用户可见的错误反馈能力，下载失败、请求失败等场景继续通过 `toast`、`modal` 和 `reject` 处理。

已确认决策：

- 后续非必要不再主动添加 `console` 调试输出。
- 只有在你明确要求，或者临时排查问题确实需要时，才会恢复少量调试日志。

## v0.4.2 时间轴

### 2026-05-20 17:02:33

已完成：

- 按 360 壁纸文档能力重构 `wallpaper` 模块服务层，新增分类列表、关键词搜索、最近更新、热门搜索词四类查询能力。
- 新增 `hotKeywordUrl` 和 `WALLPAPER_LIST_MODES` 配置，统一管理分类模式、搜索模式和最近更新模式。
- 首页升级为壁纸能力入口页，增加搜索入口、最近更新入口和热门搜索词快捷入口。
- 列表页重构为统一壁纸页，支持分类浏览、关键词搜索和最近更新三种模式。
- 详情页移除 `views`、`downloads` 展示，因为 360 文档未提供稳定返回字段。
- 详情页新增 `utag` 展示，文案为 `壁纸tags`，并增加 `createTime` 时间展示。

已确认决策：

- 只展示接口文档中能稳定确认的字段，不再向页面组装不确定统计字段。
- 壁纸标题优先使用 `utag`，没有 `utag` 时再回退到 `tag` 的首个标签。

待办和后期优化：

- 如需进一步提升搜索体验，可后续补充搜索历史和最近访问分类缓存。
- 如果真机验证发现热门搜索词接口返回结构与当前兼容分支不同，可再补一层字段兜底。

## v0.4.3 时间轴

### 2026-05-20 17:11:43

已完成：

- 修复 `src/App.vue` 只有 `<style>` 导致的 `vite:vue` 单文件组件编译错误。
- 为 `App.vue` 补充最小 `script` 导出，恢复 Vue SFC 合法结构。

已确认决策：

- 本次只修复阻断编译的 `App.vue` 结构问题。
- `sass` 的 `legacy-js-api` 警告暂不处理，因为当前属于兼容性提示，不是本次阻断项。

## v0.4.4 时间轴

### 2026-05-20 17:18:33

已完成：

- 将 `src/App.vue` 中的 `@import './uni.scss';` 替换为 `@use './uni.scss' as *;`。
- 消除 `@import` 废弃写法带来的 Sass 提示，保持全局样式入口不变。

已确认决策：

- 本次只处理 `App.vue` 里最直接的 Sass 废弃告警入口。
- `src/uni.scss` 当前仅包含变量定义，适合平滑迁移到 `@use`。

## v0.4.5 时间轴

### 2026-05-20 17:22:23

已完成：

- 删除 `src/App.vue` 中对 `uni.scss` 的样式引入。
- 修复 `@use './uni.scss' as *;` 触发的 Sass 变量重名错误。

已确认决策：

- `App.vue` 当前样式未使用 `uni.scss` 变量，因此直接移除引入是最小且最稳的修复方式。

## v0.4.7 时间轴

### 2026-05-20 17:44:46

已完成：

- 在 `vite.config.js` 中新增 `css.preprocessorOptions.scss.api = 'modern-compiler'` 配置。
- 将 Sass 预处理切到 Vite 支持的 modern compiler API 方向，尝试压低 `legacy-js-api` 弃用告警。

已确认决策：

- 本次只调整 Vite 配置，不升级依赖，不改业务样式文件。
- 如果 warning 仍然存在，下一步优先怀疑 `@dcloudio/vite-plugin-uni` 内部仍有旧 Sass 调用链。

## v0.5.1 时间轴

### 2026-05-20 18:39:27

已完成：

- 收缩 `wallpaper` 模块，只保留 `getAllCategoriesV2` 和 `getAppsByCategory` 两类接口能力。
- 删除按关键字搜索壁纸、获取今日热门搜索、获取最近更新壁纸三类接口及相关前端逻辑。
- 首页去掉搜索壁纸入口、最近更新入口、热门搜索词展示。
- 列表页去掉搜索模式、最近更新模式、搜索框、热门搜索词区和模式切换逻辑。
- 服务层删除 `hotKeywordUrl`、`WALLPAPER_LIST_MODES`、`searchWallpapers`、`fetchLatestWallpapers`、`fetchWallpaperHotKeywords`、`fetchWallpaperFeed`。
- 个人页合法域名说明中移除 `openbox.mobilem.360.cn`。

已确认决策：

- 360 壁纸模块后续仅维护分类浏览能力，避免继续依赖当前不稳定的公开接口。
- 页面结构回归分类入口页和分类列表页两层主流程，减少无效交互入口。

## v0.5.2 时间轴

### 2026-05-20 18:55:03

已完成：

- 新增 `src/utils/display-text.js`，统一处理接口返回展示文案中的敏感词替换。
- 在 `material` 服务层中对素材 `tags` 增加展示文本清洗，将返回中的“美女”替换为“女神”。
- 在 `wallpaper` 服务层中对分类名、分类标签、壁纸标题、`utag`、`tags`、分类名等展示字段增加相同替换。

已确认决策：

- 本次只处理展示层返回值，不修改接口请求参数和底层返回结构。
- 源码静态文案已由你提前排查，本次只补动态接口返回文案的兜底替换。

## v0.6.0 时间轴

### 2026-05-22 14:44:13

已完成：

- 首页新增 `movie` 影视模块入口，保留 `material` 与 `wallpaper` 模块入口并行展示。
- 新增 `src/config/movie.js`，集中维护 TMDB 接口基础地址、Bearer Token、默认语言、常用搜索类型、排序项和快捷关键词。
- 新增 `src/services/movie-api.js`，封装 TMDB 首页热门、电影分类、影视搜索、详情和推荐内容接口，并统一将 `language` 设置为 `zh-CN`。
- 新增 `pages/movie/index`、`pages/movie/discover`、`pages/movie/search`、`pages/movie/detail` 四个页面，完成影视首页、分类浏览、关键词搜索、详情推荐的完整流程。
- 更新 `src/pages.json` 注册影视模块页面路由。
- 更新 `src/pages/profile/index.vue`，补充 TMDB 相关域名配置说明。

已确认决策：

- 当前 `movie` 模块采用纯前端直连 TMDB 的方式实现，优先满足演示与功能验证需求。
- 认证统一使用 Bearer Token，请求层默认走 `zh-CN` 返回文案。
- `accountId` 和 `apiKey` 先保留在配置中作为扩展预留，本次不接入收藏、评分、账户态接口。
- 搜索页保留电影、剧集、综合三种模式，综合搜索结果只展示 `movie` 与 `tv` 两类条目，保证页面信息结构稳定。

## v0.6.3 时间轴

### 2026-05-22 14:53:10

已完成：

- 为 `movie` 模块新增 `authMode` 配置，支持在 `bearer` 和 `apiKey` 两种认证方式之间切换。
- 更新 TMDB 请求层，根据 `authMode` 自动拼接 `Authorization` 请求头或 `api_key` 查询参数。
- 为影视首页、分类页、搜索页、详情页统一接入更明确的失败提示，区分网络失败、认证失败和接口业务失败三类场景。

已确认决策：

- 当前继续保留纯前端直连 TMDB 的实现方式，优先用认证方式切换帮助排查链路问题。
- 本次不修改页面交互结构，只补齐请求层诊断能力和配置说明，避免引入额外变量。

## v0.6.6 时间轴

### 2026-05-22 15:07:03

已完成：

- 优化 `movie` 首页首屏结构，压缩说明文案，补充简洁能力标签，并增加页面内错误提示与重新加载入口。
- 重构 `movie` 分类页筛选区，为分类、排序、年份增加分组标题，补充结果摘要与页内错误兜底。
- 优化 `movie` 搜索页空状态与无结果状态，补充页内错误提示和重新搜索入口。
- 优化 `movie` 详情页信息层次，增加评分、日期、语言信息条，补充页内错误提示，并强化推荐卡片信息展示。

已确认决策：

- 本次继续保持现有 TMDB 接口能力不变，重点收口页面结构、空状态和异常反馈。
- 鉴于 TMDB 访问依赖代理，所有核心页面统一补充页内错误提示，避免只依赖 toast 导致信息丢失。

## v0.7.0 时间轴

### 2026-05-22 17:50:00

已完成：

- 新增 `tv` 模块配置与服务层，封装 TVmaze 首页日程、剧名搜索、演员搜索、精确搜索、剧集详情、季集结构和演员资料接口。
- 首页新增 `今日追剧` 入口，入口风格与现有模块保持统一，并补充独立配色。
- 新增 `pages/tv/index`、`pages/tv/search`、`pages/tv/show-detail`、`pages/tv/season`、`pages/tv/person-detail` 五个页面，完成今日更新、流媒体更新、高评分推荐、类型入口、搜索、剧集详情、演员详情与季集结构闭环。
- 搜索页增加本地搜索历史、热词入口、类型浏览联动和空状态兜底。
- 更新 `src/pages.json` 和 `src/pages/profile/index.vue`，补充 TVmaze 路由与域名配置说明。

已确认决策：

- `tv` 模块独立于 `movie` 模块，专注剧集信息浏览，不引入电影数据模型。
- 第一阶段只落地剧集核心浏览链路，暂不接入收藏、提醒、设置和外部 ID 查找。
- TVmaze 公共读接口按公开 REST API 直接接入，配置中的 API Key 先作为后续扩展预留。

## v0.7.1 时间轴

### 2026-05-22 18:12:54

已完成：

- 修正 `tv` 首页日程数据映射，兼容 `item.show` 与 `item._embedded.show` 两种返回结构。
- 修复 `流媒体更新` 点击无效问题，确保列表项能正确拿到 `showId` 并跳转详情页。
- 重构 `流媒体更新` 和 `明日预告` 展示结构，减少长标题挤压和单集标题错位问题。
- 新增首页地区切换，支持 `海外 US` 与 `国内 CN` 两档筛选，切换后刷新今日更新、流媒体更新与明日预告。

已确认决策：

- 首页地区默认保持 `海外 US`，沿用 TVmaze 默认数据范围，优先保证首屏内容完整度。
- `国内 CN` 作为辅助筛选提供，不强制作为默认值，避免首页内容稀疏影响观感。

## v0.7.3 时间轴

### 2026-05-22 18:25:43

已完成：

- 将 `tv` 首页默认地区改为 `国内 CN`，并同步调整地区选项顺序。
- 为 `明日预告` 增加封面图展示，缺图时使用占位卡片，避免列表只剩文本信息。
- 为 `tv/search` 页面新增 `国内 / 海外` 地区筛选，并支持从 `今日追剧` 首页带入初始地区状态。
- 修正 `tv` 模块地区联动逻辑，搜索结果、类型浏览和高评分推荐都会按当前地区进行本地过滤或重组。

已确认决策：

- 搜索页地区筛选与首页保持同一套 `CN / US` 规则，优先保证前后状态一致。
- `高评分推荐` 不再固定使用全局 `/shows?page=0` 结果，在 `CN` 模式下会优先从当日更新、流媒体更新和明日预告中提取可评分剧集，保证地区语义一致。

## v0.7.8 时间轴

### 2026-05-22 18:42:35

已完成：

- 新增 `src/utils/tv-i18n.js`，集中维护 TVmaze 稳定枚举字段的中文映射表。
- 在 `tv` 服务层接入 `type`、`status`、`genres`、`language`、`countryCode`、`platformType` 等字段的中文转换。
- 将季标题从 `Season N` 调整为 `第 N 季`，统一剧集模块展示语言。

已确认决策：

- 本次只处理稳定、可枚举字段，不对剧名、简介、演员名、单集标题等自由文本做本地翻译。
- 中文映射统一放在服务层处理，页面层保持只消费标准化后的展示字段，方便后续继续扩充映射表。

## v0.7.10 时间轴

### 2026-05-22 18:52:22

已完成：

- 将 TV 中文映射函数从独立的 `src/utils/tv-i18n.js` 并回 `src/utils/display-text.js`。
- 更新 `src/services/tv-api.js` 的引用链，改为统一从现有公共工具文件导入映射方法。
- 删除 `src/utils/tv-i18n.js`，消除微信小程序运行时对该模块的加载失败问题。

已确认决策：

- 当前优先保证小程序运行链路稳定，避免继续新增新的工具模块入口。
- TV 文案映射暂时继续和现有展示文本工具共存，等功能稳定后再考虑拆分整理。
