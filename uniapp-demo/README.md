# uniapp-demo

兼容微信、支付宝、抖音小程序的 uni-app JavaScript 项目。

## 技术栈

- uni-app `3.0.0-5000720260410001`
- Vue `3.4.x`
- Vite `5.2.8`
- pnpm `11.1.3`
- Node.js `24 LTS`

## 运行命令

```bash
pnpm install
pnpm dev:mp-weixin
pnpm dev:mp-alipay
pnpm dev:mp-toutiao
```

编译产物会输出到 `dist/dev/mp-weixin`、`dist/dev/mp-alipay`、`dist/dev/mp-toutiao`，再分别用对应平台开发者工具打开。

## 平台配置

小程序 appid 在 `src/manifest.json` 中配置：

- 微信小程序：`mp-weixin.appid`
- 支付宝小程序：`mp-alipay.appid`
- 抖音小程序：`mp-toutiao.appid`

当前保留空值，便于后续按真实账号接入。

## Pixabay 素材配置

图片接口配置在 `src/config/pixabay.js`。

```js
export const PIXABAY_API_CONFIG = {
  baseUrl: 'https://pixabay.com/api/',
  apiKey: '你的 Pixabay API key',
  defaultPageSize: 20,
  maxPageSize: 50
}
```

三端小程序发布前，需要在平台后台配置合法域名：

- `https://pixabay.com`
- `https://cdn.pixabay.com`

保存图片素材流程为：`uni.downloadFile` 下载图片到本地临时文件，再通过 `uni.saveImageToPhotosAlbum` 保存到系统相册。
