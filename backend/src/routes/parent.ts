import type { FastifyInstance } from 'fastify'

import { query } from '../db.js'
import {
  LATEST_PRESENCE_CTE,
  presenceState,
  type CheckpointZone,
  type PresenceDirection,
  type PresenceMethod,
} from '../lib/presence.js'
import { assertNoRiskFields } from '../lib/privacy.js'
import { notFound } from '../plugins/errors.js'
import type { AuthUser } from '../types/fastify.js'

interface ChildRow {
  id: string
  usn: string
  name: string
  level: 'school' | 'college'
  class_label: string | null
  section: string | null
  programme: string | null
  relationship: string
  direction: PresenceDirection | null
  method: PresenceMethod | null
  occurred_at: Date | null
  checkpoint_code: string | null
  checkpoint_name: string | null
  zone: CheckpointZone | null
  card_uid: string | null
  card_status: string | null
  battery: number | null
  last_sync_at: Date | null
  valid_to: Date | null
  nfc_uid: string | null
  uhf_tag_id: string | null
}

interface EventRow {
  id: string
  checkpoint_code: string
  checkpoint_name: string
  zone: CheckpointZone
  direction: PresenceDirection
  method: PresenceMethod
  occurred_at: Date
}

interface AlertRow {
  id: string
  student_usn: string
  student_name: string
  channel: 'push' | 'sms'
  status: 'sent' | 'queued' | 'failed'
  title: string
  message: string
  created_at: Date
  sent_at: Date | null
  checkpoint_code: string | null
  checkpoint_name: string | null
  zone: CheckpointZone | null
}

function childView(row: ChildRow) {
  const state = presenceState(row)
  return {
    usn: row.usn,
    name: row.name,
    level: row.level,
    class_label: row.class_label,
    section: row.section,
    programme: row.programme,
    relationship: row.relationship,
    presence: {
      state: state.state,
      state_label: state.label,
      checkpoint:
        row.checkpoint_code && row.checkpoint_name && row.zone
          ? { code: row.checkpoint_code, name: row.checkpoint_name, zone: row.zone }
          : null,
      direction: row.direction,
      method: row.method,
      occurred_at: row.occurred_at ? row.occurred_at.toISOString() : null,
    },
    card: row.card_uid
      ? {
          card_uid: row.card_uid,
          status: row.card_status,
          battery: row.battery,
          last_sync_at: row.last_sync_at ? row.last_sync_at.toISOString() : null,
          valid_to: row.valid_to ? row.valid_to.toISOString() : null,
          nfc_uid: row.nfc_uid,
          uhf_tag_id: row.uhf_tag_id,
        }
      : null,
  }
}

function alertView(row: AlertRow) {
  return {
    id: row.id,
    student: { usn: row.student_usn, name: row.student_name },
    channel: row.channel,
    status: row.status,
    title: row.title,
    message: row.message,
    created_at: row.created_at.toISOString(),
    sent_at: row.sent_at ? row.sent_at.toISOString() : null,
    checkpoint:
      row.checkpoint_code && row.checkpoint_name && row.zone
        ? { code: row.checkpoint_code, name: row.checkpoint_name, zone: row.zone }
        : null,
  }
}

async function linkedChild(parentId: string, usn: string): Promise<ChildRow> {
  const result = await query<ChildRow>(
    `WITH ${LATEST_PRESENCE_CTE}
     SELECT u.id, u.external_id AS usn, u.full_name AS name, u.level, u.class_label,
            u.section, u.programme, pl.relationship,
            l.direction, l.method, l.occurred_at,
            l.checkpoint_code, l.checkpoint_name, l.zone,
            c.card_uid, c.status AS card_status, c.battery, c.last_sync_at, c.valid_to,
            c.nfc_uid, c.uhf_tag_id
       FROM parent_links pl
       JOIN app_users u ON u.id = pl.student_id
       LEFT JOIN cards c ON c.student_id = u.id
       LEFT JOIN latest l ON l.student_id = u.id
      WHERE pl.parent_id = $1
        AND u.external_id = $2
        AND u.role = 'student'
        AND u.active = true`,
    [parentId, usn],
  )
  const row = result.rows[0]
  // The same response for "missing" and "not linked": a parent cannot probe
  // the register by trying USNs.
  if (!row) throw notFound('No linked child matches that USN.', 'child_not_found')
  return row
}

