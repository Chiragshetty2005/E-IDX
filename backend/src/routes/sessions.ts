import type { FastifyInstance } from 'fastify'

import { query } from '../db.js'
import { verifyPass } from '../lib/pass.js'
import { requireReaderKey } from '../plugins/auth.js'
import { badRequest, conflict, notFound, unprocessable } from '../plugins/errors.js'

interface SessionQuery {
  date?: string
}

interface CreateSessionBody {
  course_code?: string
  title?: string
  room?: string
  starts_at?: string
  ends_at?: string
}

interface TapBody {
  token?: string
  card_uid?: string
  method?: string
  latency_ms?: number
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: SessionQuery }>(
    '/sessions',
    { preHandler: app.requireRole(['admin', 'faculty']) },
    async (request) => {
      const date = request.query.date ?? ''
      const result = await query<{
        id: string
        course_code: string
        title: string
        room: string | null
        starts_at: Date
        ends_at: Date
        state: string
        total_expected: number
        present: number
      }>(
        `SELECT s.id, s.course_code, s.title, s.room, s.starts_at, s.ends_at, s.state,
                s.total_expected,
                (SELECT COUNT(*)::int FROM attendance_records r
                  WHERE r.session_id = s.id AND r.status = 'accepted') AS present
           FROM attendance_sessions s
          WHERE ($1 = '' OR s.starts_at >= $1::date AND s.starts_at < ($1::date + interval '1 day'))
          ORDER BY s.starts_at DESC
          LIMIT 100`,
        [date],
      )

      return {
        sessions: result.rows.map((row) => ({
          id: row.id,
          course_code: row.course_code,
          title: row.title,
          room: row.room,
          starts_at: row.starts_at.toISOString(),
          ends_at: row.ends_at.toISOString(),
          state: row.state,
          total_expected: row.total_expected,
          present: row.present,
        })),
      }
    },
  )

  app.post<{ Body: CreateSessionBody }>(
    '/sessions',
    { preHandler: app.requireRole(['admin', 'faculty']) },
    async (request, reply) => {
      const body = request.body ?? {}
      if (!body.course_code || !body.title) {
        throw badRequest('course_code and title are required.')
      }
      if (!body.starts_at || !body.ends_at) {
        throw badRequest('starts_at and ends_at are required.')
      }
      const startsAt = new Date(body.starts_at)
      const endsAt = new Date(body.ends_at)
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        throw badRequest('starts_at and ends_at must be ISO timestamps.')
      }
      if (endsAt <= startsAt) throw badRequest('ends_at must be after starts_at.')

      const expected = await query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM course_enrollments
          WHERE course_code = $1 AND withdrawn_at IS NULL`,
        [body.course_code],
      )

      const inserted = await query<{ id: string }>(
        `INSERT INTO attendance_sessions
           (course_code, title, room, starts_at, ends_at, total_expected, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          body.course_code,
          body.title,
          body.room ?? null,
          startsAt,
          endsAt,
          expected.rows[0]?.total ?? 0,
          request.user?.id ?? null,
        ],
      )
      reply.code(201)
      return { session: { id: inserted.rows[0]?.id, state: 'upcoming' } }
    },
  )

  app.post<{ Params: { id: string } }>(
    '/sessions/:id/open',
    { preHandler: app.requireRole(['admin', 'faculty']) },
    async (request) => {
      const session = await query<{ id: string; course_code: string; state: string }>(
        `SELECT id, course_code, state FROM attendance_sessions WHERE id = $1`,
        [request.params.id],
      )
      const row = session.rows[0]
      if (!row) throw notFound('No such session.', 'session_not_found')
      if (row.state === 'closed') throw conflict('This session is closed.', 'session_closed')

      const openElsewhere = await query<{ id: string }>(
        `SELECT id FROM attendance_sessions
          WHERE course_code = $1 AND state = 'open' AND id <> $2`,
        [row.course_code, row.id],
      )
      if (openElsewhere.rows.length > 0) {
        throw conflict('Another session for this course is already open.', 'session_already_open')
      }

      await query(`UPDATE attendance_sessions SET state = 'open' WHERE id = $1`, [row.id])
      return { session: { id: row.id, state: 'open' } }
    },
  )

  app.post<{ Params: { id: string } }>(
    '/sessions/:id/close',
    { preHandler: app.requireRole(['admin', 'faculty']) },
    async (request) => {
      const session = await query<{ id: string; state: string }>(
        `SELECT id, state FROM attendance_sessions WHERE id = $1`,
        [request.params.id],
      )
      const row = session.rows[0]
      if (!row) throw notFound('No such session.', 'session_not_found')
      await query(`UPDATE attendance_sessions SET state = 'closed' WHERE id = $1`, [row.id])
      return { session: { id: row.id, state: 'closed' } }
    },
  )

  /**
   * Reader to server path for a tap. Readers authenticate with the device
   * key, never with a browser session.
   */
  app.post<{ Params: { id: string }; Body: TapBody }>(
    '/sessions/:id/taps',
    async (request, reply) => {
      requireReaderKey(request)
      const body = request.body ?? {}
      if (!body.method || !['qr', 'nfc'].includes(body.method)) {
        throw badRequest('method must be qr or nfc.')
      }

      let cardUid = body.card_uid ?? null
      if (!cardUid && body.token) {
        const pass = verifyPass(body.token)
        if (!pass) throw unprocessable('The campus pass is invalid or expired.', 'pass_invalid')
        cardUid = pass.card_uid
      }
      if (!cardUid) throw badRequest('Provide either a token or a card_uid.')

      const session = await query<{ id: string; state: string; course_code: string }>(
        `SELECT id, state, course_code FROM attendance_sessions WHERE id = $1`,
        [request.params.id],
      )
      const sessionRow = session.rows[0]
      if (!sessionRow) throw notFound('No such session.', 'session_not_found')
      if (sessionRow.state !== 'open') {
        throw conflict('This session is not open.', 'session_not_open')
      }

      const card = await query<{
        id: string
        card_uid: string
        status: string
        valid_to: Date
        student_id: string
        external_id: string
        enrolled: boolean
      }>(
        `SELECT c.id, c.card_uid, c.status, c.valid_to, c.student_id, u.external_id,
                EXISTS (
                  SELECT 1 FROM course_enrollments e
                   WHERE e.student_id = c.student_id AND e.course_code = $2
                     AND e.withdrawn_at IS NULL
                ) AS enrolled
           FROM cards c JOIN app_users u ON u.id = c.student_id
          WHERE c.card_uid = $1`,
        [cardUid, sessionRow.course_code],
      )
      const cardRow = card.rows[0]
      if (!cardRow) throw notFound('Unknown card.', 'unknown_card')
      if (cardRow.status === 'revoked') throw unprocessable('This card is revoked.', 'card_revoked')

      const duplicate = await query<{ id: string }>(
        `SELECT id FROM attendance_records
          WHERE session_id = $1 AND student_id = $2 AND status = 'accepted'`,
        [sessionRow.id, cardRow.student_id],
      )
      if (duplicate.rows.length > 0) {
        throw conflict('This student is already marked present.', 'duplicate_tap')
      }

      const inserted = await query<{ id: string; verified_at: Date }>(
        `INSERT INTO attendance_records
           (session_id, student_id, card_id, method, status, latency_ms, reader_id)
         VALUES ($1, $2, $3, $4, 'accepted', $5, $6)
         RETURNING id, verified_at`,
        [
          sessionRow.id,
          cardRow.student_id,
          cardRow.id,
          body.method,
          body.latency_ms ?? null,
          `READER-${sessionRow.id.slice(0, 4)}`,
        ],
      )

      reply.code(201)
      return {
        record: {
          id: inserted.rows[0]?.id,
          status: 'accepted',
          usn: cardRow.external_id,
          verified_at: inserted.rows[0]?.verified_at.toISOString(),
        },
      }
    },
  )
}
