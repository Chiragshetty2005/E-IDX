import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { config } from '../config.js'
import { query } from '../db.js'
import { forbidden, unauthorized } from './errors.js'
import type { AuthUser, Role } from '../types/fastify.js'

export const SESSION_COOKIE = 'eidx_session'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000)
  await query(
    `INSERT INTO auth_sessions (user_id, token_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hashToken(token), userAgent ?? null, expiresAt],
  )
  return token
}

export async function revokeSession(token: string): Promise<void> {
  await query(
    `UPDATE auth_sessions SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(token)],
  )
}

interface SessionRow {
  id: string
  external_id: string
  full_name: string
  email: string | null
  role: Role
  programme: string | null
  semester: string | null
  section: string | null
  mentor_id: string | null
}

export async function resolveSession(token: string): Promise<AuthUser | null> {
  const result = await query<SessionRow>(
    `SELECT u.id, u.external_id, u.full_name, u.email, u.role,
            u.programme, u.semester, u.section, u.mentor_id
       FROM auth_sessions s
       JOIN app_users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.active = true`,
    [hashToken(token)],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    externalId: row.external_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    programme: row.programme,
    semester: row.semester,
    section: row.section,
    mentorId: row.mentor_id,
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.decorateRequest('user', null)

  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (!token) {
      throw unauthorized('Sign in to continue.', 'session_missing')
    }
    const user = await resolveSession(token)
    if (!user) {
      throw unauthorized('Your session has expired.', 'session_expired')
    }
    request.user = user
  })

  app.decorate('requireRole', (roles: Role[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await app.authenticate(request, reply)
      const user = request.user
      if (!user || !roles.includes(user.role)) {
        throw forbidden('Your role cannot access this resource.', 'role_not_allowed')
      }
    }
  })
}

/**
 * Reader devices authenticate with a shared device credential rather than a
 * user session. Browser traffic never receives this key.
 */
export function requireReaderKey(request: FastifyRequest): void {
  const header = request.headers['x-reader-key']
  const provided = typeof header === 'string' ? header : ''
  if (!provided || !safeEqual(hashSecret(provided), hashSecret(config.readerApiKey))) {
    throw unauthorized('Reader authentication failed.', 'reader_auth_failed')
  }
}
