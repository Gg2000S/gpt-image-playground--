import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const required = ['dist/index.html', 'electron/main.cjs', 'electron/server.cjs']
for (const file of required) {
  if (!existsSync(file)) throw new Error(`缺少桌面构建文件：${file}`)
}

const secret = process.env.GPT_IMAGE_PLAYGROUND_API_KEY?.trim()
if (secret) {
  const files = ['dist/index.html', 'dist/assets']
  const collect = (file) => {
    if (!existsSync(file)) return ''
    if (statSync(file).isDirectory()) return readdirSync(file).map((name) => collect(join(file, name))).join('\n')
    return readFileSync(file, 'utf8')
  }
  const contents = files.map(collect).join('\n')
  if (contents.includes(secret)) throw new Error('构建产物包含 API Key')
}

console.log(`桌面构建检查通过：${join(process.cwd(), 'dist')}`)
