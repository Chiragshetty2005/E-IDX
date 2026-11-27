import type { FastifyInstance } from 'fastify'

import { query } from '../db.js'
import { verifyPass } from '../lib/pass.js'
import { badRequest } from '../plugins/errors.js'

interface VerificationQuery {
  result?: string
  method?: string
  q?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

interface VerifyBody {
  token?: string
  method?: string
  readerId?: string
  location?: string
}

export async function verificationRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: VerificationQuery }>(
    '/verifications',
    { preHandler: app.requireRole(['admin', 'faculty']) },
    async (request) => {
      const result = request.query.result ?? ''
      const method = request.query.method ?? ''
      const search = (request.query.q ?? '').trim()
      const from = request.query.from ?? ''
      const to = request.query.to ?? ''
      const page = Math.max(1, Number(request.query.page ?? 1))
      const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 25)))
      const offset = (page - 1) * limit

      const where = `
        WHERE ($1 = '' OR v.result = $1)
          AND ($2 = '' OR v.method = $2)
          AND ($3 = '' OR u.external_id ILIKE '%' || $3 || '%' OR u.full_name ILIKE '%' || $3 || '%')
          AND ($4 = '' OR v.verified_at >= $4::timestamptz)
          AND ($5 = '' OR v.verified_at < $5::timestamptz)`

      const [list, counts] = await Promise.all([
        query<{
          id: string
          usn: string | null
          name: string | null
          method: string
          result: string
          reason: string | null
          latency_ms: number | null
          reader_id: string
          location: string | null
          verified_at: Date
        }>(
          `SELECT v.id, u.external_id AS usn, u.full_name AS name, v.method, v.result,
                  v.reason, v.latency_ms, v.reader_id, r.location, v.verified_at
             FROM verification_events v
             LEFT JOIN app_users u ON u.id = v.student_id
             LEFT JOIN readers r ON r.name = v.reader_id
             ${where}
             ORDER BY v.verified_at DESC
             LIMIT $6 OFFSET $7`,
          [result, method, search, from, to, limit, offset],
        ),
        query<{ total: number; accepted: number; rejected: number }>(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE v.result = 'accepted')::int AS accepted,
                  COUNT(*) FILTER (WHERE v.result = 'rejected')::int AS rejected
             FROM verification_events v LEFT JOIN app_users u ON u.id = v.student_id
             ${where}`,
          [result, method, search, from, to],
        ),
      ])

      const summary = counts.rows[0]
      const total = summary?.total ?? 0
      return {
        verifications: list.rows.map((row) => ({
          id: row.id,
          usn: row.usn,
          name: row.name,
          method: row.method,
          result: row.result,
          reason: row.reason,
          latency_ms: row.latency_ms,
          reader: row.reader_id,
          location: row.location,
          verified_at: row.verified_at.toISOString(),
        })),
        summary: {
          total,
          accepted: summary?.accepted ?? 0,
          rejected: summary?.rejected ?? 0,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      }
    },
  )

  app.get(
    '/verifications/summary',
    { preHandler: app.requireRole(['admin', 'faculty']) },
    async () => {
      const [readers, hourly, summary] = await Promise.all([
        query<{
          name: string
          location: string
          status: string
          median_seconds: number | null
          checks: number
        }>(
          `SELECT r.name, r.location, r.status,
                  ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY v.latency_ms))::numeric / 1000, 2)
                    AS median_seconds,
                  COUNT(v.id)::int AS checks
             FROM readers r
             LEFT JOIN verification_events v ON v.reader_id = r.name
            GROUP BY r.name, r.location, r.status
            ORDER BY r.name`,
        ),
        query<{ hour: number; total: number }>(
          `SELECT EXTRACT(HOUR FROM verified_at)::int AS hour, COUNT(*)::int AS total
             FROM verification_events
            WHERE verified_at >= date_trunc('day', now())
            GROUP BY 1
            ORDER BY 1`,
        ),
        query<{
          total: number
          accepted: number
          rejected: number
          median_seconds: number | null
        }>(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE result = 'accepted')::int AS accepted,
                  COUNT(*) FILTER (WHERE result = 'rejected')::int AS rejected,
                  ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms))::numeric / 1000, 2)
                    AS median_seconds
             FROM verification_events
            WHERE verified_at >= date_trunc('day', now())`,
        ),
      ])

      return {
        summary: summary.rows[0] ?? {
          total: 0,
          accepted: 0,
          rejected: 0,
          median_seconds: null,
        },
        readers: readers.rows.map((row) => ({
          id: row.name,
          location: row.location,
          state: row.status === 'offline' ? 'Offline' : 'Online',
          median_seconds: row.median_seconds === null ? null : Number(row.median_seconds),
          checks: row.checks,
        })),
        hourly: hourly.rows.map((row) => ({
          hour: row.hour,
          total: row.total,
        })),
      }
    },
  )

  /**
   * Backend-authoritative verification. The reader posts a short lived campus
   * pass; the server decides the outcome and records the event. A minimal
   * student summary is returned only on success.
   */
  app.post<{ Body: VerifyBody }>('/verify', async (request, reply) => {
    const startedAt = Date.now()
    const body = request.body ?? {}
    if (!body.token) throw badRequest('token is required.')
    if (!body.method || !['qr', 'nfc'].includes(body.method)) {
      throw badRequest('method must be qr or nfc.')
    }
    if (!body.readerId) throw badRequest('readerId is required.')
    const method = body.method
    const readerId = body.readerId

    const pass = verifyPass(body.token)
    if (!pass) {
      const latency = Date.now() - startedAt
      await query(
        `INSERT INTO verification_events (token_nonce, reader_id, method, result, reason, latency_ms)
         VALUES ($1, $2, $3, 'rejected', 'invalid_or_expired_pass', $4)`,
        [`rejected-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, readerId, method, latency],
      )
      reply.code(200)
      return { result: 'rejected', reason: 'invalid_or_expired_pass', latency_ms: latency }
    }

    const card = await query<{
      id: string
      card_uid: string
      status: string
      valid_to: Date
      student_id: string
      external_id: string
      full_name: string
      active: boolean
    }>(
      `SELECT c.id, c.card_uid, c.status, c.valid_to, c.student_id,
              u.external_id, u.full_name, u.active
         FROM cards c JOIN app_users u ON u.id = c.student_id
        WHERE c.card_uid = $1`,
      [pass.card_uid],
    )
    const row = card.rows[0]
    const latency = Date.now() - startedAt

    const reject = async (reason: string) => {
      await query(
        `INSERT INTO verification_events
           (token_nonce, reader_id, method, result, reason, latency_ms, student_id, card_id)
         VALUES ($1, $2, $3, 'rejected', $4, $5, $6, $7)
         ON CONFLICT (token_nonce) DO NOTHING`,
        [pass.nonce, readerId, method, reason, latency, row?.student_id ?? null, row?.id ?? null],
      )
      reply.code(200)
      return { result: 'rejected', reason, latency_ms: latency }
    }

    if (!row) return reject('unknown_card')
    if (!row.active) return reject('inactive_student')
    if (row.status === 'revoked') return reject('card_revoked')
    if (row.valid_to.getTime() < Date.now()) return reject('card_expired')

    await query(
      `INSERT INTO verification_events
         (token_nonce, reader_id, method, result, reason, latency_ms, student_id, card_id)
       VALUES ($1, $2, $3, 'accepted', NULL, $4, $5, $6)
       ON CONFLICT (token_nonce) DO NOTHING`,
      [pass.nonce, readerId, method, latency, row.student_id, row.id],
    )

    reply.code(200)
    return {
      result: 'accepted',
      reason: null,
      latency_ms: latency,
      verified_at: new Date().toISOString(),
      student: { usn: row.external_id, name: row.full_name },
    }
  })
}
