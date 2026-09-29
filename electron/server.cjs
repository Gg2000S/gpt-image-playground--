const http = require('node:http')
const https = require('node:https')
const fs = require('node:fs')
const path = require('node:path')
const { pipeline } = require('node:stream')

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function normalizeProxyPath(urlPath) {
  const value = urlPath.startsWith('/api-proxy')
    ? urlPath.slice('/api-proxy'.length)
    : urlPath
  return value.startsWith('/') ? value : `/${value}`
}

function resolveStaticPath(distDir, requestPath) {
  let pathname
  try {
    pathname = decodeURIComponent(requestPath.split('?')[0] || '/')
  } catch {
    return null
  }

  const root = path.resolve(distDir)
  const requested = path.resolve(root, `.${pathname}`)
  if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) return null
  return requested
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    'access-control-allow-headers': 'Authorization, Content-Type, X-Api-Key, X-Goog-Api-Key',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-origin': '*',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

function getUpstreamHeaders(headers) {
  const forwarded = {}
  for (const [key, value] of Object.entries(headers)) {
    if (['connection', 'host', 'origin', 'referer', 'transfer-encoding'].includes(key.toLowerCase())) continue
    forwarded[key] = value
  }
  return forwarded
}

function proxyRequest(request, response, upstreamBaseUrl) {
  const upstreamUrl = new URL(normalizeProxyPath(request.url || '/'), upstreamBaseUrl.endsWith('/') ? upstreamBaseUrl : `${upstreamBaseUrl}/`)
  const transport = upstreamUrl.protocol === 'http:' ? http : https
  const upstreamRequest = transport.request(upstreamUrl, {
    method: request.method,
    headers: {
      ...getUpstreamHeaders(request.headers),
      host: upstreamUrl.host,
    },
  }, (upstreamResponse) => {
    const headers = { ...upstreamResponse.headers }
    delete headers.connection
    headers['access-control-allow-origin'] = '*'
    headers['access-control-allow-headers'] = 'Authorization, Content-Type, X-Api-Key, X-Goog-Api-Key'
    headers['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    response.writeHead(upstreamResponse.statusCode || 502, headers)
    pipeline(upstreamResponse, response, () => {})
  })

  upstreamRequest.on('error', (error) => {
    if (response.headersSent) {
      response.destroy(error)
      return
    }
    sendJson(response, 502, {
      code: 'DESKTOP_PROXY_ERROR',
      message: `无法连接上游 API：${error.message}`,
    })
  })

  pipeline(request, upstreamRequest, (error) => {
    if (error && !response.headersSent) upstreamRequest.destroy(error)
  })
}

function serveStatic(request, response, distDir) {
  const filePath = resolveStaticPath(distDir, request.url || '/')
  if (!filePath) {
    sendJson(response, 400, { code: 'INVALID_PATH', message: '请求路径无效' })
    return
  }

  let target = filePath
  try {
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html')
    if (!fs.existsSync(target)) {
      const pathname = (request.url || '/').split('?')[0]
      if (!path.extname(pathname)) target = path.join(distDir, 'index.html')
    }
    const stat = fs.statSync(target)
    if (!stat.isFile()) throw new Error('not a file')
    const contentType = MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream'
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': contentType,
      'content-length': stat.size,
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    pipeline(fs.createReadStream(target), response, () => {})
  } catch {
    sendJson(response, 404, { code: 'NOT_FOUND', message: '资源不存在' })
  }
}

function createDesktopServer({ distDir, upstreamBaseUrl, requestUpstream = proxyRequest }) {
  return http.createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-headers': 'Authorization, Content-Type, X-Api-Key, X-Goog-Api-Key',
        'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'access-control-allow-origin': '*',
      })
      response.end()
      return
    }

    if ((request.url || '').startsWith('/api-proxy/')) {
      requestUpstream(request, response, upstreamBaseUrl)
      return
    }

    serveStatic(request, response, distDir)
  })
}

function startDesktopServer(options) {
  const server = createDesktopServer(options)
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      const address = server.address()
      resolve({ server, port: address.port, url: `http://127.0.0.1:${address.port}/` })
    })
  })
}

module.exports = {
  createDesktopServer,
  normalizeProxyPath,
  resolveStaticPath,
  startDesktopServer,
}
