/**
 * Preview data.
 *
 * The app stays usable without the backend: every hook falls back to the
 * sample register in `mock.ts`. These builders turn that sample into the same
 * view models the API adapters produce, so a page never branches on the
 * source of its data.
 */

import {
  campusRisk,
  campusStats,
  cohortRisk,
  demoStudent,
  demoStudentUsn,
  exams,
  feeReceipts,
  globalFeatures,
  loans,
  modelInfo,
  recentCardUpdates,
  recentVerifications,
  sessions,
  studentByUsn,
  students,
  watchlist,
} from './mock'
import { initials } from '../api/adapters'
import type {
  AdminOverviewView,
  CohortView,
  InsightsView,
  MeView,
  RecentUpdate,
  RiskView,
  StudentRow,
  VerificationItem,
  VerificationSummaryView,
  VerificationView,
  WatchItem,
} from './views'
import type { Student } from '../types'

export const MODEL_VERSION = 'catboost-cutoff60-20261126065719'

const previewHourly = [
  { label: '08', value: 412 },
  { label: '09', value: 1184 },
  { label: '10', value: 932 },
  { label: '11', value: 688 },
  { label: '12', value: 344 },
  { label: '13', value: 512 },
  { label: '14', value: 764 },
  { label: '15', value: 421 },
]

const previewReaders = [
  { id: 'GATE 01', place: 'Main gate', median: 0.62, state: 'Online' as const },
  { id: 'GATE 02', place: 'Main gate', median: 0.78, state: 'Online' as const },
  { id: 'LIB 02', place: 'Library desk', median: 0.69, state: 'Online' as const },
  { id: 'CSE 03', place: 'Block C lab', median: 0.74, state: 'Online' as const },
  { id: 'EXAM 01', place: 'Exam hall', median: 1.08, state: 'Degraded' as const },
]

export function previewRisk(): RiskView {
  return {
    support: campusRisk.support,
    watch: campusRisk.watch,
    onTrack: campusRisk.onTrack,
    total: campusRisk.total,
    modelVersion: MODEL_VERSION,
    cutoffDay: modelInfo.cutoffDay,
  }
}

export function previewStudentRow(student: Student): StudentRow {
  return {
    usn: student.usn,
    name: student.name,
    initials: student.initials,
    programme: student.programme,
    semester: student.semester,
    section: student.section,
    mentor: student.mentor,
    card: student.card,
    risk: student.risk,
    probability: student.probability,
    moduleRef: null,
  }
}

export function previewStudentRows(): StudentRow[] {
  return students.map(previewStudentRow)
}

export function previewWatchlist(): WatchItem[] {
  return watchlist.map((student) => ({
    usn: student.usn,
    name: student.name,
    initials: student.initials,
    semester: student.semester,
    section: student.section,
    mentor: student.mentor,
    risk: student.risk,
    probability: student.probability,
    driver: student.driver,
    moduleRef: null,
  }))
}

export function previewOverview(): AdminOverviewView {
  const updates: RecentUpdate[] = recentCardUpdates.map((update) => {
    const student = studentByUsn.get(update.usn)
    return {
      id: update.id,
      usn: update.usn,
      name: student?.name ?? update.usn,
      initials: student?.initials ?? initials(update.usn),
      cardId: student?.card.id ?? '—',
      change: update.change,
      time: update.time,
      state: update.state,
    }
  })

  const checks: VerificationItem[] = recentVerifications.map((item) => {
    const student = studentByUsn.get(item.usn)
    const name = student?.name ?? item.usn
    return {
      ...item,
      name,
      initials: student?.initials ?? initials(item.usn),
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    campus: {
      students: campusStats.students,
      activeCards: campusStats.activeCards,
      cardsInSync: 408,
      lowBattery: 293,
      revoked: 71,
      awaitingSync: campusStats.awaitingSync,
      verificationsToday: campusStats.verificationsToday,
      rejectedToday: campusStats.rejected,
      acceptanceRate: campusStats.successRate,
      sessionsOpen: 1,
    },
    risk: previewRisk(),
    recentUpdates: updates,
    recentVerifications: checks,
    attention: students
      .filter((student) => student.card.status !== 'active')
      .map(previewStudentRow),
  }
}

export function previewInsights(): InsightsView {
  return {
    modelInfo: { ...modelInfo },
    risk: previewRisk(),
    globalFeatures: globalFeatures.map((feature) => ({ ...feature })),
    watchlist: previewWatchlist(),
  }
}

export function previewCohort(): CohortView {
  return {
    students: cohortRisk.total,
    support: cohortRisk.support,
    watch: cohortRisk.watch,
    onTrack: cohortRisk.onTrack,
    interventions30d: 14,
    watchlist: previewWatchlist(),
    sessions: sessions.map((session) => ({ ...session })),
  }
}

export function previewVerificationSummary(): VerificationSummaryView {
  return {
    total: campusStats.verificationsToday,
    accepted: campusStats.verificationsToday - campusStats.rejected,
    rejected: campusStats.rejected,
    acceptanceRate: campusStats.successRate,
    medianSeconds: campusStats.medianLatency,
    readersOnline: previewReaders.filter((reader) => reader.state === 'Online').length,
    readers: previewReaders.map((reader) => ({ ...reader })),
    hourly: previewHourly.map((row) => ({ ...row })),
  }
}

export function previewVerifications(filter?: {
  method?: string
  result?: string
  q?: string
}): VerificationView {
  const items: VerificationItem[] = recentVerifications
    .filter((item) => {
      if (filter?.q && item.usn !== filter.q) return false
      if (filter?.result && item.result !== filter.result) return false
      if (filter?.method && item.method !== filter.method) return false
      return true
    })
    .map((item) => {
      const student = studentByUsn.get(item.usn)
      const name = student?.name ?? item.usn
      return { ...item, name, initials: student?.initials ?? initials(item.usn) }
    })

  return { items, total: items.length, page: 1, pages: 1 }
}

export function previewMe(): MeView {
  return {
    student: demoStudent,
    exams: exams.map((exam) => ({ ...exam })),
    loans: loans.map((loan) => ({ ...loan })),
    receipts: feeReceipts.map((receipt) => ({ ...receipt })),
  }
}

export function previewStudent(usn: string): Student | null {
  return studentByUsn.get(usn) ?? null
}

export const previewDemoUsn = demoStudentUsn