async function alertsFor(parentId: string, usn?: string): Promise<AlertRow[]> {
  const params: string[] = [parentId]
  let filter = ''
  if (usn) {
    params.push(usn)
    filter = 'AND u.external_id = $2'
  }
  const result = await query<AlertRow>(
    `SELECT n.id, u.external_id AS student_usn, u.full_name AS student_name,
            n.channel, n.status, n.title, n.message, n.created_at, n.sent_at,
            c.code AS checkpoint_code, c.name AS checkpoint_name, c.zone
       FROM notifications n
       JOIN app_users u ON u.id = n.student_id
       LEFT JOIN presence_events e ON e.id = n.event_id
       LEFT JOIN checkpoints c ON c.id = e.checkpoint_id
      WHERE n.parent_id = $1 ${filter}
      ORDER BY n.created_at DESC
      LIMIT 50`,
    params,
  )
  return result.rows
}

export async function parentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole(['parent']))

  app.get('/parent/children', async (request) => {
    const parent = request.user as AuthUser
    const result = await query<ChildRow>(
      `WITH ${LATEST_PRESENCE_CTE}
       SELECT u.id, u.external_id AS usn, u.full_name AS name, u.level, u.class_label,
              u.section, u.programme, pl.relationship,
              l.direction, l.method, l.occurred_at,
              l.checkpoint_code, l.checkpoint_name, l.zone,
              c.card_uid, c.status AS card_status, c.battery, c.last_sync_at, c.valid_to,
              c.nfc_uid, c.uhf_tag_id
         FROM parent_links pl
         JOIN app_users u ON u.id = pl.student_id
         LEFT JOIN cards c ON c.student_id = u.id
         LEFT JOIN latest l ON l.student_id = u.id
        WHERE pl.parent_id = $1
          AND u.role = 'student'
          AND u.active = true
        ORDER BY u.full_name`,
      [parent.id],
    )

    const payload = { children: result.rows.map(childView) }
    assertNoRiskFields(payload)
    return payload
  })

  app.get<{ Params: { usn: string } }>('/parent/children/:usn', async (request) => {
    const parent = request.user as AuthUser
    const child = await linkedChild(parent.id, request.params.usn)

    const [events, alerts] = await Promise.all([
      query<EventRow>(
        `SELECT e.id, c.code AS checkpoint_code, c.name AS checkpoint_name, c.zone,
                e.direction, e.method, e.occurred_at
           FROM presence_events e
           JOIN checkpoints c ON c.id = e.checkpoint_id
          WHERE e.student_id = $1
            AND e.occurred_at >= date_trunc('day', now())
          ORDER BY e.occurred_at ASC`,
        [child.id],
      ),
      alertsFor(parent.id, request.params.usn),
    ])

    const payload = {
      child: childView(child),
      events: events.rows.map((row) => ({
        id: row.id,
        checkpoint: {
          code: row.checkpoint_code,
          name: row.checkpoint_name,
          zone: row.zone,
        },
        direction: row.direction,
        method: row.method,
        occurred_at: row.occurred_at.toISOString(),
      })),
      alerts: alerts.slice(0, 12).map(alertView),
    }
    assertNoRiskFields(payload)
    return payload
  })

  app.get('/parent/alerts', async (request) => {
    const parent = request.user as AuthUser
    const rows = await alertsFor(parent.id)
    const payload = {
      alerts: rows.map(alertView),
      summary: {
        total: rows.length,
        sent: rows.filter((row) => row.status === 'sent').length,
        queued: rows.filter((row) => row.status === 'queued').length,
        failed: rows.filter((row) => row.status === 'failed').length,
      },
    }
    assertNoRiskFields(payload)
    return payload
  })
}
