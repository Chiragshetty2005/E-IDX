import type { FastifyInstance } from 'fastify'

import { query, withStaffScope } from '../db.js'
import { badRequest, notFound } from '../plugins/errors.js'
import type { AuthUser } from '../types/fastify.js'

interface CohortRow {
  usn: string
  full_name: string
  programme: string | null
  semester: string | null
  section: string | null
  probability: number
  tier: string
  course_code: string
  drivers: Array<{ label: string; shap_value: number; direction: string }>
  generated_at: Date
  last_note: string | null
  last_note_at: Date | null
  mentor_name: string | null
}

export async function facultyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole(['admin', 'faculty']))

  app.get('/faculty/cohort', async () => {
    const { rows, totals } = await withStaffScope(async (client) => {
      const cohort = await client.query<CohortRow>(
        `WITH latest AS (
           SELECT DISTINCT ON (student_id)
                  student_id, probability, tier, course_code, drivers, generated_at
             FROM risk.staff_predictions
            WHERE tier IN ('support', 'watch')
            ORDER BY student_id, generated_at DESC
         )
         SELECT u.external_id AS usn, u.full_name, u.programme, u.semester, u.section,
                l.probability, l.tier, l.course_code, l.drivers, l.generated_at,
                m.full_name AS mentor_name,
                (SELECT i.note FROM interventions i
                  WHERE i.student_id = u.id ORDER BY i.created_at DESC LIMIT 1) AS last_note,
                (SELECT i.created_at FROM interventions i
                  WHERE i.student_id = u.id ORDER BY i.created_at DESC LIMIT 1) AS last_note_at
           FROM app_users u
           JOIN latest l ON l.student_id = u.id
           LEFT JOIN app_users m ON m.id = u.mentor_id
          ORDER BY l.probability DESC, u.external_id`,
      )
      const counts = await client.query<{
        students: number
        support: number
        watch: number
        on_track: number
        interventions: number
      }>(
        `WITH latest AS (
           SELECT DISTINCT ON (student_id) student_id, tier
             FROM risk.staff_predictions
            ORDER BY student_id, generated_at DESC
         )
         SELECT
           (SELECT COUNT(*)::int FROM app_users WHERE role = 'student' AND active = true) AS students,
           COUNT(*) FILTER (WHERE l.tier = 'support')::int AS support,
           COUNT(*) FILTER (WHERE l.tier = 'watch')::int AS watch,
           COUNT(*) FILTER (WHERE l.tier = 'on-track')::int AS on_track,
           (SELECT COUNT(*)::int FROM interventions WHERE created_at >= now() - interval '30 days') AS interventions
         FROM app_users u LEFT JOIN latest l ON l.student_id = u.id
        WHERE u.role = 'student' AND u.active = true`,
      )
      return { rows: cohort.rows, totals: counts.rows[0] }
    })

    return {
      totals: {
        students: totals?.students ?? 0,
        support: totals?.support ?? 0,
        watch: totals?.watch ?? 0,
        on_track: totals?.on_track ?? 0,
        interventions_last_30_days: totals?.interventions ?? 0,
      },
      students: rows.map((row) => {
        const drivers = row.drivers ?? []
        const strongest = drivers.reduce<
          { label: string; shap_value: number; direction: string } | null
        >((best, driver) => {
          if (!best) return driver
          return Math.abs(driver.shap_value) > Math.abs(best.shap_value) ? driver : best
        }, null)
        return {
          usn: row.usn,
          name: row.full_name,
          programme: row.programme,
          semester: row.semester,
          section: row.section,
          mentor: row.mentor_name,
          risk_tier: row.tier,
          risk_probability: Number(row.probability),
          module_ref: row.course_code,
          top_driver: strongest?.label ?? null,
          top_driver_direction: strongest?.direction ?? null,
          generated_at: row.generated_at.toISOString(),
          last_intervention: row.last_note
            ? { note: row.last_note, created_at: row.last_note_at?.toISOString() ?? null }
            : null,
        }
      }),
    }
  })

  app.get<{ Params: { usn: string } }>('/faculty/students/:usn', async (request) => {
    const { usn } = request.params
    const student = await query<{ id: string; full_name: string }>(
      `SELECT id, full_name FROM app_users WHERE external_id = $1 AND role = 'student'`,
      [usn],
    )
    const row = student.rows[0]
    if (!row) throw notFound(`No student with USN ${usn}.`, 'student_not_found')

    const notes = await query<{
      id: string
      note: string
      source: string
      created_at: Date
      author: string
    }>(
      `SELECT i.id, i.note, i.source, i.created_at, a.full_name AS author
         FROM interventions i JOIN app_users a ON a.id = i.author_id
        WHERE i.student_id = $1 ORDER BY i.created_at DESC`,
      [row.id],
    )

    const { getStudentPredictions } = await import('../lib/risk.js')
    const predictions = await getStudentPredictions(usn)

    return {
      student: { usn, name: row.full_name },
      notes: notes.rows.map((note) => ({
        id: note.id,
        note: note.note,
        source: note.source,
        by: note.author,
        created_at: note.created_at.toISOString(),
      })),
      risk: predictions,
    }
  })

  interface InterventionBody {
    note?: string
    source?: string
  }

  app.post<{ Params: { usn: string }; Body: InterventionBody }>(
    '/faculty/students/:usn/interventions',
    async (request, reply) => {
      const author = request.user as AuthUser
      const note = request.body?.note?.trim()
      if (!note || note.length < 3) {
        throw badRequest('A mentor note of at least 3 characters is required.')
      }
      if (note.length > 2000) {
        throw badRequest('A mentor note cannot exceed 2000 characters.')
      }
      const source = request.body?.source ?? 'mentor'
      if (!['mentor', 'model-flag', 'counsellor'].includes(source)) {
        throw badRequest('source must be mentor, model-flag or counsellor.')
      }

      const student = await query<{ id: string }>(
        `SELECT id FROM app_users WHERE external_id = $1 AND role = 'student'`,
        [request.params.usn],
      )
      const row = student.rows[0]
      if (!row) throw notFound(`No student with USN ${request.params.usn}.`, 'student_not_found')

      const inserted = await query<{ id: string; created_at: Date }>(
        `INSERT INTO interventions (student_id, author_id, note, source)
         VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
        [row.id, author.id, note, source],
      )
      const created = inserted.rows[0]
      reply.code(201)
      return {
        intervention: {
          id: created?.id,
          note,
          source,
          by: author.fullName,
          created_at: created?.created_at.toISOString(),
        },
      }
    },
  )
}
