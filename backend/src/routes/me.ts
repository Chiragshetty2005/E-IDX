import type { FastifyInstance } from 'fastify'

import { query } from '../db.js'
import { issuePass } from '../lib/pass.js'
import { assertNoRiskFields } from '../lib/privacy.js'
import { forbidden, notFound } from '../plugins/errors.js'
import type { AuthUser } from '../types/fastify.js'
import { permissionsFor, publicUser } from './auth.js'

interface CardRow {
  id: string
  card_uid: string
  status: string
  battery: number | null
  firmware: string
  valid_from: Date
  valid_to: Date
  last_sync_at: Date | null
  revoked_at: Date | null
  revoke_reason: string | null
}

function cardView(row: CardRow) {
  return {
    card_id: row.id,
    card_uid: row.card_uid,
    status: row.status,
    battery: row.battery,
    firmware: row.firmware,
    valid_from: row.valid_from.toISOString(),
    valid_to: row.valid_to.toISOString(),
    last_sync_at: row.last_sync_at ? row.last_sync_at.toISOString() : null,
    revoked_at: row.revoked_at ? row.revoked_at.toISOString() : null,
    revoke_reason: row.revoke_reason,
  }
}

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate)

  app.get('/me', async (request) => {
    const user = request.user as AuthUser
    return { user: publicUser(user), permissions: permissionsFor(user.role) }
  })

  app.get('/me/card', async (request) => {
    const user = request.user as AuthUser
    if (user.role !== 'student') {
      throw forbidden('Only card holders can read a card.', 'not_a_student')
    }
    const result = await query<CardRow>(
      `SELECT id, card_uid, status, battery, firmware, valid_from, valid_to,
              last_sync_at, revoked_at, revoke_reason
         FROM cards WHERE student_id = $1`,
      [user.id],
    )
    const card = result.rows[0]
    if (!card) throw notFound('No card is issued to this student.', 'card_not_found')
    return { card: cardView(card) }
  })

  app.post('/me/pass', async (request, reply) => {
    const user = request.user as AuthUser
    if (user.role !== 'student') {
      throw forbidden('Only card holders can request a campus pass.', 'not_a_student')
    }
    const result = await query<CardRow>(
      `SELECT id, card_uid, status, battery, firmware, valid_from, valid_to,
              last_sync_at, revoked_at, revoke_reason
         FROM cards WHERE student_id = $1`,
      [user.id],
    )
    const card = result.rows[0]
    if (!card) throw notFound('No card is issued to this student.', 'card_not_found')
    if (card.status === 'revoked') {
      throw forbidden('This card has been revoked.', 'card_revoked')
    }

    const pass = issuePass(card.card_uid)
    // Defensive: a pass must never carry academic risk.
    assertNoRiskFields(pass)
    reply.code(201)
    return { pass }
  })

  app.get('/me/attendance', async (request) => {
    const user = request.user as AuthUser
    if (user.role !== 'student') {
      throw forbidden('Only students can read their attendance.', 'not_a_student')
    }
    const result = await query<{
      course_code: string
      course_title: string | null
      held: number
      attended: number
    }>(
      `SELECT e.course_code, e.course_title, s.held, s.attended
         FROM course_enrollments e
         LEFT JOIN course_attendance_summary s
                ON s.student_id = e.student_id AND s.course_code = e.course_code
        WHERE e.student_id = $1 AND e.withdrawn_at IS NULL
        ORDER BY e.course_code`,
      [user.id],
    )
    const courses = result.rows.map((row) => ({
      code: row.course_code,
      title: row.course_title ?? row.course_code,
      held: row.held ?? 0,
      attended: row.attended ?? 0,
      percent:
        row.held && row.held > 0
          ? Number(((row.attended / row.held) * 100).toFixed(1))
          : 0,
    }))
    const held = courses.reduce((sum, course) => sum + course.held, 0)
    const attended = courses.reduce((sum, course) => sum + course.attended, 0)
    return {
      courses,
      overall: {
        held,
        attended,
        percent: held > 0 ? Number(((attended / held) * 100).toFixed(1)) : 0,
      },
    }
  })

  app.get('/me/academics', async (request) => {
    const user = request.user as AuthUser
    if (user.role !== 'student') {
      throw forbidden('Only students can read their academic record.', 'not_a_student')
    }
    const result = await query<{
      cgpa: number
      backlogs: number
      internal_marks: number
      internal_max: number
      assignment_rate: number
      library_visits: number
      sgpa: unknown
    }>(
      `SELECT cgpa, backlogs, internal_marks, internal_max, assignment_rate, library_visits, sgpa
         FROM student_academic_profiles WHERE student_id = $1`,
      [user.id],
    )
    const profile = result.rows[0]
    return {
      academics: {
        cgpa: profile?.cgpa ?? 0,
        backlogs: profile?.backlogs ?? 0,
        internal_marks: profile?.internal_marks ?? 0,
        internal_max: profile?.internal_max ?? 25,
        assignment_rate: profile?.assignment_rate ?? 0,
        library_visits: profile?.library_visits ?? 0,
        sgpa: profile?.sgpa ?? [],
      },
    }
  })

  app.get('/me/library', async (request) => {
    const user = request.user as AuthUser
    if (user.role !== 'student') {
      throw forbidden('Only students can read their library loans.', 'not_a_student')
    }
    const result = await query<{ title: string; issued_at: Date; due_at: Date }>(
      `SELECT title, issued_at, due_at FROM library_loans
        WHERE student_id = $1 AND returned_at IS NULL ORDER BY due_at`,
      [user.id],
    )
    return {
      loans: result.rows.map((row) => ({
        title: row.title,
        issued_at: row.issued_at.toISOString(),
        due_at: row.due_at.toISOString(),
        status: 'On loan',
      })),
    }
  })

  app.get('/me/exams', async (request) => {
    const user = request.user as AuthUser
    if (user.role !== 'student') {
      throw forbidden('Only students can read their exam schedule.', 'not_a_student')
    }
    const result = await query<{
      course_code: string
      title: string
      starts_at: Date
      duration_minutes: number
      hall: string | null
    }>(
      `SELECT x.course_code, x.title, x.starts_at, x.duration_minutes, x.hall
         FROM exam_schedule x
         JOIN course_enrollments e ON e.course_code = x.course_code
        WHERE e.student_id = $1 AND e.withdrawn_at IS NULL
        ORDER BY x.starts_at`,
      [user.id],
    )
    return { exams: result.rows }
  })

  app.get('/me/fees', async (request) => {
    const user = request.user as AuthUser
    if (user.role !== 'student') {
      throw forbidden('Only students can read their fee receipts.', 'not_a_student')
    }
    const result = await query<{
      term: string
      amount: number
      paid_on: Date
      receipt_no: string
      status: string
    }>(
      `SELECT term, amount, paid_on, receipt_no, status FROM fee_receipts
        WHERE student_id = $1 ORDER BY paid_on DESC`,
      [user.id],
    )
    return { receipts: result.rows }
  })

  /**
   * There is no student-facing risk endpoint, and asking for one is refused
   * explicitly rather than silently returning an empty body.
   */
  app.get('/me/risk', async () => {
    throw forbidden(
      'Academic risk is a staff signal. Students discuss flags with their mentor.',
      'risk_is_staff_only',
    )
  })
}
