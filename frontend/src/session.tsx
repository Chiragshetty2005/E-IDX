import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Role } from './types'
import { demoStudentUsn, users } from './data/mock'
import {
  ApiError,
  endSession,
  errorMessage,
  getSession,
  previewLogin,
  setUnauthorizedHandler,
} from './api/client'
import { initials } from './api/adapters'
import type { SessionDto, SessionUserDto } from './api/types'

export const roleHome: Record<Role, string> = {
  admin: '/admin',
  faculty: '/faculty',
  student: '/student',
}

/**
 * `live` means the browser is talking to the E-IDX API with a server session.
 * `preview` means the app is showing the sample register in `src/data/mock.ts`.
 */
export type DataMode = 'checking' | 'live' | 'preview'

/** `signed-out` is the state of the sign-in page. */
export type SessionStatus = 'checking' | 'signed-out' | 'signed-in'

interface SessionValue {
  role: Role
  setRole: (role: Role) => void
  user: { name: string; detail: string; initials: string }
  mode: DataMode
  isLive: boolean
  switching: boolean
  authError: string | null
  /** True when the API could not be reached, so only sample data is available. */
  apiUnreachable: boolean
  serverUser: SessionUserDto | null
  status: SessionStatus
  /** Signs in through the API. Resolves to false when the sign-in failed. */
  signIn: (role: Role, usn?: string) => Promise<boolean>
  /** Ends the server session and returns to the sign-in page. */
  signOut: () => Promise<void>
  /** Continues with the sample register, without a server session. */
  enterPreview: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

const ROLE_KEY = 'eidx-role'

export function readStoredRole(): Role {
  const stored = window.localStorage.getItem(ROLE_KEY)
  return stored === 'faculty' || stored === 'student' ? stored : 'admin'
}

/**
 * Preview sign-in. The seeded demo student may be missing in a different
 * database, so the server is asked for any student account in that case. A USN
 * the person typed is never swapped silently.
 */
async function loginAs(role: Role, usn?: string): Promise<SessionDto> {
  const typed = usn?.trim()
  if (typed) return previewLogin(role, typed)

  try {
    return await previewLogin(role, role === 'student' ? demoStudentUsn : undefined)
  } catch (error) {
    if (role === 'student' && error instanceof ApiError && error.status === 404) {
      return previewLogin(role)
    }
    throw error
  }
}

/** The API could not be reached, so the app can only show the sample register. */
function isUnreachable(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.code === 'network_error' || error.code === 'timeout')
  )
}

function detailFor(user: SessionUserDto): string {
  if (user.role === 'admin') return 'Card services'
  if (user.role === 'faculty') {
    return user.section
      ? `Associate professor, CSE, ${user.section}`
      : 'Associate professor, CSE'
  }
  return `${user.usn ?? ''}, ${user.semester ?? 'Student'}`
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readStoredRole)
  const [mode, setMode] = useState<DataMode>('checking')
  const [status, setStatus] = useState<SessionStatus>('checking')
  const [serverUser, setServerUser] = useState<SessionUserDto | null>(null)
  const [switching, setSwitching] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [apiUnreachable, setApiUnreachable] = useState(false)

  const bootStarted = useRef(false)
  const requestSeq = useRef(0)

  useEffect(() => {
    window.localStorage.setItem(ROLE_KEY, role)
  }, [role])

  // A session that expires while the app is open sends the person back to the
  // sign-in page instead of leaving stale screens on screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setServerUser(null)
      setStatus('signed-out')
      setMode('checking')
      setAuthError('Your session has expired. Sign in again.')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    if (bootStarted.current) return
    bootStarted.current = true

    void (async () => {
      try {
        const current = await getSession()
        setServerUser(current.user)
        setRoleState(current.user.role)
        setMode('live')
        setStatus('signed-in')
        setAuthError(null)
        setApiUnreachable(false)
      } catch (error) {
        setStatus('signed-out')
        setApiUnreachable(isUnreachable(error))
        setAuthError(
          error instanceof ApiError && error.status === 401 ? null : errorMessage(error),
        )
      }
    })()
  }, [])

  const signIn = useCallback(async (next: Role, usn?: string): Promise<boolean> => {
    setSwitching(true)
    setAuthError(null)
    try {
      const session = await loginAs(next, usn)
      setServerUser(session.user)
      setRoleState(next)
      setMode('live')
      setStatus('signed-in')
      setApiUnreachable(false)
      return true
    } catch (error) {
      setAuthError(errorMessage(error))
      setApiUnreachable(isUnreachable(error))
      setStatus('signed-out')
      return false
    } finally {
      setSwitching(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await endSession()
    } catch {
      // The cookie is cleared by the server when it is reachable. When it is
      // not, the local state is still reset so the app returns to sign-in.
    }
    setServerUser(null)
    setMode('checking')
    setStatus('signed-out')
    setAuthError(null)
    setApiUnreachable(false)
  }, [])

  const enterPreview = useCallback(() => {
    setServerUser(null)
    setMode('preview')
    setStatus('signed-in')
    setAuthError(null)
  }, [])

  const setRole = (next: Role) => {
    if (next === role) return
    setRoleState(next)
    setAuthError(null)
    if (mode !== 'live') return

    const seq = ++requestSeq.current
    setSwitching(true)
    void loginAs(next)
      .then((session) => {
        if (seq !== requestSeq.current) return
        setServerUser(session.user)
        setMode('live')
        setAuthError(null)
      })
      .catch((error) => {
        if (seq !== requestSeq.current) return
        setAuthError(errorMessage(error))
        // The server kept the previous session, so keep that role on screen.
        setRoleState(serverUser?.role ?? role)
      })
      .finally(() => {
        if (seq === requestSeq.current) setSwitching(false)
      })
  }

  const live = mode === 'live' && serverUser !== null
  const value: SessionValue = {
    role,
    setRole,
    mode,
    isLive: live,
    switching,
    authError,
    apiUnreachable,
    serverUser,
    status,
    signIn,
    signOut,
    enterPreview,
    user: live
      ? {
          name: serverUser.name,
          detail: detailFor(serverUser),
          initials: initials(serverUser.name),
        }
      : users[role],
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside SessionProvider')
  return context
}
