/**
 * Wire types for the E-IDX API.
 *
 * These mirror `backend/src/routes/*` exactly (snake_case included) so the
 * adapters, not the pages, deal with the server's vocabulary. Pages keep using
 * the view models in `src/types.ts`.
 */

import type {
  CardStatus,
  CampusLevel,
  CheckpointZone,
  PresenceDirection,
  PresenceMethod,
  PresenceState,
  RiskLevel,
  VerificationMethod,
  VerificationResult,
} from '../types'

export interface SessionUserDto {
  usn: string | null
  name: string
  email: string | null
  role: 'admin' | 'faculty' | 'parent' | 'student'
  level: CampusLevel
  class_label: string | null
  programme: string | null
  semester: string | null
  section: string | null
}

export interface SessionDto {
  user: SessionUserDto
  permissions: string[]
}

export interface CardDto {
  card_id: string
  card_uid: string
  status: CardStatus
  battery: number | null
  firmware: string
  valid_from: string
  valid_to: string
  last_sync_at: string | null
  revoked_at: string | null
  revoke_reason: string | null
  nfc_uid: string | null
  uhf_tag_id: string | null
}

export interface RiskDriverDto {
  feature: string
  label: string
  group: string
  value: number | null
  display: string | null
  shap_value: number
  direction: 'increases-risk' | 'reduces-risk'
}

export interface RiskPredictionDto {
  model_version: string
  cutoff_day: number
  generated_at: string
  student_ref?: string
  module_ref?: string
  risk_probability: number
  risk_tier: RiskLevel
  drivers: RiskDriverDto[]
}

export interface CampusRiskDto {
  support: number
  watch: number
  on_track: number
  total: number
  model_version: string | null
  cutoff_day: number | null
  generated_at: string | null
}

export interface AdminOverviewDto {
  generated_at: string
  campus: {
    students: number
    cards: {
      total: number
      active: number
      sync: number
      low_battery: number
      revoked: number
      awaiting_sync: number
    }
    verifications_today: number
    verifications_rejected_today: number
    verification_acceptance_rate: number
    sessions_open: number
  }
  risk: CampusRiskDto
  recent_card_updates: Array<{
    id: string
    usn: string
    name: string
    card_uid: string
    change: string
    change_type: string
    state: string
    created_at: string
  }>
  recent_verifications: Array<{
    id: string
    usn: string | null
    name: string | null
    method: VerificationMethod
    result: VerificationResult
    reason: string | null
    latency_ms: number | null
    reader: string
    location: string | null
    verified_at: string
  }>
  attention_cards: Array<{
    card_id: string
    usn: string
    name: string
    card_uid: string
    status: CardStatus
    battery: number | null
    last_sync_at: string | null
    valid_to: string
  }>
}

