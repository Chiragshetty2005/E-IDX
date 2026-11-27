import { api } from './client'
import type {
  AdminOverviewDto,
  CampusPassDto,
  CardUpdateDto,
  CohortDto,
  FacultyStudentDto,
  InsightsModelDto,
  InsightsRiskDto,
  InterventionDto,
  MeAcademicsDto,
  MeAttendanceDto,
  MeExamsDto,
  MeFeesDto,
  MeLibraryDto,
  MePresenceDto,
  ParentAlertsDto,
  ParentChildDetailDto,
  ParentChildrenDto,
  PresenceOverviewDto,
  SessionDto,
  SessionListDto,
  SimulatePresenceDto,
  StudentDetailDto,
  StudentListDto,
  VerificationListDto,
  VerificationSummaryDto,
} from './types'

function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

function usnPath(usn: string): string {
  return encodeURIComponent(usn)
}

export const endpoints = {
  adminOverview(): Promise<AdminOverviewDto> {
    return api<AdminOverviewDto>('/admin/overview')
  },

  students(params: {
    query?: string
    status?: string
    page?: number
    limit?: number
  }): Promise<StudentListDto> {
    return api<StudentListDto>(`/students${queryString(params)}`)
  },

  student(usn: string): Promise<StudentDetailDto> {
    return api<StudentDetailDto>(`/students/${usnPath(usn)}`)
  },

  queueCardUpdate(
    usn: string,
    body: {
      change_type: 'validity' | 'status' | 'firmware' | 'reissue'
      summary: string
      payload: Record<string, unknown>
      idempotency_key: string
    },
  ): Promise<CardUpdateDto> {
    return api<CardUpdateDto>(`/students/${usnPath(usn)}/card-updates`, {
      method: 'POST',
      body,
    })
  },

  cohort(limit = 50): Promise<CohortDto> {
    return api<CohortDto>(`/faculty/cohort?limit=${limit}`)
  },

  facultyStudent(usn: string): Promise<FacultyStudentDto> {
    return api<FacultyStudentDto>(`/faculty/students/${usnPath(usn)}`)
  },

  addIntervention(
    usn: string,
    note: string,
    source: 'mentor' | 'model-flag' | 'counsellor' = 'mentor',
  ): Promise<InterventionDto> {
    return api<InterventionDto>(`/faculty/students/${usnPath(usn)}/interventions`, {
      method: 'POST',
      body: { note, source },
    })
  },

  verifications(params: {
    result?: string
    method?: string
    q?: string
    page?: number
    limit?: number
  }): Promise<VerificationListDto> {
    return api<VerificationListDto>(`/verifications${queryString(params)}`)
  },

  verificationSummary(): Promise<VerificationSummaryDto> {
    return api<VerificationSummaryDto>('/verifications/summary')
  },

  sessions(): Promise<SessionListDto> {
    return api<SessionListDto>('/sessions')
  },

  openSession(id: string): Promise<unknown> {
    return api<unknown>(`/sessions/${encodeURIComponent(id)}/open`, { method: 'POST' })
  },

  closeSession(id: string): Promise<unknown> {
    return api<unknown>(`/sessions/${encodeURIComponent(id)}/close`, { method: 'POST' })
  },

  insightsRisk(): Promise<InsightsRiskDto> {
    return api<InsightsRiskDto>('/insights/risk')
  },

  insightsModel(): Promise<InsightsModelDto> {
    return api<InsightsModelDto>('/insights/model')
  },

  me(): Promise<SessionDto> {
    return api<SessionDto>('/me')
  },

  meCard(): Promise<{ card: import('./types').CardDto | null }> {
    return api<{ card: import('./types').CardDto | null }>('/me/card')
  },

  meAttendance(): Promise<MeAttendanceDto> {
    return api<MeAttendanceDto>('/me/attendance')
  },

  meAcademics(): Promise<MeAcademicsDto> {
    return api<MeAcademicsDto>('/me/academics')
  },

  meLibrary(): Promise<MeLibraryDto> {
    return api<MeLibraryDto>('/me/library')
  },

  meExams(): Promise<MeExamsDto> {
    return api<MeExamsDto>('/me/exams')
  },

  meFees(): Promise<MeFeesDto> {
    return api<MeFeesDto>('/me/fees')
  },

  mePresence(): Promise<MePresenceDto> {
    return api<MePresenceDto>('/me/presence')
  },

  createPass(): Promise<CampusPassDto> {
    return api<CampusPassDto>('/me/pass', { method: 'POST' })
  },

  presenceOverview(level: 'school' | 'college' = 'school'): Promise<PresenceOverviewDto> {
    return api<PresenceOverviewDto>(`/presence/overview${queryString({ level })}`)
  },

  simulatePresence(body: {
    student_usn: string
    checkpoint_code: string
    direction: 'in' | 'out'
    method: 'uhf' | 'qr' | 'nfc'
  }): Promise<SimulatePresenceDto> {
    return api<SimulatePresenceDto>('/presence/simulate', { method: 'POST', body })
  },

  parentChildren(): Promise<ParentChildrenDto> {
    return api<ParentChildrenDto>('/parent/children')
  },

  parentChild(usn: string): Promise<ParentChildDetailDto> {
    return api<ParentChildDetailDto>(`/parent/children/${usnPath(usn)}`)
  },

  parentAlerts(): Promise<ParentAlertsDto> {
    return api<ParentAlertsDto>('/parent/alerts')
  },
}
