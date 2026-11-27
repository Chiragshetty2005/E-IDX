import type {
  Card,
  CampusLevel,
  CheckpointZone,
  Intervention,
  PresenceDirection,
  PresenceMethod,
  PresenceState,
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
  level: CampusLevel
  classLabel: string | null
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
  presence: {
    state: PresenceState
    stateLabel: string
    checkpoint: CheckpointView | null
    time: string
  } | null
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

export interface CheckpointView {
  code: string
  name: string
  zone: CheckpointZone
  level: CampusLevel
}

export interface PresenceStudentView {
  usn: string
  name: string
  initials: string
  level: CampusLevel
  classLabel: string | null
  section: string | null
  state: PresenceState
  stateLabel: string
  checkpoint: CheckpointView | null
  direction: PresenceDirection | null
  method: PresenceMethod | null
  time: string
  guardian: string | null
}

export interface PresenceEventView {
  id: string
  usn: string
  name: string
  initials: string
  checkpoint: CheckpointView
  direction: PresenceDirection
  method: PresenceMethod
  source: string
  time: string
  notifications: number
}

export interface PresenceOverviewView {
  generatedAt: string
  scope: { level: CampusLevel; label: string; section: string | null }
  summary: {
    expected: number
    onCampus: number
    onBus: number
    leftCampus: number
    notArrived: number
    alertsToday: number
    lastEventAt: string | null
  }
  zones: Array<{ zone: CheckpointZone; label: string; count: number }>
  students: PresenceStudentView[]
  events: PresenceEventView[]
  headcount: {
    expected: number
    present: number
    byClass: Array<{ label: string; expected: number; present: number }>
  }
  checkpoints: CheckpointView[]
}

export interface ParentChildView {
  usn: string
  name: string
  initials: string
  classLabel: string | null
  section: string | null
  relationship: string
  state: PresenceState
  stateLabel: string
  checkpoint: CheckpointView | null
  time: string
  card: {
    id: string
    status: Card['status']
    battery: number
    lastSync: string
    validTo: string
    nfcUid: string
    uhfTagId: string
  } | null
}

export interface ParentAlertView {
  id: string
  student: { usn: string; name: string; initials: string }
  channel: 'push' | 'sms'
  status: 'sent' | 'queued' | 'failed'
  title: string
  message: string
  time: string
  checkpoint: CheckpointView | null
}

export interface ParentChildrenView {
  children: ParentChildView[]
}

export interface ParentChildDetailView {
  child: ParentChildView
  events: Array<{
    id: string
    checkpoint: CheckpointView
    direction: PresenceDirection
    method: PresenceMethod
    time: string
  }>
  alerts: ParentAlertView[]
}

export interface ParentAlertsView {
  alerts: ParentAlertView[]
  summary: { total: number; sent: number; queued: number; failed: number }
}