export interface StudentListDto {
  students: Array<{
    usn: string
    name: string
    level: CampusLevel
    class_label: string | null
    programme: string | null
    semester: string | null
    section: string | null
    mentor: string | null
    card: {
      card_uid: string
      status: CardStatus
      battery: number | null
      last_sync_at: string | null
      valid_to: string | null
    } | null
    risk: {
      tier: RiskLevel
      probability: number
      module_ref: string | null
    } | null
  }>
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface StudentDetailDto {
  student: {
    usn: string
    name: string
    email: string | null
    level: CampusLevel
    class_label: string | null
    programme: string | null
    semester: string | null
    section: string | null
    mentor: string | null
    academics: {
      cgpa: number
      backlogs: number
      internal_marks: number
      internal_max: number
      assignment_rate: number
      library_visits: number
      sgpa: Array<{ term: string; value: number }>
    }
    courses: Array<{ course_code: string; course_title: string | null; credits: number | null }>
    attendance: Array<{
      course_code: string
      held: number
      attended: number
      percent: number
    }>
    card: CardDto | null
    interventions: Array<{
      id: string
      note: string
      source: string
      by: string
      created_at: string
    }>
  }
  risk: RiskPredictionDto[]
}

export interface CardUpdateDto {
  update: {
    id: string
    state: string
    created_at: string
    idempotent_replay: boolean
  }
}

export interface CohortDto {
  totals: {
    students: number
    support: number
    watch: number
    on_track: number
    interventions_last_30_days: number
  }
  students: Array<{
    usn: string
    name: string
    programme: string | null
    semester: string | null
    section: string | null
    mentor: string | null
    risk_tier: RiskLevel
    risk_probability: number
    module_ref: string | null
    top_driver: string | null
    top_driver_direction: string | null
    generated_at: string
    last_intervention: { note: string; created_at: string | null } | null
  }>
}

export interface FacultyStudentDto {
  student: { usn: string; name: string }
  notes: Array<{
    id: string
    note: string
    source: string
    by: string
    created_at: string
  }>
  risk: RiskPredictionDto[]
}

export interface InterventionDto {
  intervention: {
    id: string
    note: string
    source: string
    by: string
    created_at: string
  }
}

export interface VerificationListDto {
  verifications: Array<{
    id: string
    usn: string | null
    name: string | null
    method: VerificationMethod
    result: VerificationResult
    reason: string | null
    latency_ms: number | null
    reader: string
    location: string | null
    verified_at: string
  }>
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface VerificationSummaryDto {
  summary: {
    total: number
    accepted: number
    rejected: number
    median_seconds: number | null
  }
  readers: Array<{
    id: string
    location: string
    state: 'Online' | 'Offline'
    median_seconds: number | null
    checks: number
  }>
  hourly: Array<{ hour: number; total: number }>
}

export interface SessionDtoApi {
  id: string
  course_code: string
  title: string
  room: string | null
  starts_at: string
  ends_at: string
  state: 'open' | 'closed' | 'upcoming'
  total_expected: number
  present: number
}

export interface SessionListDto {
  sessions: SessionDtoApi[]
}

export interface InsightsRiskDto {
  generated_at: string
  tiers: Record<RiskLevel, { count: number; share: number }>
  total: number
  model_version: string
  cutoff_day: number
  scored_at: string
  driver_groups: Array<{ group: string; share: number }>
  thresholds: { needs_support: number; watch: number } | null
}

export interface InsightsModelDto {
  model: {
    version: string
    created_at: string | null
    cutoff_day: number
    dataset_rows: number
    student_count: number | null
    feature_count: number
    at_risk_rate: number
    brier: number | null
    metrics: {
      cross_validation_auc: number
      cross_validation_pr_auc: number
      recall_at_20pct: number
      temporal_test_auc: number
      temporal_test_pr_auc: number
    }
  } | null
}

export interface CampusPassDto {
  pass: {
    token: string
    expires_at: string
  }
}

export interface MeAttendanceDto {
  courses: Array<{
    code: string
    title: string
    held: number
    attended: number
    percent: number
  }>
  overall: { held: number; attended: number; percent: number }
}

export interface MeAcademicsDto {
  academics: {
    cgpa: number
    backlogs: number
    internal_marks: number
    internal_max: number
    assignment_rate: number
    library_visits: number
    sgpa: Array<{ term: string; value: number }>
  }
}

export interface MeLibraryDto {
  loans: Array<{ title: string; issued_at: string; due_at: string; status: string }>
}

export interface MeExamsDto {
  exams: Array<{
    course_code: string
    title: string
    starts_at: string
    duration_minutes: number
    hall: string | null
  }>
}

export interface MeFeesDto {
  receipts: Array<{
    term: string
    amount: number
    paid_on: string
    receipt_no: string
    status: string
  }>
}

export interface MePresenceDto {
  presence: {
    state: PresenceState
    state_label: string
    checkpoint: { code: string; name: string; zone: CheckpointZone } | null
    method: PresenceMethod | null
    occurred_at: string | null
  } | null
}

export interface CheckpointDto {
  code: string
  name: string
  zone: CheckpointZone
  level: CampusLevel
}

export interface PresenceStudentDto {
  usn: string
  name: string
  level: CampusLevel
  class_label: string | null
  section: string | null
  state: PresenceState
  state_label: string
  checkpoint: { code: string; name: string; zone: CheckpointZone } | null
  direction: PresenceDirection | null
  method: PresenceMethod | null
  occurred_at: string | null
  guardian: string | null
}

export interface PresenceEventDto {
  id: string
  usn: string
  name: string
  checkpoint: { code: string; name: string; zone: CheckpointZone }
  direction: PresenceDirection
  method: PresenceMethod
  source: string
  occurred_at: string
  notifications: number
}

export interface PresenceOverviewDto {
  generated_at: string
  scope: {
    level: CampusLevel
    label: string
    section: string | null
  }
  summary: {
    expected: number
    on_campus: number
    on_bus: number
    left_campus: number
    not_arrived: number
    alerts_today: number
    last_event_at: string | null
  }
  zones: Array<{ zone: CheckpointZone; count: number }>
  students: PresenceStudentDto[]
  events: PresenceEventDto[]
  headcount: {
    expected: number
    present: number
    by_class: Array<{ label: string; expected: number; present: number }>
  }
  checkpoints: CheckpointDto[]
}

export interface SimulatePresenceDto {
  event: {
    id: string
    student_usn: string
    student_name: string
    checkpoint: { code: string; name: string; zone: CheckpointZone }
    direction: PresenceDirection
    method: PresenceMethod
    source: string
    occurred_at: string
    simulated: boolean
  }
  notification: {
    title: string
    message: string
    recipients: number
  }
}

export interface ParentChildDto {
  usn: string
  name: string
  level: CampusLevel
  class_label: string | null
  section: string | null
  programme: string | null
  relationship: string
  presence: {
    state: PresenceState
    state_label: string
    checkpoint: { code: string; name: string; zone: CheckpointZone } | null
    direction: PresenceDirection | null
    method: PresenceMethod | null
    occurred_at: string | null
  }
  card: {
    card_uid: string
    status: CardStatus
    battery: number | null
    last_sync_at: string | null
    valid_to: string | null
    nfc_uid: string | null
    uhf_tag_id: string | null
  } | null
}

export interface ParentAlertDto {
  id: string
  student: { usn: string; name: string }
  channel: 'push' | 'sms'
  status: 'sent' | 'queued' | 'failed'
  title: string
  message: string
  created_at: string
  sent_at: string | null
  checkpoint: { code: string; name: string; zone: CheckpointZone } | null
}

export interface ParentChildrenDto {
  children: ParentChildDto[]
}

export interface ParentChildDetailDto {
  child: ParentChildDto
  events: Array<{
    id: string
    checkpoint: { code: string; name: string; zone: CheckpointZone }
    direction: PresenceDirection
    method: PresenceMethod
    occurred_at: string
  }>
  alerts: ParentAlertDto[]
}

export interface ParentAlertsDto {
  alerts: ParentAlertDto[]
  summary: {
    total: number
    sent: number
    queued: number
    failed: number
  }
}
