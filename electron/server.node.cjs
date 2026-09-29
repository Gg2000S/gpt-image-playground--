const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { resolveStaticPath, normalizeProxyPath, createDesktopServer } = require('./server.cjs')

test('normalizes proxy paths without duplicating the prefix', () => {
  assert.equal(normalizeProxyPath('/api-proxy/models?x=1'), '/models?x=1')
  assert.equal(normalizeProxyPath('/api-proxy/images/generations'), '/images/generations')
})

test('keeps static paths inside the dist directory', () => {
  const root = path.join(os.tmpdir(), 'gpt-image-desktop-test')
  assert.equal(resolveStaticPath(root, '/index.html'), path.join(root, 'index.html'))
  assert.equal(resolveStaticPath(root, '/../secret.txt'), null)
  assert.equal(resolveStaticPath(root, '/%2e%2e/%2e%2e/secret.txt'), null)
})

test('serves static files and returns 404 for unknown assets', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-image-dist-'))
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>test</title>')
  const server = createDesktopServer({ distDir: root, upstreamBaseUrl: 'https://example.com/v1' })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const response = await fetch(`http://127.0.0.1:${port}/`)
  assert.equal(response.status, 200)
  assert.match(await response.text(), /<title>test<\/title>/)
  const missing = await fetch(`http://127.0.0.1:${port}/missing.js`)
  assert.equal(missing.status, 404)
  await new Promise((resolve) => server.close(resolve))
})
