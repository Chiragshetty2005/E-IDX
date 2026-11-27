import type { FastifyInstance } from 'fastify'

import { query, withTransaction } from '../db.js'
import {
  LATEST_PRESENCE_CTE,
  notificationCopy,
  presenceState,
  type CheckpointZone,
  type PresenceDirection,
  type PresenceMethod,
  type PresenceState,
} from '../lib/presence.js'
import { badRequest, forbidden, notFound } from '../plugins/errors.js'
import type { AuthUser } from '../types/fastify.js'

interface OverviewQuery {
  level?: string
  section?: string
}

interface Scope {
  level: 'school' | 'college'
  section: string
  label: string
}

interface StudentRow {
  usn: string
  name: string
  level: 'school' | 'college'
  class_label: string | null
  section: string | null
  direction: PresenceDirection | null
  method: PresenceMethod | null
  occurred_at: Date | null
  checkpoint_code: string | null
  checkpoint_name: string | null
  zone: CheckpointZone | null
  guardian: string | null
}

interface EventRow {
  id: string
  usn: string
  name: string
  checkpoint_code: string
  checkpoint_name: string
  zone: CheckpointZone
  direction: PresenceDirection
  method: PresenceMethod
  source: string
  occurred_at: Date
  notifications: number
}

function resolveScope(actor: AuthUser, request: OverviewQuery): Scope {
  // Faculty always see their own college section, never the school pilot.
  if (actor.role === 'faculty') {
    const section = actor.section ?? ''
    return {
      level: 'college',
      section,
      label: section ? `${section} presence` : 'College presence',
    }
  }

  const level: 'school' | 'college' = request.level === 'college' ? 'college' : 'school'
  const section = (request.section ?? '').trim()
  return {
    level,
    section,
    label: level === 'school' ? 'School pilot' : 'College campus',
  }
}

interface StudentView {
  usn: string
  name: string
  level: 'school' | 'college'
  class_label: string | null
  section: string | null
  state: PresenceState
  state_label: string
  checkpoint: {
    code: string
    name: string
    zone: CheckpointZone
  } | null
  direction: PresenceDirection | null
  method: PresenceMethod | null
  occurred_at: string | null
  guardian: string | null
}

function studentView(row: StudentRow): StudentView {
  const state = presenceState(row)
  return {
    usn: row.usn,
    name: row.name,
    level: row.level,
    class_label: row.class_label,
    section: row.section,
    state: state.state,
    state_label: state.label,
    checkpoint:
      row.checkpoint_code && row.checkpoint_name && row.zone
        ? { code: row.checkpoint_code, name: row.checkpoint_name, zone: row.zone }
        : null,
    direction: row.direction,
    method: row.method,
    occurred_at: row.occurred_at ? row.occurred_at.toISOString() : null,
    guardian: row.guardian,
  }
}

