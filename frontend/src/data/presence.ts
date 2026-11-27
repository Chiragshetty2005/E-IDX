/**
 * Preview presence data.
 *
 * The demo must stay usable without the backend, so the parent portal and the
 * staff presence screen ship with a sample checkpoint log. The school pilot
 * mirrors the seeded register: 24 children, one guardian pair each and the
 * same morning pattern (bus, gate, classroom, then the library or canteen).
 */

import { formatClock } from '../api/adapters'
import type {
  ParentAlertDto,
  ParentAlertsDto,
  ParentChildDetailDto,
  ParentChildDto,
  ParentChildrenDto,
  PresenceEventDto,
  PresenceOverviewDto,
  PresenceStudentDto,
} from '../api/types'
import type { CheckpointZone, PresenceDirection, PresenceMethod, PresenceState } from '../types'
import { students as collegeStudents } from './mock'

interface PreviewCheckpoint {
  code: string
  name: string
  zone: CheckpointZone
}

const CHECKPOINTS: Record<string, PreviewCheckpoint> = {
  'BUS-01': { code: 'BUS-01', name: 'Bus 01 door', zone: 'bus' },
  'SCHOOL-GATE': { code: 'SCHOOL-GATE', name: 'Junior school gate', zone: 'gate' },
  'CLASS-LKG': { code: 'CLASS-LKG', name: 'LKG classroom', zone: 'classroom' },
  'CLASS-UKG': { code: 'CLASS-UKG', name: 'UKG classroom', zone: 'classroom' },
  'CLASS-G1': { code: 'CLASS-G1', name: 'Grade 1 classroom', zone: 'classroom' },
  'CLASS-G2': { code: 'CLASS-G2', name: 'Grade 2 classroom', zone: 'classroom' },
  'CLASS-G3': { code: 'CLASS-G3', name: 'Grade 3 classroom', zone: 'classroom' },
  'CLASS-G4': { code: 'CLASS-G4', name: 'Grade 4 classroom', zone: 'classroom' },
  'LIB-JR': { code: 'LIB-JR', name: 'Junior library', zone: 'library' },
  'CANTEEN-JR': { code: 'CANTEEN-JR', name: 'Junior canteen', zone: 'canteen' },
  'CAMPUS-GATE': { code: 'CAMPUS-GATE', name: 'Campus main gate', zone: 'gate' },
  'BLOCK-C': { code: 'BLOCK-C', name: 'Block C classroom', zone: 'classroom' },
  'LIB-MAIN': { code: 'LIB-MAIN', name: 'Main library', zone: 'library' },
}

const CLASS_CHECKPOINT: Record<string, string> = {
  LKG: 'CLASS-LKG',
  UKG: 'CLASS-UKG',
  'Grade 1': 'CLASS-G1',
  'Grade 2': 'CLASS-G2',
  'Grade 3': 'CLASS-G3',
  'Grade 4': 'CLASS-G4',
}

interface PreviewChild {
  usn: string
  name: string
  classLabel: string
  guardian: string
  relationship: string
}

