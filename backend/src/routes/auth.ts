import type { FastifyInstance } from 'fastify'

import { config } from '../config.js'
import { query } from '../db.js'
import { createSession, revokeSession, SESSION_COOKIE } from '../plugins/auth.js'
import { badRequest, notFound } from '../plugins/errors.js'
import type { AuthUser, Role } from '../types/fastify.js'

const PERMISSIONS: Record<Role, string[]> = {
  student: [
    'card:read',
    'pass:create',
    'attendance:read',
    'library:read',
    'exams:read',
    'fees:read',
  ],
  faculty: [
    'cohort:read',
    'student:read',
    'risk:read',
    'intervention:write',
    'session:read',
    'session:write',
    'verification:read',
    'insights:read',
  ],
  admin: [
    'cohort:read',
    'student:read',
    'risk:read',
    'intervention:write',
    'session:read',
    'session:write',
    'verification:read',
    'insights:read',
    'card:update',
    'overview:read',
    'user:read',
  ],
}

export function permissionsFor(role: Role): string[] {
  return PERMISSIONS[role] ?? []
}

export function publicUser(user: AuthUser) {
  return {
    usn: user.externalId,
    name: user.fullName,
    email: user.email,
    role: user.role,
    programme: user.programme,
    semester: user.semester,
    section: user.section,
  }
}

interface PreviewLoginBody {
  role?: Role
  usn?: string
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Preview sign-in. This replaces the browser role switcher with a real
   * server session so that route guards are enforced by the API. It is a demo
   * affordance and must be disabled (PREVIEW_AUTH=false) once SSO lands.
   */
  app.post<{ Body: PreviewLoginBody }>('/auth/preview-login', async (request, reply) => {
    if (!config.previewAuth) {
      throw notFound('Preview sign-in is disabled on this deployment.', 'preview_disabled')
    }
    const role = request.body?.role
    if (!role || !['admin', 'faculty', 'student'].includes(role)) {
      throw badRequest('role must be one of admin, faculty or student.')
    }
    const usn = request.body?.usn?.trim()

    const result = usn
      ? await query<{
          id: string
          external_id: string
          full_name: string
          email: string | null
          role: Role
          programme: string | null
          semester: string | null
          section: string | null
          mentor_id: string | null
        }>(
          `SELECT id, external_id, full_name, email, role, programme, semester, section, mentor_id
             FROM app_users WHERE external_id = $1 AND role = $2 AND active = true`,
          [usn, role],
        )
      : await query<{
          id: string
          external_id: string
          full_name: string
          email: string | null
          role: Role
          programme: string | null
          semester: string | null
          section: string | null
          mentor_id: string | null
        }>(
          `SELECT id, external_id, full_name, email, role, programme, semester, section, mentor_id
             FROM app_users WHERE role = $1 AND active = true ORDER BY created_at LIMIT 1`,
          [role],
        )

    const row = result.rows[0]
    if (!row) {
      throw notFound('No preview account matches that request.', 'preview_account_missing')
    }

    const token = await createSession(row.id, request.headers['user-agent'])
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
      maxAge: config.sessionTtlHours * 60 * 60,
    })

    return {
      user: {
        usn: row.external_id,
        name: row.full_name,
        email: row.email,
        role: row.role,
        programme: row.programme,
        semester: row.semester,
        section: row.section,
      },
      permissions: permissionsFor(row.role),
    }
  })

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (token) await revokeSession(token)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  })

  app.get('/auth/session', { preHandler: app.authenticate }, async (request) => {
    const user = request.user as AuthUser
    return { user: publicUser(user), permissions: permissionsFor(user.role) }
  })
}