export async function presenceRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole(['admin', 'faculty']))

  app.get<{ Querystring: OverviewQuery }>('/presence/overview', async (request) => {
    const actor = request.user as AuthUser
    const scope = resolveScope(actor, request.query)

    const [summary, zones, students, events, classes, checkpoints, alerts] = await Promise.all([
      query<{
        expected: number
        on_campus: number
        on_bus: number
        left_campus: number
        not_arrived: number
        last_event_at: Date | null
      }>(
        `WITH ${LATEST_PRESENCE_CTE}
         SELECT COUNT(*)::int AS expected,
                COUNT(*) FILTER (
                  WHERE l.direction = 'in'
                    AND l.zone IN ('gate', 'classroom', 'library', 'canteen')
                )::int AS on_campus,
                COUNT(*) FILTER (WHERE l.direction = 'in' AND l.zone = 'bus')::int AS on_bus,
                COUNT(*) FILTER (WHERE l.direction = 'out')::int AS left_campus,
                COUNT(*) FILTER (WHERE l.direction IS NULL)::int AS not_arrived,
                MAX(l.occurred_at) AS last_event_at
           FROM app_users u
           LEFT JOIN latest l ON l.student_id = u.id
          WHERE u.role = 'student' AND u.active = true
            AND u.level = $1
            AND ($2 = '' OR u.section = $2)`,
        [scope.level, scope.section],
      ),
      query<{ zone: CheckpointZone; count: number }>(
        `WITH ${LATEST_PRESENCE_CTE}
         SELECT l.zone, COUNT(*)::int AS count
           FROM latest l
           JOIN app_users u ON u.id = l.student_id
          WHERE u.role = 'student' AND u.active = true
            AND u.level = $1
            AND ($2 = '' OR u.section = $2)
          GROUP BY l.zone
          ORDER BY count DESC`,
        [scope.level, scope.section],
      ),
      query<StudentRow>(
        `WITH ${LATEST_PRESENCE_CTE}
         SELECT u.external_id AS usn, u.full_name AS name, u.level, u.class_label, u.section,
                l.direction, l.method, l.occurred_at,
                l.checkpoint_code, l.checkpoint_name, l.zone,
                (SELECT p.full_name
                   FROM parent_links pl JOIN app_users p ON p.id = pl.parent_id
                  WHERE pl.student_id = u.id
                  ORDER BY pl.primary_contact DESC, p.full_name
                  LIMIT 1) AS guardian
           FROM app_users u
           LEFT JOIN latest l ON l.student_id = u.id
          WHERE u.role = 'student' AND u.active = true
            AND u.level = $1
            AND ($2 = '' OR u.section = $2)
          ORDER BY
            CASE
              WHEN l.direction = 'in' AND l.zone = 'bus' THEN 2
              WHEN l.direction = 'out' THEN 3
              WHEN l.direction IS NULL THEN 4
              ELSE 1
            END,
            u.full_name
          LIMIT 100`,
        [scope.level, scope.section],
      ),
      query<EventRow>(
        `SELECT e.id, u.external_id AS usn, u.full_name AS name,
                c.code AS checkpoint_code, c.name AS checkpoint_name, c.zone,
                e.direction, e.method, e.source, e.occurred_at,
                (SELECT COUNT(*)::int FROM notifications n WHERE n.event_id = e.id) AS notifications
           FROM presence_events e
           JOIN app_users u ON u.id = e.student_id
           JOIN checkpoints c ON c.id = e.checkpoint_id
          WHERE e.occurred_at >= date_trunc('day', now())
            AND u.level = $1
            AND ($2 = '' OR u.section = $2)
          ORDER BY e.occurred_at DESC
          LIMIT 30`,
        [scope.level, scope.section],
      ),
      query<{ label: string; expected: number; present: number }>(
        `WITH ${LATEST_PRESENCE_CTE}
         SELECT COALESCE(NULLIF(u.class_label, ''), u.section, 'Unassigned') AS label,
                COUNT(*)::int AS expected,
                COUNT(*) FILTER (
                  WHERE l.direction = 'in'
                    AND l.zone IN ('gate', 'classroom', 'library', 'canteen')
                )::int AS present
           FROM app_users u
           LEFT JOIN latest l ON l.student_id = u.id
          WHERE u.role = 'student' AND u.active = true
            AND u.level = $1
            AND ($2 = '' OR u.section = $2)
          GROUP BY 1
          ORDER BY 1`,
        [scope.level, scope.section],
      ),
      query<{ code: string; name: string; zone: CheckpointZone; level: 'school' | 'college' }>(
        `SELECT code, name, zone, level FROM checkpoints
          WHERE active = true AND level = $1
          ORDER BY zone, name`,
        [scope.level],
      ),
      query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
           FROM notifications n
           JOIN app_users u ON u.id = n.student_id
          WHERE n.created_at >= date_trunc('day', now())
            AND u.level = $1
            AND ($2 = '' OR u.section = $2)`,
        [scope.level, scope.section],
      ),
    ])

    const summaryRow = summary.rows[0]
    const studentViews = students.rows.map(studentView)

    return {
      generated_at: new Date().toISOString(),
      scope: {
        level: scope.level,
        label: scope.label,
        section: scope.section || null,
      },
      summary: {
        expected: summaryRow?.expected ?? 0,
        on_campus: summaryRow?.on_campus ?? 0,
        on_bus: summaryRow?.on_bus ?? 0,
        left_campus: summaryRow?.left_campus ?? 0,
        not_arrived: summaryRow?.not_arrived ?? 0,
        alerts_today: alerts.rows[0]?.total ?? 0,
        last_event_at: summaryRow?.last_event_at
          ? summaryRow.last_event_at.toISOString()
          : null,
      },
      zones: zones.rows,
      students: studentViews,
      events: events.rows.map((row) => ({
        id: row.id,
        usn: row.usn,
        name: row.name,
        checkpoint: {
          code: row.checkpoint_code,
          name: row.checkpoint_name,
          zone: row.zone,
        },
        direction: row.direction,
        method: row.method,
        source: row.source,
        occurred_at: row.occurred_at.toISOString(),
        notifications: row.notifications,
      })),
      headcount: {
        expected: summaryRow?.expected ?? 0,
        present: summaryRow?.on_campus ?? 0,
        by_class: classes.rows,
      },
      checkpoints: checkpoints.rows,
    }
  })

  interface SimulateBody {
    student_usn?: string
    checkpoint_code?: string
    direction?: string
    method?: string
  }

  app.post<{ Body: SimulateBody }>('/presence/simulate', async (request, reply) => {
    const actor = request.user as AuthUser
    if (actor.role !== 'admin') {
      throw forbidden(
        'Only card services can emit a simulated checkpoint read.',
        'presence_simulation_forbidden',
      )
    }

    const usn = request.body?.student_usn?.trim()
    const checkpointCode = request.body?.checkpoint_code?.trim()
    const direction = request.body?.direction === 'out' ? 'out' : 'in'
    const method = (request.body?.method ?? 'uhf').trim()
    if (!usn) throw badRequest('student_usn is required.')
    if (!checkpointCode) throw badRequest('checkpoint_code is required.')
    if (!['uhf', 'qr', 'nfc'].includes(method)) {
      throw badRequest('method must be uhf, qr or nfc.')
    }

    const student = await query<{ id: string; name: string; level: string }>(
      `SELECT id, full_name AS name, level FROM app_users
        WHERE external_id = $1 AND role = 'student' AND active = true`,
      [usn],
    )
    const studentRow = student.rows[0]
    if (!studentRow) throw notFound(`No student with USN ${usn}.`, 'student_not_found')

    const checkpoint = await query<{
      id: string
      name: string
      zone: CheckpointZone
      level: string
    }>(
      `SELECT id, name, zone, level FROM checkpoints WHERE code = $1 AND active = true`,
      [checkpointCode],
    )
    const checkpointRow = checkpoint.rows[0]
    if (!checkpointRow) {
      throw notFound(`No checkpoint with code ${checkpointCode}.`, 'checkpoint_not_found')
    }
    if (checkpointRow.level !== studentRow.level) {
      throw badRequest(
        'That checkpoint belongs to a different campus level.',
        'checkpoint_level_mismatch',
      )
    }

    const result = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string; occurred_at: Date }>(
        `INSERT INTO presence_events
           (student_id, checkpoint_id, direction, method, source)
         VALUES ($1, $2, $3, $4, 'simulated')
         RETURNING id, occurred_at`,
        [studentRow.id, checkpointRow.id, direction, method],
      )
      const event = inserted.rows[0]
      if (!event) throw new Error('presence event insert returned no row')

      const copy = notificationCopy(
        studentRow.name,
        { name: checkpointRow.name, zone: checkpointRow.zone },
        direction as PresenceDirection,
        event.occurred_at,
      )

      const notifications = await client.query(
        `INSERT INTO notifications
           (parent_id, student_id, event_id, channel, status, title, message, sent_at)
         SELECT pl.parent_id, $1, $2, channels.channel,
                CASE WHEN channels.channel = 'push' THEN 'sent' ELSE 'queued' END,
                $3, $4,
                CASE WHEN channels.channel = 'push' THEN now() ELSE NULL END
           FROM parent_links pl
           CROSS JOIN (VALUES ('push'), ('sms')) AS channels(channel)
          WHERE pl.student_id = $1`,
        [studentRow.id, event.id, copy.title, copy.message],
      )

      return { event, copy, notifications: notifications.rowCount ?? 0 }
    })

    reply.code(201)
    return {
      event: {
        id: result.event.id,
        student_usn: usn,
        student_name: studentRow.name,
        checkpoint: {
          code: checkpointCode,
          name: checkpointRow.name,
          zone: checkpointRow.zone,
        },
        direction,
        method,
        source: 'simulated',
        occurred_at: result.event.occurred_at.toISOString(),
        simulated: true,
      },
      notification: {
        title: result.copy.title,
        message: result.copy.message,
        recipients: result.notifications,
      },
    }
  })
}
