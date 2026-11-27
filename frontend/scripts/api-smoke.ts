/**
 * Client side smoke test.
 *
 * Signs in to the local API with each preview role, pulls every endpoint the
 * dashboards use and runs the real adapters over the payloads. It catches
 * shape drift between `backend/src/routes` and `frontend/src/api/adapters.ts`
 * without opening a browser.
 *
 *   npm run smoke:api        # expects the API on http://localhost:4000
 *
 * The database must be seeded first: `cd ../backend && npm run seed`.
 */

import {
  toAdminOverview,
  toCohortView,
  toInsightsView,
  toMeView,
  toParentAlerts,
  toParentChildren,
  toPresenceOverview,
  toSession,
  toShapFeatures,
  toStudentRecord,
  toStudentRow,
  toVerificationSummary,
  toVerificationView,
  topPrediction,
} from '../src/api/adapters.ts'
import type {
  AdminOverviewDto,
  CampusPassDto,
  CohortDto,
  InsightsModelDto,
  InsightsRiskDto,
  MeAcademicsDto,
  MeAttendanceDto,
  MeExamsDto,
  MeFeesDto,
  MeLibraryDto,
  MePresenceDto,
  ParentAlertsDto,
  ParentChildrenDto,
  PresenceOverviewDto,
  SessionDto,
  SessionListDto,
  StudentDetailDto,
  StudentListDto,
  VerificationListDto,
  VerificationSummaryDto,
} from '../src/api/types.ts'

const BASE = process.env.EIDX_API_URL ?? 'http://localhost:4000/api/v1'

async function login(role: string, usn?: string) {
  const response = await fetch(`${BASE}/auth/preview-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(usn ? { role, usn } : { role }),
  })
  if (!response.ok) throw new Error(`login as ${role} failed with ${response.status}`)
  const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? ''
  return { cookie, session: (await response.json()) as SessionDto }
}

async function get<T>(cookie: string, path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: { cookie } })
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}: ${await response.text()}`)
  }
  return (await response.json()) as T
}

async function post<T>(cookie: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      cookie,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`POST ${path} failed with ${response.status}: ${await response.text()}`)
  }
  return (await response.json()) as T
}

const checks: string[] = []

function check(label: string, condition: boolean, detail = '') {
  checks.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!condition) process.exitCode = 1
}

