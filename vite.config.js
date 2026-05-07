import { defineConfig, loadEnv } from 'vite'

function listFromEnv(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function numberFromEnv(value, fallback) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = listFromEnv(env.VITE_ALLOWED_HOSTS)
  const serverHost = env.VITE_DEV_HOST || '0.0.0.0'
  const serverPort = numberFromEnv(env.VITE_DEV_PORT, 46758)
  const previewHost = env.VITE_PREVIEW_HOST || serverHost
  const previewPort = numberFromEnv(env.VITE_PREVIEW_PORT, 4173)

  return {
    server: {
      host: serverHost,
      port: serverPort,
      allowedHosts: allowedHosts.length ? allowedHosts : ['rtxa.duckdns.org']
    },
    preview: {
      host: previewHost,
      port: previewPort,
      allowedHosts: allowedHosts.length ? allowedHosts : ['rtxa.duckdns.org']
    }
  }
})
