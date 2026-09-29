import { spawnSync } from 'node:child_process'

process.env.VITE_API_PROXY_AVAILABLE = 'true'
process.env.VITE_API_PROXY_LOCKED = 'true'

const command = process.platform === 'win32' ? 'cmd.exe' : 'npm'
const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run build'] : ['run', 'build']
const result = spawnSync(command, args, { stdio: 'inherit', windowsVerbatimArguments: false })
if (result.error) throw result.error
process.exit(result.status ?? 1)