const SCHOOL_PILOT: PreviewChild[] = [
  { usn: 'EIDX-S-001', name: 'Aarav Menon', classLabel: 'LKG', guardian: 'Rohit Menon', relationship: 'Father' },
  { usn: 'EIDX-S-002', name: 'Diya Menon', classLabel: 'LKG', guardian: 'Rohit Menon', relationship: 'Father' },
  { usn: 'EIDX-S-003', name: 'Vihaan Rao', classLabel: 'LKG', guardian: 'Sneha Rao', relationship: 'Mother' },
  { usn: 'EIDX-S-004', name: 'Anika Rao', classLabel: 'LKG', guardian: 'Sneha Rao', relationship: 'Mother' },
  { usn: 'EIDX-S-005', name: 'Advik Sharma', classLabel: 'UKG', guardian: 'Pooja Sharma', relationship: 'Mother' },
  { usn: 'EIDX-S-006', name: 'Myra Sharma', classLabel: 'UKG', guardian: 'Pooja Sharma', relationship: 'Mother' },
  { usn: 'EIDX-S-007', name: 'Kabir Iyer', classLabel: 'UKG', guardian: 'Arun Iyer', relationship: 'Father' },
  { usn: 'EIDX-S-008', name: 'Sara Iyer', classLabel: 'UKG', guardian: 'Arun Iyer', relationship: 'Father' },
  { usn: 'EIDX-S-009', name: 'Reyansh Gupta', classLabel: 'Grade 1', guardian: 'Neha Gupta', relationship: 'Mother' },
  { usn: 'EIDX-S-010', name: 'Aadhya Gupta', classLabel: 'Grade 1', guardian: 'Neha Gupta', relationship: 'Mother' },
  { usn: 'EIDX-S-011', name: 'Dhruv Nair', classLabel: 'Grade 1', guardian: 'Suresh Nair', relationship: 'Father' },
  { usn: 'EIDX-S-012', name: 'Kiara Nair', classLabel: 'Grade 1', guardian: 'Suresh Nair', relationship: 'Father' },
  { usn: 'EIDX-S-013', name: 'Arnav Hegde', classLabel: 'Grade 2', guardian: 'Deepa Hegde', relationship: 'Mother' },
  { usn: 'EIDX-S-014', name: 'Ira Hegde', classLabel: 'Grade 2', guardian: 'Deepa Hegde', relationship: 'Mother' },
  { usn: 'EIDX-S-015', name: 'Vivaan Shetty', classLabel: 'Grade 2', guardian: 'Ramesh Shetty', relationship: 'Father' },
  { usn: 'EIDX-S-016', name: 'Anaya Shetty', classLabel: 'Grade 2', guardian: 'Ramesh Shetty', relationship: 'Father' },
  { usn: 'EIDX-S-017', name: 'Ishaan Kamath', classLabel: 'Grade 3', guardian: 'Priya Kamath', relationship: 'Mother' },
  { usn: 'EIDX-S-018', name: 'Naisha Kamath', classLabel: 'Grade 3', guardian: 'Priya Kamath', relationship: 'Mother' },
  { usn: 'EIDX-S-019', name: 'Aryan Gowda', classLabel: 'Grade 3', guardian: 'Manjunath Gowda', relationship: 'Father' },
  { usn: 'EIDX-S-020', name: 'Mysha Gowda', classLabel: 'Grade 3', guardian: 'Manjunath Gowda', relationship: 'Father' },
  { usn: 'EIDX-S-021', name: 'Krish Patel', classLabel: 'Grade 4', guardian: 'Nirav Patel', relationship: 'Father' },
  { usn: 'EIDX-S-022', name: 'Riya Patel', classLabel: 'Grade 4', guardian: 'Nirav Patel', relationship: 'Father' },
  { usn: 'EIDX-S-023', name: 'Ayaan Khan', classLabel: 'Grade 4', guardian: 'Imran Khan', relationship: 'Father' },
  { usn: 'EIDX-S-024', name: 'Zara Khan', classLabel: 'Grade 4', guardian: 'Imran Khan', relationship: 'Father' },
]

interface PreviewEvent {
  code: string
  direction: PresenceDirection
  method: PresenceMethod
  minutesAgo: number
  title: string
}

function schoolEvents(index: number, classLabel: string): PreviewEvent[] {
  const events: PreviewEvent[] = []
  if (index === 23) return events

  events.push({
    code: 'BUS-01',
    direction: 'in',
    method: 'uhf',
    minutesAgo: 390 + index * 3,
    title: 'Bus boarding',
  })
  if (index === 20) return events

  events.push({
    code: 'SCHOOL-GATE',
    direction: 'in',
    method: 'uhf',
    minutesAgo: 355 + index * 3,
    title: 'School arrival',
  })
  events.push({
    code: CLASS_CHECKPOINT[classLabel] as string,
    direction: 'in',
    method: 'uhf',
    minutesAgo: 320 + index * 3,
    title: 'Classroom entry',
  })
  if (index % 5 === 0) {
    events.push({
      code: 'LIB-JR',
      direction: 'in',
      method: 'uhf',
      minutesAgo: 150 + (index % 4) * 7,
      title: 'Library check-in',
    })
  }
  if (index % 7 === 0) {
    events.push({
      code: 'CANTEEN-JR',
      direction: 'in',
      method: 'uhf',
      minutesAgo: 95 + (index % 3) * 6,
      title: 'Canteen check-in',
    })
  }
  if (index >= 21) {
    events.push({
      code: 'SCHOOL-GATE',
      direction: 'out',
      method: 'uhf',
      minutesAgo: index === 21 ? 70 : 48,
      title: 'Campus departure',
    })
  }
  return events
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000)
}

