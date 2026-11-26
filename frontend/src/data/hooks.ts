import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { errorMessage } from '../api/client'
import { endpoints } from '../api/endpoints'
import {
  isCampusToday,
  toAdminOverview,
  toCohortView,
  toInsightsView,
  toMeView,
  toSession,
  toShapFeatures,
  toStudentRecord,
  toStudentRow,
  toVerificationSummary,
  toVerificationView,
  topPrediction,
} from '../api/adapters'
import { useSession } from '../session'
import { shapFor } from './mock'
import {
  previewCohort,
  previewInsights,
  previewMe,
  previewOverview,
  previewStudent,
  previewStudentRows,
  previewVerifications,
  previewVerificationSummary,
} from './preview'
import type {
  AdminOverviewView,
  CohortView,
  InsightsView,
  MeView,
  StudentRow,
  StudentSupportView,
  VerificationSummaryView,
  VerificationView,
} from './views'
import type { Session, Student } from '../types'

export interface AsyncState<T> {
  data: T
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Runs `fetcher` when the API is reachable and falls back to the sample data
 * otherwise. The last successful payload stays on screen while a refresh is
 * in flight, so filters never blank the page.
 */
export function useApiData<T>(
  enabled: boolean,
  fetcher: () => Promise<T>,
  fallback: T,
  deps: readonly (string | number | boolean | null | undefined)[],
): AsyncState<T> {
  const [data, setData] = useState<T>(fallback)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const fetcherRef = useRef(fetcher)
  const fallbackRef = useRef(fallback)
  const depKey = deps.join('|')

  useEffect(() => {
    fetcherRef.current = fetcher
    fallbackRef.current = fallback
  })

  useEffect(() => {
    if (!enabled) {
      setData(fallbackRef.current)
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)
    fetcherRef.current()
      .then((value) => {
        if (!active) return
        setData(value)
      })
      .catch((cause) => {
        if (!active) return
        setError(errorMessage(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [enabled, tick, depKey])

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  return { data, loading, error, refresh }
}

export interface StudentsPage {
  students: StudentRow[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export function useAdminOverview(): AsyncState<AdminOverviewView> {
  const { isLive } = useSession()
  return useApiData<AdminOverviewView>(
    isLive,
    async () => toAdminOverview(await endpoints.adminOverview()),
    previewOverview(),
    [],
  )
}

export function useStudentsPage(
  query: string,
  status: string,
  page: number,
): AsyncState<StudentsPage> {
  const { isLive } = useSession()

  const fallback = useMemo<StudentsPage>(() => {
    const search = query.trim().toLowerCase()
    const rows = previewStudentRows().filter((row) => {
      const matchesSearch =
        search.length === 0 ||
        row.name.toLowerCase().includes(search) ||
        row.usn.toLowerCase().includes(search)
      const matchesStatus =
        status === 'all' || row.card.status === status || row.risk === status
      return matchesSearch && matchesStatus
    })
    return {
      students: rows,
      pagination: { page: 1, limit: rows.length, total: rows.length, pages: 1 },
    }
  }, [query, status])

  return useApiData<StudentsPage>(
    isLive,
    async () => {
      const dto = await endpoints.students({
        query: query.trim(),
        status: status === 'all' ? '' : status,
        page,
        limit: 25,
      })
      return {
        students: dto.students.map(toStudentRow),
        pagination: dto.pagination,
      }
    },
    fallback,
    [query, status, page],
  )
}

export function useStudentRecord(usn: string | null): AsyncState<Student | null> {
  const { isLive } = useSession()
  const fallback = usn ? previewStudent(usn) : null

  return useApiData(
    isLive && Boolean(usn),
    async () => toStudentRecord(await endpoints.student(usn as string)),
    fallback,
    [usn],
  )
}

export function useStudentSupport(usn: string | null): AsyncState<StudentSupportView | null> {
  const { isLive } = useSession()

  const fallback = useMemo<StudentSupportView | null>(() => {
    const student = usn ? previewStudent(usn) : null
    if (!student) return null
    return { student, notes: student.interventions, shap: shapFor(student) }
  }, [usn])

  return useApiData<StudentSupportView | null>(
    isLive && Boolean(usn),
    async () => {
      const detail = await endpoints.student(usn as string)
      const student = toStudentRecord(detail)
      return {
        student,
        notes: student.interventions,
        shap: toShapFeatures(topPrediction(detail.risk)),
      }
    },
    fallback,
    [usn],
  )
}

export interface VerificationFilters {
  method?: string
  result?: string
  q?: string
  page: number
}

export function useVerificationLog(
  filters: VerificationFilters,
): AsyncState<VerificationView> {
  const { isLive } = useSession()
  const { method, result, q, page } = filters
  const fallback = useMemo(
    () => previewVerifications({ method, result, q }),
    [method, result, q],
  )

  return useApiData<VerificationView>(
    isLive,
    async () =>
      toVerificationView(
        await endpoints.verifications({
          method,
          result,
          q,
          page,
          limit: 25,
        }),
      ),
    fallback,
    [method, result, q, page],
  )
}

export function useVerificationSummary(): AsyncState<VerificationSummaryView> {
  const { isLive } = useSession()
  return useApiData<VerificationSummaryView>(
    isLive,
    async () => toVerificationSummary(await endpoints.verificationSummary()),
    previewVerificationSummary(),
    [],
  )
}

export function useInsights(): AsyncState<InsightsView> {
  const { isLive } = useSession()
  return useApiData<InsightsView>(
    isLive,
    async () => {
      const [risk, model, cohort] = await Promise.all([
        endpoints.insightsRisk(),
        endpoints.insightsModel(),
        endpoints.cohort(6),
      ])
      return toInsightsView(risk, model, cohort)
    },
    previewInsights(),
    [],
  )
}

export function useCohort(): AsyncState<CohortView> {
  const { isLive } = useSession()
  return useApiData<CohortView>(
    isLive,
    async () => {
      const [cohort, sessionList] = await Promise.all([
        endpoints.cohort(50),
        endpoints.sessions(),
      ])
      const view = toCohortView(cohort)
      view.sessions = sessionList.sessions
        .filter((session) => isCampusToday(session.starts_at))
        .map(toSession)
      return view
    },
    previewCohort(),
    [],
  )
}

export function useSessions(): AsyncState<Session[]> {
  const { isLive } = useSession()
  return useApiData<Session[]>(
    isLive,
    async () => {
      const dto = await endpoints.sessions()
      return dto.sessions
        .filter((session) => isCampusToday(session.starts_at))
        .map(toSession)
    },
    previewCohort().sessions,
    [],
  )
}

export function useMe(): AsyncState<MeView> {
  const { isLive } = useSession()
  return useApiData<MeView>(
    isLive,
    async () => {
      const [me, card, attendance, academics, library, exams, fees] = await Promise.all([
        endpoints.me(),
        endpoints.meCard(),
        endpoints.meAttendance(),
        endpoints.meAcademics(),
        endpoints.meLibrary(),
        endpoints.meExams(),
        endpoints.meFees(),
      ])
      return toMeView({
        user: me.user,
        card: card.card,
        attendance,
        academics: academics.academics,
        library,
        exams,
        fees,
      })
    },
    previewMe(),
    [],
  )
}

export function useCardStudioStudents(limit = 100): AsyncState<StudentRow[]> {
  const { isLive } = useSession()
  return useApiData<StudentRow[]>(
    isLive,
    async () => {
      const dto = await endpoints.students({ limit })
      return dto.students.map(toStudentRow)
    },
    previewStudentRows(),
    [limit],
  )
}
