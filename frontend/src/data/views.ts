import type {
  Card,
  Intervention,
  RiskLevel,
  Session,
  ShapFeature,
  Student,
  StudentProfile,
  Verification,
} from '../types'

/** A light row for the admin register. The drawer fetches the full record. */
export interface StudentRow {
  usn: string
  name: string
  initials: string
  programme: string
  semester: string
  section: string
  mentor: string
  card: Card
  risk: RiskLevel
  probability: number
  moduleRef: string | null
}

export interface RecentUpdate {
  id: string
  usn: string
  name: string
  initials: string
  cardId: string
  change: string
  time: string
  state: 'queued' | 'confirmed'
}

export interface VerificationItem extends Verification {
  name: string
  initials: string
}

export interface RiskView {
  support: number
  watch: number
  onTrack: number
  total: number
  modelVersion: string | null
  cutoffDay: number | null
}

export interface AdminOverviewView {
  generatedAt: string
  campus: {
    students: number
    activeCards: number
    cardsInSync: number
    lowBattery: number
    revoked: number
    awaitingSync: number
    verificationsToday: number
    rejectedToday: number
    acceptanceRate: number
    sessionsOpen: number
  }
  risk: RiskView
  recentUpdates: RecentUpdate[]
  recentVerifications: VerificationItem[]
  attention: StudentRow[]
}

export interface WatchItem {
  usn: string
  name: string
  initials: string
  semester: string
  section: string
  mentor: string
  risk: RiskLevel
  probability: number
  driver: string
  moduleRef: string | null
}

export interface ModelInfoView {
  name: string
  build: string
  trained: string
  records: number
  students: number
  features: number
  cutoffDay: number
  rocAuc: number
  prAuc: number
  atRiskRecall: number
  temporalRocAuc: number
  brier: number
}

export interface InsightsView {
  modelInfo: ModelInfoView
  risk: RiskView
  globalFeatures: ShapFeature[]
  watchlist: WatchItem[]
}

export interface CohortView {
  students: number
  support: number
  watch: number
  onTrack: number
  interventions30d: number
  watchlist: WatchItem[]
  sessions: Session[]
}

export interface VerificationSummaryView {
  total: number
  accepted: number
  rejected: number
  acceptanceRate: number
  medianSeconds: number | null
  readersOnline: number
  readers: Array<{
    id: string
    place: string
    median: number
    state: 'Online' | 'Degraded'
  }>
  hourly: Array<{ label: string; value: number }>
}

export interface VerificationView {
  items: VerificationItem[]
  total: number
  page: number
  pages: number
}

export interface StudentSupportView {
  student: Student
  notes: Intervention[]
  shap: ShapFeature[]
}

export interface MeView {
  student: StudentProfile
  exams: Array<{ code: string; title: string; date: string; time: string; hall: string }>
  loans: Array<{ title: string; due: string; status: string }>
  receipts: Array<{
    term: string
    amount: string
    paidOn: string
    receipt: string
    status: string
  }>
}
