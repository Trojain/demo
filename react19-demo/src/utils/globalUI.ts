/**
 * 全局 UI 模块：突破 Hooks 限制，在任意 TS 文件中使用 message、modal、navigate
 * 由 GlobalLayout 初始化注入
 */

/** 全局实例，默认降级到控制台 */
export const globalUI = {
  message: {
    error: (msg: string) => console.error(msg),
    warning: console.warn,
    success: console.log,
    info: console.info,
    loading: console.log,
  } as any,
  modal: {
    warning: console.warn,
    confirm: console.warn,
    info: console.info,
    error: console.error,
  } as any,
  navigate: (path: string) => {
    console.warn('Navigate not initialized, fallback to location.href')
    window.location.href = path
  },
}

/**
 * 注入 UI 实例（由 GlobalLayout 调用）
 */
export const setGlobalUI = (message: any, modal: any, navigate: any) => {
  globalUI.message = message // 注入 Antd message
  globalUI.modal = modal // 注入 Antd modal
  globalUI.navigate = navigate // 注入 Router navigate
}
