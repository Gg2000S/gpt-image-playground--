# GPT Image Playground Electron Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Package GPT Image Playground as a Windows standalone Electron application with an internal same-origin API proxy to a user-provided OpenAI-compatible upstream.

**Architecture:** Vite builds the existing React UI into `dist`. Electron's main process starts a loopback-only HTTP server that serves `dist` and forwards `/api-proxy/*` requests to the configured upstream. A hardened `BrowserWindow` loads that local server, so the user interacts with an app window rather than a system browser.

**Tech Stack:** React 19, Vite, TypeScript, Electron, Node `http`/`https`, electron-builder, Vitest.

---

### Task 1: Add the desktop runtime and proxy server

**Files:**
- Create: `electron/main.cjs`
- Create: `electron/server.cjs`
- Create: `electron/server.node.cjs`

- [ ] **Step 1: Write proxy/server tests**

Test the server's path normalization and safe static path resolution without opening a real Electron window. The tests must cover `/api-proxy/models` mapping to `/v1/models`, traversal attempts staying inside `dist`, and an unknown asset returning 404.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run `node --test electron/server.node.cjs`.
Expected: FAIL because the server module does not exist.

- [ ] **Step 3: Implement `electron/server.cjs`**

Export `createDesktopServer({ distDir, upstreamBaseUrl })` and `startDesktopServer(options)`. Bind only to `127.0.0.1` on port `0`. Serve `index.html` for `/` and existing assets from `distDir`. For `/api-proxy/*`, remove the prefix and forward the request to the upstream URL while preserving method, body, authorization, content type, and streaming response. Add readable JSON errors for upstream connection failures and return CORS headers for the local app origin.

- [ ] **Step 4: Implement `electron/main.cjs`**

Create a hardened `BrowserWindow` with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`. Start the local server using `process.resourcesPath/dist` in packaged mode and the repository `dist` in development mode. Load the returned loopback URL and close the server on `window-all-closed`/`before-quit`.

- [ ] **Step 5: Run the focused tests and verify they pass**

Run `node --test electron/server.node.cjs`.
Expected: PASS for all server tests.

### Task 2: Add Electron packaging scripts and metadata

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `electron-builder.yml`
- Modify: `.gitignore`

- [ ] **Step 1: Add build scripts and package metadata**

Add `electron`, `electron-builder`, and `concurrently` as dev dependencies. Add scripts:

```json
"desktop:dev": "npm run build && electron .",
"desktop:dist": "npm run build && electron-builder --win portable nsis"
```

Set `main` to `electron/main.cjs` and add an `build` section that includes `dist`, `electron`, `public`, and the production package metadata while excluding tests, local config files, and API keys.

- [ ] **Step 2: Add packaging configuration**

Configure an app id, product name `GPT Image Playground`, Windows portable and NSIS targets, `dist/electron-dist` as output, and `asar: true`. Do not include `.env.local`, `dev-proxy.config.json`, or `gpt-image-config.local.json` in the packaged app.

- [ ] **Step 3: Add generated-output ignores**

Ignore `release/`, `electron-dist/`, and Electron unpacked output while leaving source configuration files tracked.

- [ ] **Step 4: Install dependencies and verify metadata**

Run `npm install`, then `npm run build`. Expected: existing Vite build passes and Electron dependencies are present in `node_modules`.

### Task 3: Make packaged defaults use the internal proxy

**Files:**
- Modify: `electron/main.cjs`
- Modify: `src/lib/apiProfiles.ts` only if the existing runtime config requires a desktop-specific default
- Create: `electron/desktop-config.json`

- [ ] **Step 1: Define the runtime desktop upstream**

Keep the upstream URL in ignored `electron/desktop-config.json`; commit only `electron/desktop-config.example.json`. The renderer's configured API base URL must be the local server's `/api-proxy` path when the app is packaged.

- [ ] **Step 2: Verify no secret is bundled**

Run a text search over the release staging directory for the supplied API key and fail the packaging step if it is found.

- [ ] **Step 3: Run the UI build and inspect generated assets**

Run `npm run build`; confirm `dist/index.html` and all referenced assets exist.

### Task 4: Regression-test the desktop workflow

**Files:**
- Modify: `electron/server.node.cjs`
- Create: `scripts/check-desktop-build.mjs`

- [ ] **Step 1: Add a build smoke check**

The script must verify that `dist/index.html`, `electron/main.cjs`, and `electron/server.cjs` exist and that no configured API key is present in build output.

- [ ] **Step 2: Run the full existing test suite**

Run `npm test`. Expected: all existing Vitest tests pass.

- [ ] **Step 3: Run the desktop build smoke check**

Run `node scripts/check-desktop-build.mjs`. Expected: PASS.

### Task 5: Build and clean desktop deliverables

**Files:**
- Delete: `GPT-Image-Playground.cmd`
- Delete: `GPT Image Playground.lnk`
- Delete: any obsolete standalone proxy/test folders created during diagnosis
- Keep: `gpt-image_playground/docs/superpowers/specs/2026-09-30-electron-desktop-app-design.md`

- [ ] **Step 1: Remove obsolete browser launcher files**

Delete only the two desktop launcher files and any known temporary proxy artifacts; do not remove the source project, its formal dev proxy config, or user-created configuration.

- [ ] **Step 2: Build Windows artifacts**

Run `npm run desktop:dist`. Expected: a portable `.exe` and an NSIS installer under `release/`.

- [ ] **Step 3: Verify the portable app**

Launch the generated portable `.exe`, confirm a standalone window appears without opening a browser, verify the local page loads, then close it and confirm its loopback port is released.

- [ ] **Step 4: Report exact artifacts and residual limitations**

Provide the generated `.exe` paths, test results, and note that the API key must be entered by the user and is not embedded.
