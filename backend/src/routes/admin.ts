import type { FastifyInstance } from 'fastify'

import { query } from '../db.js'
import { getCampusRiskSummary } from '../lib/risk.js'

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole(['admin']))

  app.get('/admin/overview', async () => {
    const [students, cards, verifications, sessions, updates, checks, attention] = await Promise.all([
      query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM app_users WHERE role = 'student' AND active = true`,
      ),
      query<{
        total: number
        active: number
        sync: number
        low_battery: number
        revoked: number
        awaiting_sync: number
      }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                COUNT(*) FILTER (WHERE status = 'sync')::int AS sync,
                COUNT(*) FILTER (WHERE status = 'low-battery')::int AS low_battery,
                COUNT(*) FILTER (WHERE status = 'revoked')::int AS revoked,
                COUNT(*) FILTER (
                  WHERE status <> 'revoked'
                    AND (last_sync_at IS NULL OR last_sync_at < now() - interval '24 hours')
                )::int AS awaiting_sync
           FROM cards`,
      ),
      query<{ total: number; accepted: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE result = 'accepted')::int AS accepted
           FROM verification_events
          WHERE verified_at >= date_trunc('day', now())`,
      ),
      query<{ open: number }>(
        `SELECT COUNT(*) FILTER (WHERE state = 'open')::int AS open FROM attendance_sessions`,
      ),
      query<{
        id: string
        usn: string
        summary: string
        state: string
        change_type: string
        created_at: Date
      }>(
        `SELECT u.id, s.external_id AS usn, u.summary, u.state, u.change_type, u.created_at
           FROM card_updates u JOIN app_users s ON s.id = u.student_id
          ORDER BY u.created_at DESC LIMIT 8`,
      ),
      query<{
        id: string
        usn: string | null
        method: string
        result: string
        reason: string | null
        latency_ms: number | null
        reader_id: string
        verified_at: Date
      }>(
        `SELECT v.id, s.external_id AS usn, v.method, v.result, v.reason, v.latency_ms,
                v.reader_id, v.verified_at
           FROM verification_events v LEFT JOIN app_users s ON s.id = v.student_id
          ORDER BY v.verified_at DESC LIMIT 8`,
      ),
      query<{
        id: string
        usn: string
        card_uid: string
        status: string
        battery: number | null
        last_sync_at: Date | null
        valid_to: Date
      }>(
        `SELECT c.id, u.external_id AS usn, c.card_uid, c.status, c.battery,
                c.last_sync_at, c.valid_to
           FROM cards c JOIN app_users u ON u.id = c.student_id
          WHERE c.status IN ('low-battery', 'sync')
             OR (c.status <> 'revoked' AND (c.last_sync_at IS NULL OR c.last_sync_at < now() - interval '24 hours'))
          ORDER BY c.battery ASC NULLS LAST, c.last_sync_at ASC NULLS LAST
          LIMIT 8`,
      ),
    ])

    const risk = await getCampusRiskSummary()
    const verificationRow = verifications.rows[0]

    return {
      generated_at: new Date().toISOString(),
      campus: {
        students: students.rows[0]?.total ?? 0,
        cards: cards.rows[0] ?? {
          total: 0,
          active: 0,
          sync: 0,
          low_battery: 0,
          revoked: 0,
          awaiting_sync: 0,
        },
        verifications_today: verificationRow?.total ?? 0,
        verification_acceptance_rate:
          verificationRow && verificationRow.total > 0
            ? Number((verificationRow.accepted / verificationRow.total).toFixed(4))
            : 0,
        sessions_open: sessions.rows[0]?.open ?? 0,
      },
      risk,
      recent_card_updates: updates.rows.map((row) => ({
        id: row.id,
        usn: row.usn,
        change: row.summary,
        change_type: row.change_type,
        state: row.state,
        created_at: row.created_at.toISOString(),
      })),
      recent_verifications: checks.rows.map((row) => ({
        id: row.id,
        usn: row.usn,
        method: row.method,
        result: row.result,
        reason: row.reason,
        latency_ms: row.latency_ms,
        reader: row.reader_id,
        verified_at: row.verified_at.toISOString(),
      })),
      attention_cards: attention.rows.map((row) => ({
        card_id: row.id,
        usn: row.usn,
        card_uid: row.card_uid,
        status: row.status,
        battery: row.battery,
        last_sync_at: row.last_sync_at ? row.last_sync_at.toISOString() : null,
        valid_to: row.valid_to.toISOString(),
      })),
    }
  })
}
