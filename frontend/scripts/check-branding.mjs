import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

// Render both admin states without logging in or touching browser storage/API data.
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
let signedIn = false
Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: new URL('http://demo.localhost/admin') } })
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (key) => signedIn && key.endsWith(':admin_token') ? 'offline-render-test' : null },
})

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: AdminApp } = await server.ssrLoadModule('/src/AdminApp.jsx')
  const { TriunfoLogo, TriunfoMark } = await server.ssrLoadModule('/src/TriunfoBrand.jsx')
  const logo = renderToStaticMarkup(createElement(TriunfoLogo))
  const mark = renderToStaticMarkup(createElement(TriunfoMark))
  assert.match(logo, /triunfo-menu-logo\.png/)
  assert.match(logo, /aria-label="Triunfo Menu"/)
  assert.match(mark, /triunfo-mark\.svg/)

  const login = renderToStaticMarkup(createElement(AdminApp))
  assert.match(login, /class="admin-login platform-login"/)
  assert.match(login, /triunfo-menu-logo\.png/)
  assert.match(login, /autoComplete="current-password"/)
  assert.match(login, /type="password"/)
  assert.match(login, /Mostrar senha/)

  signedIn = true
  const panel = renderToStaticMarkup(createElement(AdminApp))
  assert.match(panel, /class="admin-shell"/)
  assert.match(panel, /class="admin-platform-brand"/)
  assert.match(panel, /triunfo-menu-logo\.png/)
  assert.match(panel, /Loja atual/)
  assert.doesNotMatch(panel, /class="admin-login/)

  const [favicon, officialMark, html] = await Promise.all([
    readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8'),
    readFile(new URL('../public/triunfo-mark.svg', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
  ])
  assert.equal(favicon.trim(), officialMark.trim())
  assert.match(html, /rel="icon"[^>]+href="\/triunfo-mark\.svg"/)
  console.log('Branding checks passed: official logo, favicon, login and authenticated admin shell.')
} finally {
  await server.close()
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
  else delete globalThis.window
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
  else delete globalThis.localStorage
}
