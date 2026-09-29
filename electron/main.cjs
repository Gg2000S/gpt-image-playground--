const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, dialog } = require('electron')
const { startDesktopServer } = require('./server.cjs')

let desktopServer

function readUpstreamBaseUrl() {
  const candidates = [
    path.join(app.getPath('userData'), 'desktop-config.json'),
    path.join(process.resourcesPath, 'desktop-config.json'),
    path.join(__dirname, 'desktop-config.json'),
  ]
  for (const file of candidates) {
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8')).upstreamBaseUrl
      if (typeof value !== 'string' || !value.trim()) continue
      const url = new URL(value.trim())
      if (!['http:', 'https:'].includes(url.protocol)) continue
      return value.trim().replace(/\/+$/, '')
    } catch {
      continue
    }
  }
  throw new Error('未配置中转站地址。请在应用数据目录中创建 desktop-config.json，并填写 upstreamBaseUrl。')
}

async function createWindow() {
  const distDir = path.join(__dirname, '..', 'dist')
  const started = await startDesktopServer({ distDir, upstreamBaseUrl: readUpstreamBaseUrl() })
  desktopServer = started.server

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.on('closed', () => {
    if (desktopServer) {
      desktopServer.close()
      desktopServer = undefined
    }
  })
  await window.loadURL(started.url)
}

app.whenReady().then(createWindow).catch((error) => {
  console.error('无法启动 GPT Image Playground：', error)
  dialog.showErrorBox('GPT Image Playground 启动失败', error instanceof Error ? error.message : String(error))
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (desktopServer) {
    desktopServer.close()
    desktopServer = undefined
  }
})
