import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Minimal .env loader. The backend has no runtime dependency on dotenv; the
 * file is optional and never overrides a variable that is already set.
 */
function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name]
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgres://eidx_app:eidx_app_pw@localhost:5433/eidx'),
  databaseAdminUrl: required(
    'DATABASE_ADMIN_URL',
    'postgres://eidx_owner:eidx_owner_pw@localhost:5433/eidx',
  ),
  sessionSecret: required('SESSION_SECRET', 'dev-session-secret-change-me'),
  passSecret: required('PASS_SECRET', 'dev-pass-secret-change-me'),
  readerApiKey: required('READER_API_KEY', 'dev-reader-key-change-me'),
  cookieSecure: bool('COOKIE_SECURE', false),
  previewAuth: bool('PREVIEW_AUTH', true),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
  passTtlSeconds: Number(process.env.PASS_TTL_SECONDS ?? 120),
} as const

export const isProduction = config.nodeEnv === 'production'
