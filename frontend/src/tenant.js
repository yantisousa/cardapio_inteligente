const localHosts = new Set(['localhost', '127.0.0.1', '::1'])
const storageKey = 'triunfo_active_tenant_host'
const hostPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

function validHost(value) {
  const host = String(value || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  return hostPattern.test(host) ? host : ''
}

function resolveTenantHost() {
  const browserHost = validHost(window.location.hostname)
  if (!localHosts.has(browserHost)) return browserHost

  const requested = validHost(new URLSearchParams(window.location.search).get('tenant'))
  if (requested) {
    localStorage.setItem(storageKey, requested)
    return requested
  }

  return validHost(localStorage.getItem(storageKey))
    || validHost(import.meta.env.VITE_TENANT_HOST)
    || 'demo.localhost'
}

export const tenantHost = resolveTenantHost()
export const tenantHeaders = localHosts.has(validHost(window.location.hostname))
  ? { 'X-Tenant-Host': tenantHost }
  : {}

export const tenantStorageKey = (name) => `triunfo:${tenantHost}:${name}`

export function tenantUrl(path) {
  if (!localHosts.has(validHost(window.location.hostname))) return path
  const url = new URL(path, window.location.origin)
  url.searchParams.set('tenant', tenantHost)
  return `${url.pathname}${url.search}${url.hash}`
}
