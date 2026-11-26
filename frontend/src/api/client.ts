/**
 * Thin API client.
 *
 * The dev server proxies /api to the local backend, so the default base is a
 * same-origin path and the httpOnly session cookie travels with every request.
 * A deployed frontend can point at another origin with VITE_API_URL (the API
 * then needs to allow that origin).
 */

import type { Role } from '../types'
import type { SessionDto } from './types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 12_000,
  )

  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      signal: controller.signal,
    })

    const text = await response.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
    }

    if (!response.ok) {
      const error = (payload as { error?: { code?: string; message?: string } } | null)?.error
      throw new ApiError(
        response.status,
        error?.code ?? 'request_failed',
        error?.message ?? `The campus API returned ${response.status}.`,
      )
    }

    return payload as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'timeout', 'The campus API did not respond in time.')
    }
    throw new ApiError(0, 'network_error', 'The campus API is unreachable.')
  } finally {
    window.clearTimeout(timeout)
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

export function getSession(): Promise<SessionDto> {
  return api<SessionDto>('/auth/session')
}

export function previewLogin(role: Role, usn?: string): Promise<SessionDto> {
  return api<SessionDto>('/auth/preview-login', {
    method: 'POST',
    body: usn ? { role, usn } : { role },
  })
}

export function endSession(): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>('/auth/logout', { method: 'POST' })
}