function stateOf(events: PreviewEvent[]): { state: PresenceState; label: string } {
  const last = events[events.length - 1]
  if (!last) return { state: 'not-arrived', label: 'Not arrived' }
  if (last.direction === 'out') return { state: 'left', label: 'Left campus' }
  if (CHECKPOINTS[last.code]?.zone === 'bus') return { state: 'on-bus', label: 'On the bus' }
  return { state: 'on-campus', label: 'On campus' }
}

function messageFor(child: PreviewChild, event: PreviewEvent, at: Date): string {
  const first = child.name.split(' ')[0] ?? child.name
  const time = formatClock(at.toISOString())
  const checkpoint = CHECKPOINTS[event.code]
  switch (checkpoint?.zone) {
    case 'bus':
      return `${first} boarded ${checkpoint.name} at ${time}.`
    case 'gate':
      return event.direction === 'in'
        ? `${first} reached school at ${time}.`
        : `${first} left campus at ${time}.`
    case 'classroom':
      return `${first} entered ${checkpoint.name} at ${time}.`
    case 'library':
      return `${first} checked in at ${checkpoint.name} at ${time}.`
    default:
      return `${first} checked in at ${checkpoint?.name ?? 'campus'} at ${time}.`
  }
}

interface ChildPreview {
  child: PreviewChild
  index: number
  events: PreviewEvent[]
}

const schoolPreviews: ChildPreview[] = SCHOOL_PILOT.map((child, index) => ({
  child,
  index,
  events: schoolEvents(index, child.classLabel),
}))

function schoolStudentRows(): PresenceStudentDto[] {
  return schoolPreviews.map(({ child, events }) => {
    const state = stateOf(events)
    const last = events[events.length - 1]
    const checkpoint = last ? CHECKPOINTS[last.code] : undefined
    return {
      usn: child.usn,
      name: child.name,
      level: 'school',
      class_label: child.classLabel,
      section: `${child.classLabel} A`,
      state: state.state,
      state_label: state.label,
      checkpoint: checkpoint
        ? { code: checkpoint.code, name: checkpoint.name, zone: checkpoint.zone }
        : null,
      direction: last?.direction ?? null,
      method: last?.method ?? null,
      occurred_at: last ? minutesAgo(last.minutesAgo).toISOString() : null,
      guardian: child.guardian,
    }
  })
}

function schoolEventFeed(): PresenceEventDto[] {
  const feed: PresenceEventDto[] = []
  schoolPreviews.forEach(({ child, events }) => {
    events.forEach((event, position) => {
      const checkpoint = CHECKPOINTS[event.code]
      if (!checkpoint) return
      feed.push({
        id: `preview-${child.usn}-${position}`,
        usn: child.usn,
        name: child.name,
        checkpoint: { code: checkpoint.code, name: checkpoint.name, zone: checkpoint.zone },
        direction: event.direction,
        method: event.method,
        source: 'seed',
        occurred_at: minutesAgo(event.minutesAgo).toISOString(),
        notifications: 2,
      })
    })
  })
  return feed.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 30)
}

