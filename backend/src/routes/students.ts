import type { FastifyInstance } from 'fastify'

import { query, withStaffScope } from '../db.js'
import { assertNoRiskFields } from '../lib/privacy.js'
import { getStudentPredictions } from '../lib/risk.js'
import { badRequest, notFound } from '../plugins/errors.js'
import type { AuthUser, Role } from '../types/fastify.js'

interface ListQuery {
  query?: string
  status?: string
  page?: number
  limit?: number
}

interface StudentListRow {
  usn: string
  full_name: string
  level: 'school' | 'college'
  class_label: string | null
  programme: string | null
  semester: string | null
  section: string | null
  card_uid: string | null
  card_status: string | null
  battery: number | null
  last_sync_at: Date | null
  valid_to: Date | null
  risk_probability: number | null
  risk_tier: string | null
  course_code: string | null
  mentor_name: string | null
}

export async function studentsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole(['admin', 'faculty']))

  app.get<{ Querystring: ListQuery }>('/students', async (request) => {
    const search = (request.query.query ?? '').trim()
    const status = (request.query.status ?? '').trim()
    const page = Math.max(1, Number(request.query.page ?? 1))
    const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 25)))
    const offset = (page - 1) * limit

    const { rows, count } = await withStaffScope(async (client) => {
      const params: (string | number)[] = [search, status, limit, offset]
      const where = `
        WHERE u.role = 'student'
          AND ($1 = '' OR u.full_name ILIKE '%' || $1 || '%' OR u.external_id ILIKE '%' || $1 || '%')
          AND ($2 = '' OR c.status = $2 OR latest.tier = $2)`
      const list = await client.query<StudentListRow>(
        `SELECT u.external_id AS usn, u.full_name, u.level, u.class_label,
                u.programme, u.semester, u.section,
                c.card_uid, c.status AS card_status, c.battery, c.last_sync_at, c.valid_to,
                latest.probability AS risk_probability, latest.tier AS risk_tier,
                latest.course_code, m.full_name AS mentor_name
           FROM app_users u
           LEFT JOIN cards c ON c.student_id = u.id
           LEFT JOIN app_users m ON m.id = u.mentor_id
           LEFT JOIN LATERAL (
                SELECT sp.probability, sp.tier, sp.course_code
                  FROM risk.staff_predictions sp
                 WHERE sp.student_id = u.id
                 ORDER BY sp.generated_at DESC LIMIT 1
           ) latest ON true
           ${where}
          ORDER BY latest.probability DESC NULLS LAST, u.external_id
          LIMIT $3 OFFSET $4`,
        params,
      )
      const total = await client.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
           FROM app_users u
           LEFT JOIN cards c ON c.student_id = u.id
           LEFT JOIN LATERAL (
                SELECT sp.tier FROM risk.staff_predictions sp
                 WHERE sp.student_id = u.id
                 ORDER BY sp.generated_at DESC LIMIT 1
           ) latest ON true
           ${where}`,
        [search, status],
      )
      return { rows: list.rows, count: total.rows[0]?.total ?? 0 }
    })

    return {
      students: rows.map((row) => ({
        usn: row.usn,
        name: row.full_name,
        level: row.level,
        class_label: row.class_label,
        programme: row.programme,
        semester: row.semester,
        section: row.section,
        mentor: row.mentor_name,
        card: row.card_uid
          ? {
              card_uid: row.card_uid,
              status: row.card_status,
              battery: row.battery,
              last_sync_at: row.last_sync_at ? row.last_sync_at.toISOString() : null,
              valid_to: row.valid_to ? row.valid_to.toISOString() : null,
            }
          : null,
        risk:
          row.level === 'college' && row.risk_tier
            ? {
                tier: row.risk_tier,
                probability: row.risk_probability,
                module_ref: row.course_code,
              }
            : null,
      })),
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.max(1, Math.ceil(count / limit)),
      },
    }
  })

  app.get<{ Params: { usn: string } }>('/students/:usn', async (request) => {
    const { usn } = request.params
    const result = await query<{
      id: string
      usn: string
      full_name: string
      email: string | null
      level: 'school' | 'college'
      class_label: string | null
      programme: string | null
      semester: string | null
      section: string | null
      mentor_name: string | null
      cgpa: number | null
      backlogs: number | null
      internal_marks: number | null
      internal_max: number | null
      assignment_rate: number | null
      library_visits: number | null
      sgpa: unknown
    }>(
      `SELECT u.id, u.external_id AS usn, u.full_name, u.email, u.level, u.class_label,
              u.programme, u.semester, u.section,
              m.full_name AS mentor_name,
              p.cgpa, p.backlogs, p.internal_marks, p.internal_max,
              p.assignment_rate, p.library_visits, p.sgpa
         FROM app_users u
         LEFT JOIN app_users m ON m.id = u.mentor_id
         LEFT JOIN student_academic_profiles p ON p.student_id = u.id
        WHERE u.external_id = $1 AND u.role = 'student'`,
      [usn],
    )
    const student = result.rows[0]
    if (!student) throw notFound(`No student with USN ${usn}.`, 'student_not_found')

    const [card, courses, attendance, interventions, risk] = await Promise.all([
      query<{
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
        nfc_uid: string | null
        uhf_tag_id: string | null
      }>(
        `SELECT id, card_uid, status, battery, firmware, valid_from, valid_to,
                last_sync_at, revoked_at, revoke_reason, nfc_uid, uhf_tag_id
           FROM cards WHERE student_id = $1`,
        [student.id],
      ),
      query<{ course_code: string; course_title: string | null; credits: number | null }>(
        `SELECT course_code, course_title, credits FROM course_enrollments
          WHERE student_id = $1 AND withdrawn_at IS NULL ORDER BY course_code`,
        [student.id],
      ),
      query<{ course_code: string; held: number; attended: number }>(
        `SELECT course_code, held, attended FROM course_attendance_summary
          WHERE student_id = $1 ORDER BY course_code`,
        [student.id],
      ),
      query<{ id: string; note: string; source: string; created_at: Date; author: string }>(
        `SELECT i.id, i.note, i.source, i.created_at, a.full_name AS author
           FROM interventions i JOIN app_users a ON a.id = i.author_id
          WHERE i.student_id = $1 ORDER BY i.created_at DESC`,
        [student.id],
      ),
      getStudentPredictions(usn),
    ])

    const cardRow = card.rows[0]
    return {
      student: {
        usn: student.usn,
        name: student.full_name,
        email: student.email,
        level: student.level,
        class_label: student.class_label,
        programme: student.programme,
        semester: student.semester,
        section: student.section,
        mentor: student.mentor_name,
        academics: {
          cgpa: student.cgpa ?? 0,
          backlogs: student.backlogs ?? 0,
          internal_marks: student.internal_marks ?? 0,
          internal_max: student.internal_max ?? 25,
          assignment_rate: student.assignment_rate ?? 0,
          library_visits: student.library_visits ?? 0,
          sgpa: student.sgpa ?? [],
        },
        courses: courses.rows,
        attendance: attendance.rows.map((row) => ({
          course_code: row.course_code,
          held: row.held,
          attended: row.attended,
          percent: row.held > 0 ? Number(((row.attended / row.held) * 100).toFixed(1)) : 0,
        })),
        card: cardRow
          ? {
              card_id: cardRow.id,
              card_uid: cardRow.card_uid,
              status: cardRow.status,
              battery: cardRow.battery,
              firmware: cardRow.firmware,
              valid_from: cardRow.valid_from.toISOString(),
              valid_to: cardRow.valid_to.toISOString(),
              last_sync_at: cardRow.last_sync_at ? cardRow.last_sync_at.toISOString() : null,
              revoked_at: cardRow.revoked_at ? cardRow.revoked_at.toISOString() : null,
              revoke_reason: cardRow.revoke_reason,
              nfc_uid: cardRow.nfc_uid,
              uhf_tag_id: cardRow.uhf_tag_id,
            }
          : null,
        interventions: interventions.rows.map((row) => ({
          id: row.id,
          note: row.note,
          source: row.source,
          by: row.author,
          created_at: row.created_at.toISOString(),
        })),
      },
      // Staff only: the frozen academic risk payload.
      risk,
    }
  })

  app.get<{ Params: { usn: string } }>('/students/:usn/explanation', async (request) => {
    const predictions = await getStudentPredictions(request.params.usn)
    if (predictions.length === 0) {
      throw notFound('No risk prediction has been generated for this student.', 'no_prediction')
    }
    return {
      explanations: predictions.map((prediction) => ({
        module_ref: prediction.module_ref,
        risk_tier: prediction.risk_tier,
        risk_probability: prediction.risk_probability,
        model_version: prediction.model_version,
        cutoff_day: prediction.cutoff_day,
        generated_at: prediction.generated_at,
        drivers: prediction.drivers,
      })),
    }
  })

  interface CardUpdateBody {
    change_type?: string
    summary?: string
    payload?: Record<string, unknown>
    idempotency_key?: string
  }

  app.post<{ Params: { usn: string }; Body: CardUpdateBody }>(
    '/students/:usn/card-updates',
    async (request, reply) => {
      const actor = request.user as AuthUser
      const { usn } = request.params
      const body = request.body ?? {}

      if (!body.idempotency_key || body.idempotency_key.trim().length < 8) {
        throw badRequest('An idempotency key of at least 8 characters is required.')
      }
      if (!body.change_type || !['validity', 'status', 'firmware', 'reissue'].includes(body.change_type)) {
        throw badRequest('change_type must be one of validity, status, firmware or reissue.')
      }
      if (!body.summary || body.summary.trim().length === 0) {
        throw badRequest('A human readable summary is required.')
      }
      if (!body.payload || typeof body.payload !== 'object') {
        throw badRequest('payload must be an object describing the change.')
      }
      // A card update never carries academic risk.
      assertNoRiskFields(body.payload)

      const student = await query<{ id: string }>(
        `SELECT id FROM app_users WHERE external_id = $1 AND role = 'student'`,
        [usn],
      )
      const studentRow = student.rows[0]
      if (!studentRow) throw notFound(`No student with USN ${usn}.`, 'student_not_found')

      const card = await query<{ id: string }>(
        `SELECT id FROM cards WHERE student_id = $1`,
        [studentRow.id],
      )
      const cardRow = card.rows[0]
      if (!cardRow) throw notFound('This student has no card to update.', 'card_not_found')

      const inserted = await query<{ id: string; state: string; created_at: Date }>(
        `INSERT INTO card_updates
           (card_id, student_id, change_type, summary, payload, idempotency_key, actor_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id, state, created_at`,
        [
          cardRow.id,
          studentRow.id,
          body.change_type,
          body.summary.trim(),
          JSON.stringify(body.payload),
          body.idempotency_key.trim(),
          actor.id,
        ],
      )

      const created = inserted.rows[0]
      if (!created) {
        const existing = await query<{ id: string; state: string; created_at: Date }>(
          `SELECT id, state, created_at FROM card_updates WHERE idempotency_key = $1`,
          [body.idempotency_key.trim()],
        )
        const replay = existing.rows[0]
        reply.code(200)
        return {
          update: {
            id: replay?.id,
            state: replay?.state ?? 'queued',
            created_at: replay?.created_at?.toISOString(),
            idempotent_replay: true,
          },
        }
      }

      reply.code(201)
      return {
        update: {
          id: created.id,
          state: created.state,
          created_at: created.created_at.toISOString(),
          idempotent_replay: false,
        },
      }
    },
  )
}
