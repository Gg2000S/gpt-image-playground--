# GPT Image Playground Windows 桌面应用设计

## 目标

将现有 React/Vite 网页应用封装为可在 Windows 上双击启动的独立 Electron 软件。用户无需打开系统浏览器，也无需预装 Node.js；软件窗口直接显示 GPT Image Playground，并能通过用户配置的 OpenAI 兼容接口生图。

## 方案

- 使用 Electron 主进程创建独立窗口，关闭 `nodeIntegration`，开启 `contextIsolation`。
- 使用 Electron 内置 Node.js 启动本机 HTTP 服务：同一服务提供构建后的 `dist` 静态文件和 `/api-proxy/*` 上游转发。
- 窗口加载本机 HTTP 地址，而不是 `file://` 或公网网页。这样页面与本地代理同源，避免浏览器 CORS 和 Local Network Access 限制。
- 代理只转发用户在页面设置中填写的请求认证信息，不在源码、构建产物或安装包内保存 API Key。
- 上游地址来自被忽略的桌面版运行时配置；仓库只提供占位模板，不提交任何个人中转站地址。

## 运行与打包

开发阶段保留现有 Vite 开发服务器和本地代理配置。

发布阶段执行 Vite production build，再由 Electron Builder 生成 Windows 安装包和可直接运行的便携式 `.exe`。桌面启动入口使用便携式版本，避免强制安装流程；安装包作为备用产物保留。

## 代理行为

- 本地服务监听 `127.0.0.1` 的随机可用端口，避免占用固定端口或与其他软件冲突。
- `/api-proxy/*` 去掉本地前缀后转发到上游 `/v1/*`。
- 保留请求方法、请求体、主要请求头和流式响应；移除不应转发的本地连接头。
- 对上游连接失败、超时和非 JSON 错误返回可读的 HTTP 错误，前端继续使用现有错误提示。
- 服务只绑定回环地址，不接受局域网访问。

## 安全边界

- Electron 渲染进程不获得 Node.js 访问权限。
- 不使用远程代码、远程页面或不受信任的 preload API。
- API Key 由现有前端存储机制管理；桌面打包不预置密钥。
- 退出应用时关闭本地 HTTP 服务。

## 验收标准

1. 双击便携式 `.exe` 后出现独立应用窗口，不打开 Edge、Chrome 或其他系统浏览器。
2. 窗口能够加载 GPT Image Playground 主界面和本地默认配置。
3. 在设置中输入 API Key 后，`/models` 请求可通过本地代理到达用户配置的上游。
4. 文字生图和图片编辑请求均能通过本地代理发送；失败时显示明确错误。
5. 关闭窗口后本地监听端口释放，重复启动不会产生端口冲突。
6. `npm run build`、现有 Vitest 测试和 Electron 打包命令全部通过。

## 不在本次范围

- 自动更新服务。
- macOS 或 Linux 安装包。
- 将 API Key 写入 Windows 注册表、环境变量或安装包。
- 改造现有网页 UI 或 API 配置模型。
