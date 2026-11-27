import type {
  Card,
  Intervention,
  RiskLevel,
  Session,
  ShapFeature,
  Student,
  StudentProfile,
} from '../types'
import type {
  AdminOverviewDto,
  CampusRiskDto,
  CardDto,
  CohortDto,
  InsightsModelDto,
  InsightsRiskDto,
  MeAcademicsDto,
  MeAttendanceDto,
  MeExamsDto,
  MeFeesDto,
  MeLibraryDto,
  RiskDriverDto,
  RiskPredictionDto,
  SessionDtoApi,
  SessionUserDto,
  StudentDetailDto,
  StudentListDto,
  VerificationListDto,
  VerificationSummaryDto,
} from '../api/types'
import type {
  AdminOverviewView,
  CohortView,
  InsightsView,
  MeView,
  ModelInfoView,
  RecentUpdate,
  RiskView,
  StudentRow,
  VerificationItem,
  VerificationSummaryView,
  VerificationView,
  WatchItem,
} from '../data/views'

const CAMPUS_TZ = 'Asia/Kolkata'

const clock = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: CAMPUS_TZ,
})

const shortTime = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: CAMPUS_TZ,
})

const day = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: CAMPUS_TZ,
})

const month = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: CAMPUS_TZ,
})

export function initials(name: string): string {
  const parts = name
    .replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function formatClock(iso: string): string {
  return clock.format(new Date(iso))
}

export function formatShortTime(iso: string): string {
  return shortTime.format(new Date(iso))
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return day.format(new Date(iso))
}

export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return '—'
  return month.format(new Date(iso))
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'Just now'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

/** True when an ISO timestamp is in the past. */
export function isPast(iso: string | null | undefined): boolean {
  if (!iso) return false
  return new Date(iso).getTime() < Date.now()
}

/** `catboost-cutoff60-20261126065719` → `2026.11.26`. */
export function modelBuild(version: string | null | undefined): string {
  if (!version) return '—'
  const match = /(\d{4})(\d{2})(\d{2})\d{6}/.exec(version)
  return match ? `${match[1]}.${match[2]}.${match[3]}` : '—'
}

export function isCampusToday(iso: string): boolean {
  return day.format(new Date(iso)) === day.format(new Date())
}

function unprovisionedCard(): Card {
  return {
    id: 'No card',
    status: 'unprovisioned',
    battery: 0,
    lastSync: 'No card issued',
    validTo: '—',
    firmware: '—',
  }
}

export function toCard(card: CardDto | null): Card {
  if (!card) return unprovisionedCard()
  return {
    id: card.card_uid,
    status: card.status,
    battery: card.battery ?? 0,
    lastSync: formatRelative(card.last_sync_at),
    validTo: formatMonthYear(card.valid_to),
    firmware: card.firmware,
  }
}

function toListCard(
  card: StudentListDto['students'][number]['card'],
): Card {
  if (!card) return unprovisionedCard()
  return {
    id: card.card_uid,
    status: card.status,
    battery: card.battery ?? 0,
    lastSync: formatRelative(card.last_sync_at),
    validTo: formatMonthYear(card.valid_to),
    firmware: '—',
  }
}

export function driverSentence(driver: RiskDriverDto | null | undefined): string {
  if (!driver) return 'No driver breakdown is available for the current run.'
  const observed = driver.display ? `${driver.label} (${driver.display})` : driver.label
  return driver.direction === 'increases-risk'
    ? `${observed} is the strongest signal pushing risk up in this run.`
    : `${observed} is the strongest protective signal in this run.`
}

export function topPrediction(predictions: RiskPredictionDto[]): RiskPredictionDto | null {
  return (
    [...predictions].sort((a, b) => b.risk_probability - a.risk_probability)[0] ?? null
  )
}

export function toShapFeatures(prediction: RiskPredictionDto | null): ShapFeature[] {
  if (!prediction) return []
  // The API follows the model convention: positive SHAP increases risk. The
  // chart draws positive as success, so the sign is flipped for display only.
  return prediction.drivers.slice(0, 6).map((driver) => ({
    label: driver.display ? `${driver.label} (${driver.display})` : driver.label,
    value: -driver.shap_value,
  }))
}

function riskFields(prediction: RiskPredictionDto | null): {
  risk: RiskLevel
  probability: number
  driver: string
} {
  if (!prediction) {
    return {
      risk: 'on-track',
      probability: 0,
      driver: 'No current risk prediction is available for this student.',
    }
  }
  return {
    risk: prediction.risk_tier,
    probability: prediction.risk_probability,
    driver: driverSentence(prediction.drivers[0]),
  }
}

export function toStudentRecord(detail: StudentDetailDto): Student {
  const source = detail.student
  const attendanceByCourse = new Map(
    source.attendance.map((row) => [row.course_code, row]),
  )
  const courses = source.courses.map((course) => {
    const summary = attendanceByCourse.get(course.course_code)
    return {
      code: course.course_code,
      title: course.course_title ?? course.course_code,
      attended: summary?.attended ?? 0,
      held: summary?.held ?? 0,
    }
  })
  const attended = courses.reduce((sum, course) => sum + course.attended, 0)
  const held = courses.reduce((sum, course) => sum + course.held, 0)
  const prediction = topPrediction(detail.risk)

  return {
    usn: source.usn,
    name: source.name,
    initials: initials(source.name),
    programme: source.programme ?? '—',
    semester: source.semester ?? '—',
    section: source.section ?? '—',
    attendance: held > 0 ? Number(((attended / held) * 100).toFixed(1)) : 0,
    cgpa: source.academics.cgpa,
    backlogs: source.academics.backlogs,
    internalMarks: source.academics.internal_marks,
    internalMax: source.academics.internal_max,
    assignmentRate: source.academics.assignment_rate,
    libraryVisits: source.academics.library_visits,
    ...riskFields(prediction),
    mentor: source.mentor ?? 'Unassigned',
    card: toCard(source.card),
    courses,
    sgpa: source.academics.sgpa,
    interventions: source.interventions.map((note) => ({
      date: formatDate(note.created_at),
      note: note.note,
      by: note.by,
    })),
  }
}

export function toStudentRow(
  row: StudentListDto['students'][number],
): StudentRow {
  return {
    usn: row.usn,
    name: row.name,
    initials: initials(row.name),
    programme: row.programme ?? '—',
    semester: row.semester ?? '—',
    section: row.section ?? '—',
    mentor: row.mentor ?? 'Unassigned',
    card: toListCard(row.card),
    risk: row.risk?.tier ?? 'on-track',
    probability: row.risk?.probability ?? 0,
    moduleRef: row.risk?.module_ref ?? null,
  }
}

export function toAttentionRow(
  row: AdminOverviewDto['attention_cards'][number],
): StudentRow {
  return {
    usn: row.usn,
    name: row.name,
    initials: initials(row.name),
    programme: '—',
    semester: '—',
    section: '—',
    mentor: '—',
    card: {
      id: row.card_uid,
      status: row.status,
      battery: row.battery ?? 0,
      lastSync: formatRelative(row.last_sync_at),
      validTo: formatMonthYear(row.valid_to),
      firmware: '—',
    },
    risk: 'on-track',
    probability: 0,
    moduleRef: null,
  }
}

export function toVerificationItem(
  row:
    | AdminOverviewDto['recent_verifications'][number]
    | VerificationListDto['verifications'][number],
): VerificationItem {
  const name = row.name ?? 'Unknown student'
  return {
    id: row.id,
    time: formatClock(row.verified_at),
    usn: row.usn ?? '—',
    name,
    initials: initials(name),
    method: row.method,
    location: row.location ?? row.reader,
    reader: row.reader,
    result: row.result,
    latency: (row.latency_ms ?? 0) / 1000,
  }
}

export function toRecentUpdate(
  row: AdminOverviewDto['recent_card_updates'][number],
): RecentUpdate {
  return {
    id: row.id,
    usn: row.usn,
    name: row.name,
    initials: initials(row.name),
    cardId: row.card_uid,
    change: row.change,
    time: formatClock(row.created_at),
    state: row.state === 'confirmed' ? 'confirmed' : 'queued',
  }
}

export function toRiskView(row: CampusRiskDto): RiskView {
  return {
    support: row.support,
    watch: row.watch,
    onTrack: row.on_track,
    total: row.total,
    modelVersion: row.model_version,
    cutoffDay: row.cutoff_day,
  }
}

export function toAdminOverview(dto: AdminOverviewDto): AdminOverviewView {
  return {
    generatedAt: dto.generated_at,
    campus: {
      students: dto.campus.students,
      activeCards: dto.campus.cards.active,
      cardsInSync: dto.campus.cards.sync,
      lowBattery: dto.campus.cards.low_battery,
      revoked: dto.campus.cards.revoked,
      awaitingSync: dto.campus.cards.awaiting_sync,
      verificationsToday: dto.campus.verifications_today,
      rejectedToday: dto.campus.verifications_rejected_today,
      acceptanceRate: dto.campus.verification_acceptance_rate * 100,
      sessionsOpen: dto.campus.sessions_open,
    },
    risk: toRiskView(dto.risk),
    recentUpdates: dto.recent_card_updates.map(toRecentUpdate),
    recentVerifications: dto.recent_verifications.map(toVerificationItem),
    attention: dto.attention_cards.map(toAttentionRow),
  }
}

export function toWatchItem(
  row: CohortDto['students'][number],
): WatchItem {
  const direction =
    row.top_driver_direction === 'increases-risk'
      ? 'is the strongest risk signal'
      : 'is the strongest protective signal'
  return {
    usn: row.usn,
    name: row.name,
    initials: initials(row.name),
    semester: row.semester ?? '—',
    section: row.section ?? '—',
    mentor: row.mentor ?? 'Unassigned',
    risk: row.risk_tier,
    probability: row.risk_probability,
    driver: row.top_driver
      ? `${row.top_driver} ${direction} in this run.`
      : 'No driver breakdown is available for this run.',
    moduleRef: row.module_ref,
  }
}

export function toSession(row: SessionDtoApi): Session {
  return {
    id: row.id,
    code: row.course_code,
    title: row.title,
    room: row.room ?? 'Room to be confirmed',
    start: formatShortTime(row.starts_at),
    end: formatShortTime(row.ends_at),
    present: row.present,
    total: row.total_expected,
    status: row.state,
  }
}

export function toCohortView(dto: CohortDto): CohortView {
  return {
    students: dto.totals.students,
    support: dto.totals.support,
    watch: dto.totals.watch,
    onTrack: dto.totals.on_track,
    interventions30d: dto.totals.interventions_last_30_days,
    watchlist: dto.students.map(toWatchItem),
    sessions: [],
  }
}

export function toVerificationSummary(
  dto: VerificationSummaryDto,
): VerificationSummaryView {
  const acceptanceRate =
    dto.summary.total > 0 ? (dto.summary.accepted / dto.summary.total) * 100 : 0
  return {
    total: dto.summary.total,
    accepted: dto.summary.accepted,
    rejected: dto.summary.rejected,
    acceptanceRate,
    medianSeconds: dto.summary.median_seconds,
    readersOnline: dto.readers.filter((reader) => reader.state === 'Online').length,
    readers: dto.readers.map((reader) => ({
      id: reader.id,
      place: reader.location,
      median: reader.median_seconds ?? 0,
      state:
        reader.state === 'Online' && (reader.median_seconds ?? 0) > 1
          ? 'Degraded'
          : reader.state === 'Online'
            ? 'Online'
            : 'Degraded',
    })),
    hourly: dto.hourly.map((row) => ({
      label: String(row.hour).padStart(2, '0'),
      value: row.total,
    })),
  }
}

export function toVerificationView(dto: VerificationListDto): VerificationView {
  return {
    items: dto.verifications.map(toVerificationItem),
    total: dto.pagination.total,
    page: dto.pagination.page,
    pages: dto.pagination.pages,
  }
}

export function toModelInfo(dto: InsightsModelDto): ModelInfoView {
  const model = dto.model
  if (!model) {
    return {
      name: 'CatBoost',
      build: '—',
      trained: '—',
      records: 0,
      students: 0,
      features: 0,
      cutoffDay: 60,
      rocAuc: 0,
      prAuc: 0,
      atRiskRecall: 0,
      temporalRocAuc: 0,
      brier: 0,
    }
  }
  const match = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(model.version)
  const build = match ? `${match[1]}.${match[2]}.${match[3]}` : '—'
  const trained = model.created_at ? formatDate(model.created_at) : '—'
  return {
    name: 'CatBoost',
    build,
    trained,
    records: model.dataset_rows,
    students: model.student_count ?? 0,
    features: model.feature_count,
    cutoffDay: model.cutoff_day,
    rocAuc: model.metrics.cross_validation_auc,
    prAuc: model.metrics.cross_validation_pr_auc,
    atRiskRecall: model.metrics.recall_at_20pct,
    temporalRocAuc: model.metrics.temporal_test_auc,
    brier: model.brier ?? 0,
  }
}

export function toInsightsView(
  risk: InsightsRiskDto,
  model: InsightsModelDto,
  cohort: CohortDto,
): InsightsView {
  const features = risk.driver_groups.slice(0, 7).map((group) => ({
    label: group.group,
    value: group.share,
  }))
  const covered = features.reduce((sum, feature) => sum + feature.value, 0)
  const remainder = Math.max(0, 1 - covered)
  if (remainder > 0.001) {
    features.push({ label: 'Other features', value: Number(remainder.toFixed(4)) })
  }

  return {
    modelInfo: toModelInfo(model),
    risk: {
      support: risk.tiers.support.count,
      watch: risk.tiers.watch.count,
      onTrack: risk.tiers['on-track'].count,
      total: risk.total,
      modelVersion: risk.model_version,
      cutoffDay: risk.cutoff_day,
    },
    globalFeatures: features,
    watchlist: cohort.students.map(toWatchItem),
  }
}

export function toMeView(input: {
  user: SessionUserDto
  card: CardDto | null
  attendance: MeAttendanceDto
  academics: MeAcademicsDto['academics']
  library: MeLibraryDto
  exams: MeExamsDto
  fees: MeFeesDto
}): MeView {
  const student: StudentProfile = {
    usn: input.user.usn ?? '—',
    name: input.user.name,
    initials: initials(input.user.name),
    programme: input.user.programme ?? '—',
    semester: input.user.semester ?? '—',
    section: input.user.section ?? '—',
    attendance: input.attendance.overall.percent,
    cgpa: input.academics.cgpa,
    backlogs: input.academics.backlogs,
    internalMarks: input.academics.internal_marks,
    internalMax: input.academics.internal_max,
    assignmentRate: input.academics.assignment_rate,
    libraryVisits: input.academics.library_visits,
    mentor: '',
    card: toCard(input.card),
    courses: input.attendance.courses.map((course) => ({
      code: course.code,
      title: course.title,
      attended: course.attended,
      held: course.held,
    })),
    sgpa: input.academics.sgpa,
  }

  return {
    student,
    exams: input.exams.exams.map((exam) => ({
      code: exam.course_code,
      title: exam.title,
      date: formatDate(exam.starts_at),
      time: formatShortTime(exam.starts_at),
      hall: exam.hall ?? 'To be confirmed',
    })),
    loans: input.library.loans.map((loan) => ({
      title: loan.title,
      due: formatDate(loan.due_at),
      status: isPast(loan.due_at) ? 'Overdue' : loan.status,
    })),
    receipts: input.fees.receipts.map((receipt) => ({
      term: receipt.term,
      amount: formatRupees(receipt.amount),
      paidOn: formatDate(receipt.paid_on),
      receipt: receipt.receipt_no,
      status: receipt.status,
    })),
  }
}

export function noteToIntervention(note: {
  note: string
  by: string
  created_at: string
}): Intervention {
  return {
    date: formatDate(note.created_at),
    note: note.note,
    by: note.by,
  }
}