export function previewPresenceOverview(level: 'school' | 'college'): PresenceOverviewDto {
  if (level === 'college') {
    const rows: PresenceStudentDto[] = collegeStudents.map((student, index) => {
      const left = index === 2 || index === 7
      const absent = index === 10
      const checkpoint = CHECKPOINTS['CAMPUS-GATE'] as PreviewCheckpoint
      return {
        usn: student.usn,
        name: student.name,
        level: 'college',
        class_label: null,
        section: student.section,
        state: absent ? 'not-arrived' : left ? 'left' : 'on-campus',
        state_label: absent ? 'Not arrived' : left ? 'Left campus' : 'On campus',
        checkpoint: absent ? null : { code: checkpoint.code, name: checkpoint.name, zone: checkpoint.zone },
        direction: absent ? null : left ? 'out' : 'in',
        method: absent ? null : 'uhf',
        occurred_at: absent ? null : minutesAgo(280 + index * 7).toISOString(),
        guardian: null,
      }
    })
    const events: PresenceEventDto[] = rows
      .filter((row) => row.occurred_at !== null)
      .map((row, index) => ({
        id: `preview-college-${index}`,
        usn: row.usn,
        name: row.name,
        checkpoint: row.checkpoint ?? {
          code: 'CAMPUS-GATE',
          name: 'Campus main gate',
          zone: 'gate',
        },
        direction: row.direction ?? 'in',
        method: row.method ?? 'uhf',
        source: 'seed',
        occurred_at: row.occurred_at ?? minutesAgo(200).toISOString(),
        notifications: 0,
      }))

    return {
      generated_at: new Date().toISOString(),
      scope: { level: 'college', label: 'College campus', section: null },
      summary: {
        expected: rows.length,
        on_campus: rows.filter((row) => row.state === 'on-campus').length,
        on_bus: 0,
        left_campus: rows.filter((row) => row.state === 'left').length,
        not_arrived: rows.filter((row) => row.state === 'not-arrived').length,
        alerts_today: 0,
        last_event_at: events[0]?.occurred_at ?? null,
      },
      zones: [{ zone: 'gate', count: rows.filter((row) => row.state === 'on-campus').length }],
      students: rows,
      events: events.slice(0, 30),
      headcount: {
        expected: rows.length,
        present: rows.filter((row) => row.state === 'on-campus').length,
        by_class: [
          {
            label: 'Section A',
            expected: rows.length,
            present: rows.filter((row) => row.state === 'on-campus').length,
          },
        ],
      },
      checkpoints: Object.values(CHECKPOINTS)
        .filter((checkpoint) => checkpoint.code !== 'BUS-01' && checkpoint.code !== 'SCHOOL-GATE' && !checkpoint.code.startsWith('CLASS-') && checkpoint.code !== 'LIB-JR' && checkpoint.code !== 'CANTEEN-JR')
        .map((checkpoint) => ({ ...checkpoint, level: 'college' as const })),
    }
  }

  const students = schoolStudentRows()
  const events = schoolEventFeed()
  const zoneCounts = new Map<CheckpointZone, number>()
  students.forEach((row) => {
    if (!row.checkpoint) return
    zoneCounts.set(row.checkpoint.zone, (zoneCounts.get(row.checkpoint.zone) ?? 0) + 1)
  })

  const byClass = SCHOOL_CLASSES_PREVIEW.map((label) => {
    const rows = students.filter((row) => row.class_label === label)
    return {
      label,
      expected: rows.length,
      present: rows.filter((row) => row.state === 'on-campus').length,
    }
  })

  return {
    generated_at: new Date().toISOString(),
    scope: { level: 'school', label: 'School pilot', section: null },
    summary: {
      expected: students.length,
      on_campus: students.filter((row) => row.state === 'on-campus').length,
      on_bus: students.filter((row) => row.state === 'on-bus').length,
      left_campus: students.filter((row) => row.state === 'left').length,
      not_arrived: students.filter((row) => row.state === 'not-arrived').length,
      alerts_today: events.length * 2,
      last_event_at: events[0]?.occurred_at ?? null,
    },
    zones: Array.from(zoneCounts.entries()).map(([zone, count]) => ({ zone, count })),
    students,
    events,
    headcount: {
      expected: students.length,
      present: students.filter((row) => row.state === 'on-campus').length,
      by_class: byClass,
    },
    checkpoints: Object.values(CHECKPOINTS)
      .filter((checkpoint) =>
        ['BUS-01', 'SCHOOL-GATE', 'LIB-JR', 'CANTEEN-JR'].includes(checkpoint.code) ||
        checkpoint.code.startsWith('CLASS-'),
      )
      .map((checkpoint) => ({ ...checkpoint, level: 'school' as const })),
  }
}

