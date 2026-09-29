import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'electron-dist', 'win-unpacked')
const appDir = join(root, 'resources', 'app')

if (!root || !appDir.endsWith(join('resources', 'app'))) throw new Error('桌面 staging 路径无效')
rmSync(appDir, { recursive: true, force: true })
mkdirSync(appDir, { recursive: true })
cpSync('dist', join(appDir, 'dist'), { recursive: true })
cpSync('electron', join(appDir, 'electron'), { recursive: true })
cpSync('package.json', join(appDir, 'package.json'))
console.log(`桌面应用资源已整理到 ${appDir}`)