async function main() {
  const admin = await login('admin')
  const faculty = await login('faculty')
  const student = await login('student', '1DS23CS0048')

  check('admin session', admin.session.user.role === 'admin', admin.session.user.name)
  check('faculty session', faculty.session.user.role === 'faculty', faculty.session.user.name)
  check('student session', student.session.user.role === 'student', student.session.user.name)

  const overviewDto = await get<AdminOverviewDto>(admin.cookie, '/admin/overview')
  const overview = toAdminOverview(overviewDto)
  check(
    'overview campus totals',
    overview.campus.students >= overview.risk.total,
    `${overview.campus.students} students, ${overview.risk.support} in support`,
  )
  check(
    'overview names are present',
    overview.recentUpdates.every((update) => update.name.length > 0) &&
      overview.recentVerifications.every((item) => item.name.length > 0),
  )
  check(
    'overview attention cards',
    overview.attention.every((row) => row.card.id.length > 0),
    `${overview.attention.length} cards`,
  )
  check(
    'overview acceptance rate is a percentage',
    overview.campus.acceptanceRate > 50 && overview.campus.acceptanceRate <= 100,
    `${overview.campus.acceptanceRate.toFixed(1)}%`,
  )

  const listDto = await get<StudentListDto>(admin.cookie, '/students?page=1&limit=5')
  const rows = listDto.students.map(toStudentRow)
  check('student list rows', rows.length === 5, rows[0]?.name ?? 'none')
  check('student list card', rows[0]?.card.id.startsWith('EIDX-'), rows[0]?.card.id)

  const detailDto = await get<StudentDetailDto>(admin.cookie, '/students/1DS23CS0048')
  const record = toStudentRecord(detailDto)
  check('student record courses', record.courses.length === 4, record.courses.length.toString())
  check('student record attendance', record.attendance > 0, `${record.attendance}%`)
  check('student record risk', ['support', 'watch', 'on-track'].includes(record.risk), record.risk)
  const prediction = topPrediction(detailDto.risk)
  check(
    'student record drivers',
    toShapFeatures(prediction).length > 0,
    toShapFeatures(prediction)[0]?.label ?? 'none',
  )

  const cohortDto = await get<CohortDto>(faculty.cookie, '/faculty/cohort?limit=5')
  const cohort = toCohortView(cohortDto)
  check(
    'faculty cohort is section scoped',
    cohort.students === 62 && cohort.students < 100,
    `${cohort.students} students in the section`,
  )
  check('faculty cohort drivers', cohort.watchlist[0]?.driver.length > 0)

  const sessionsDto = await get<SessionListDto>(faculty.cookie, '/sessions')
  const sessions = sessionsDto.sessions.map(toSession)
  check('sessions', sessions.length > 0, `${sessions.length} today`)
  check(
    'session expectation matches the section',
    sessions.every((session) => session.total === 62),
    sessions[0]?.total.toString() ?? 'none',
  )

  const verificationsDto = await get<VerificationListDto>(
    admin.cookie,
    '/verifications?page=1&limit=10',
  )
  const verifications = toVerificationView(verificationsDto)
  check('verification rows', verifications.items.length === 10)
  check(
    'verification location',
    verifications.items.every((item) => item.location.length > 0),
    verifications.items[0]?.location ?? 'none',
  )
  check(
    'verification pagination',
    verifications.pages >= 1 && verifications.page === 1,
    `page ${verifications.page} of ${verifications.pages}`,
  )

  const summaryDto = await get<VerificationSummaryDto>(admin.cookie, '/verifications/summary')
  const summary = toVerificationSummary(summaryDto)
  check('verification summary', summary.total > 0, `${summary.total} checks today`)
  check('reader health', summary.readers.length > 0, `${summary.readersOnline} online`)

  const riskDto = await get<InsightsRiskDto>(admin.cookie, '/insights/risk')
  const modelDto = await get<InsightsModelDto>(admin.cookie, '/insights/model')
  const insights = toInsightsView(riskDto, modelDto, cohortDto)
  check('insight model metrics', insights.modelInfo.rocAuc > 0.8, insights.modelInfo.rocAuc.toFixed(4))
  check('insight student count', insights.modelInfo.students > 0, insights.modelInfo.students.toString())
  check(
    'insight driver groups',
    insights.globalFeatures.length > 3,
    insights.globalFeatures.map((feature) => feature.label).join(', '),
  )

  const me = await get<SessionDto>(student.cookie, '/me')
  const card = await get<{ card: StudentDetailDto['student']['card'] }>(student.cookie, '/me/card')
  const attendance = await get<MeAttendanceDto>(student.cookie, '/me/attendance')
  const academics = await get<MeAcademicsDto>(student.cookie, '/me/academics')
  const library = await get<MeLibraryDto>(student.cookie, '/me/library')
  const exams = await get<MeExamsDto>(student.cookie, '/me/exams')
  const fees = await get<MeFeesDto>(student.cookie, '/me/fees')
  const presenceDto = await get<MePresenceDto>(student.cookie, '/me/presence')
  const studentView = toMeView({
    user: me.user,
    card: card.card,
    attendance,
    academics: academics.academics,
    library,
    exams,
    fees,
    presence: presenceDto.presence,
  })
  check('student card', studentView.student.card.id.startsWith('EIDX-'), studentView.student.card.id)
  check('student attendance', studentView.student.attendance > 0, `${studentView.student.attendance}%`)
  check('student courses', studentView.student.courses.length === 4)
  check('student exams', studentView.exams.length > 0, `${studentView.exams.length} exams`)
  check('student loans', studentView.loans.length > 0, `${studentView.loans.length} loans`)
  check('student receipts', studentView.receipts.length > 0, `${studentView.receipts.length} receipts`)
  check(
    'student presence',
    studentView.presence !== null,
    studentView.presence ? `${studentView.presence.stateLabel} at ${studentView.presence.time}` : 'none',
  )
  check(
    'student view carries no risk fields',
    !('risk' in studentView.student) && !('probability' in studentView.student),
  )

  const schoolPresenceDto = await get<PresenceOverviewDto>(admin.cookie, '/presence/overview?level=school')
  const presence = toPresenceOverview(schoolPresenceDto)
  check(
    'school presence scope',
    presence.scope.level === 'school' && presence.summary.expected === 24,
    `${presence.summary.onCampus} on campus of ${presence.summary.expected}`,
  )
  check(
    'school presence rows',
    presence.students.length === 24 && presence.events.length > 0,
    `${presence.events.length} reads today`,
  )
  check(
    'school presence zones',
    presence.zones.length > 0 && presence.zones.every((zone) => zone.count > 0),
    presence.zones.map((zone) => `${zone.label} ${zone.count}`).join(', '),
  )

  const parent = await login('parent')
  const childrenDto = await get<ParentChildrenDto>(parent.cookie, '/parent/children')
  const children = toParentChildren(childrenDto)
  check('parent children', children.children.length === 2, `${children.children.length} linked`)
  check(
    'parent child presence',
    children.children.every((child) => child.state !== 'not-arrived'),
    children.children.map((child) => `${child.name} ${child.stateLabel}`).join(', '),
  )
  const alertsDto = await get<ParentAlertsDto>(parent.cookie, '/parent/alerts')
  const alerts = toParentAlerts(alertsDto)
  check('parent alerts', alerts.alerts.length > 0, `${alerts.alerts.length} messages`)
  check(
    'parent alerts carry no risk fields',
    !JSON.stringify(alerts).match(/risk|probability|shap/i),
  )
  const parentDenied = await fetch(`${BASE}/admin/overview`, { headers: { cookie: parent.cookie } })
  check('parent stays out of staff routes', parentDenied.status === 403, parentDenied.status.toString())

  const pass = await post<CampusPassDto>(student.cookie, '/me/pass')
  check('campus pass', pass.pass.token.length > 20, `expires ${pass.pass.expires_at}`)

  const riskDenied = await fetch(`${BASE}/me/risk`, { headers: { cookie: student.cookie } })
  check('student risk stays forbidden', riskDenied.status === 403, riskDenied.status.toString())

  console.log(checks.join('\n'))
  console.log(
    `\n${checks.filter((line) => line.startsWith('ok')).length}/${checks.length} client checks passed`,
  )
}

await main()
