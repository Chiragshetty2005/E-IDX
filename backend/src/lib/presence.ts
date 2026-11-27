/**
 * Presence vocabulary shared by the staff presence screen and the parent
 * portal. The database stores raw checkpoint reads; the labels below turn the
 * latest read into the sentence a person sees.
 */

export type PresenceLevel = 'school' | 'college'
export type CheckpointZone = 'bus' | 'gate' | 'classroom' | 'library' | 'canteen'
export type PresenceDirection = 'in' | 'out'
export type PresenceMethod = 'uhf' | 'qr' | 'nfc'
export type PresenceState = 'on-campus' | 'on-bus' | 'left' | 'not-arrived'

export interface LatestPresenceRow {
  direction: PresenceDirection | null
  zone: CheckpointZone | null
  checkpoint_code: string | null
  checkpoint_name: string | null
  method: PresenceMethod | null
  occurred_at: Date | null
}

export interface PresenceStateView {
  state: PresenceState
  label: string
}

export function presenceState(row: LatestPresenceRow): PresenceStateView {
  if (!row.direction) return { state: 'not-arrived', label: 'Not arrived' }
  if (row.direction === 'out') return { state: 'left', label: 'Left campus' }
  if (row.zone === 'bus') return { state: 'on-bus', label: 'On the bus' }
  return { state: 'on-campus', label: 'On campus' }
}

export function zoneLabel(zone: CheckpointZone): string {
  const labels: Record<CheckpointZone, string> = {
    bus: 'Bus',
    gate: 'Gate',
    classroom: 'Classroom',
    library: 'Library',
    canteen: 'Canteen',
  }
  return labels[zone]
}

/** A parent-facing sentence for a checkpoint read. */
export function notificationCopy(
  studentName: string,
  checkpoint: { name: string; zone: CheckpointZone },
  direction: PresenceDirection,
  occurredAt: Date,
): { title: string; message: string } {
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(occurredAt)

  const first = studentName.split(' ')[0] ?? studentName

  if (checkpoint.zone === 'bus') {
    return direction === 'in'
      ? { title: 'Bus boarding', message: `${first} boarded ${checkpoint.name} at ${time}.` }
      : { title: 'Bus drop-off', message: `${first} got off ${checkpoint.name} at ${time}.` }
  }

  if (checkpoint.zone === 'gate') {
    return direction === 'in'
      ? { title: 'School arrival', message: `${first} reached school at ${time}.` }
      : { title: 'Campus departure', message: `${first} left campus at ${time}.` }
  }

  if (checkpoint.zone === 'classroom') {
    return direction === 'in'
      ? { title: 'Classroom entry', message: `${first} entered ${checkpoint.name} at ${time}.` }
      : { title: 'Classroom exit', message: `${first} left ${checkpoint.name} at ${time}.` }
  }

  if (checkpoint.zone === 'library') {
    return direction === 'in'
      ? { title: 'Library check-in', message: `${first} checked in at ${checkpoint.name} at ${time}.` }
      : { title: 'Library check-out', message: `${first} checked out of ${checkpoint.name} at ${time}.` }
  }

  return direction === 'in'
    ? { title: 'Canteen check-in', message: `${first} checked in at ${checkpoint.name} at ${time}.` }
    : { title: 'Canteen check-out', message: `${first} left ${checkpoint.name} at ${time}.` }
}

/** SQL fragment: the most recent read today for each student. */
export const LATEST_PRESENCE_CTE = `
  latest AS (
    SELECT DISTINCT ON (e.student_id)
           e.student_id, e.direction, e.method, e.occurred_at,
           c.code AS checkpoint_code, c.name AS checkpoint_name, c.zone
      FROM presence_events e
      JOIN checkpoints c ON c.id = e.checkpoint_id
     WHERE e.occurred_at >= date_trunc('day', now())
     ORDER BY e.student_id, e.occurred_at DESC, e.created_at DESC
  )
`