const SCHOOL_CLASSES_PREVIEW = ['LKG', 'UKG', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4']

const PREVIEW_PARENT = 'Rohit Menon'

function parentChildrenRows(): ParentChildDto[] {
  return schoolPreviews
    .filter(({ child }) => child.guardian === PREVIEW_PARENT)
    .map(({ child, events }) => {
      const state = stateOf(events)
      const last = events[events.length - 1]
      const checkpoint = last ? CHECKPOINTS[last.code] : undefined
      return {
        usn: child.usn,
        name: child.name,
        level: 'school',
        class_label: child.classLabel,
        section: `${child.classLabel} A`,
        programme: 'Primary school',
        relationship: child.relationship,
        presence: {
          state: state.state,
          state_label: state.label,
          checkpoint: checkpoint
            ? { code: checkpoint.code, name: checkpoint.name, zone: checkpoint.zone }
            : null,
          direction: last?.direction ?? null,
          method: last?.method ?? null,
          occurred_at: last ? minutesAgo(last.minutesAgo).toISOString() : null,
        },
        card: {
          card_uid: child.usn,
          status: 'active',
          battery: 86,
          last_sync_at: minutesAgo(6).toISOString(),
          valid_to: '2027-06-30T23:59:59.000Z',
          nfc_uid: `NFC-S-${child.usn.slice(-3)}`,
          uhf_tag_id: `UHF-7F3A-S${child.usn.slice(-2)}`,
        },
      }
    })
}

function parentAlertRows(): ParentAlertDto[] {
  const alerts: ParentAlertDto[] = []
  schoolPreviews
    .filter(({ child }) => child.guardian === PREVIEW_PARENT)
    .forEach(({ child, events }) => {
      events.forEach((event, index) => {
        const checkpoint = CHECKPOINTS[event.code]
        if (!checkpoint) return
        const at = minutesAgo(event.minutesAgo)
        ;(['push', 'sms'] as const).forEach((channel) => {
          alerts.push({
            id: `preview-alert-${child.usn}-${index}-${channel}`,
            student: { usn: child.usn, name: child.name },
            channel,
            status: channel === 'push' || index % 4 !== 0 ? 'sent' : 'queued',
            title: event.title,
            message: messageFor(child, event, at),
            created_at: at.toISOString(),
            sent_at: channel === 'push' ? new Date(at.getTime() + 4000).toISOString() : null,
            checkpoint: { code: checkpoint.code, name: checkpoint.name, zone: checkpoint.zone },
          })
        })
      })
    })
  return alerts.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function previewParentChildren(): ParentChildrenDto {
  return { children: parentChildrenRows() }
}

export function previewParentChild(usn: string): ParentChildDetailDto | null {
  const child = parentChildrenRows().find((row) => row.usn === usn)
  if (!child) return null
  const preview = schoolPreviews.find((row) => row.child.usn === usn)
  const events = (preview?.events ?? []).map((event, index) => {
    const checkpoint = CHECKPOINTS[event.code]
    return {
      id: `preview-event-${usn}-${index}`,
      checkpoint: {
        code: checkpoint?.code ?? event.code,
        name: checkpoint?.name ?? event.code,
        zone: checkpoint?.zone ?? 'gate',
      },
      direction: event.direction,
      method: event.method,
      occurred_at: minutesAgo(event.minutesAgo).toISOString(),
    }
  })
  return {
    child,
    events,
    alerts: parentAlertRows().filter((alert) => alert.student.usn === usn),
  }
}

export function previewParentAlerts(): ParentAlertsDto {
  const alerts = parentAlertRows()
  return {
    alerts,
    summary: {
      total: alerts.length,
      sent: alerts.filter((alert) => alert.status === 'sent').length,
      queued: alerts.filter((alert) => alert.status === 'queued').length,
      failed: alerts.filter((alert) => alert.status === 'failed').length,
    },
  }
}
