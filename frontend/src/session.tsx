import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Role } from './types'
import { demoStudentUsn, users } from './data/mock'
import { ApiError, errorMessage, getSession, previewLogin } from './api/client'
import { initials } from './api/adapters'
import type { SessionDto, SessionUserDto } from './api/types'

export const roleHome: Record<Role, string> = {
  admin: '/admin',
  faculty: '/faculty',
  student: '/student',
}

/**
 * `live` means the browser is talking to the E-IDX API with a server session.
 * `preview` means the API is unreachable, so the app falls back to the sample
 * register in `src/data/mock.ts`.
 */
export type DataMode = 'checking' | 'live' | 'preview'

interface SessionValue {
  role: Role
  setRole: (role: Role) => void
  user: { name: string; detail: string; initials: string }
  mode: DataMode
  isLive: boolean
  switching: boolean
  authError: string | null
  serverUser: SessionUserDto | null
}

const SessionContext = createContext<SessionValue | null>(null)

const ROLE_KEY = 'eidx-role'

function readStoredRole(): Role {
  const stored = window.localStorage.getItem(ROLE_KEY)
  return stored === 'faculty' || stored === 'student' ? stored : 'admin'
}

async function loginAs(role: Role): Promise<SessionDto> {
  try {
    return await previewLogin(role, role === 'student' ? demoStudentUsn : undefined)
  } catch (error) {
    // The seeded preview student may be missing in a different database. The
    // server can still pick a student account for the role.
    if (role === 'student' && error instanceof ApiError && error.status === 404) {
      return previewLogin(role)
    }
    throw error
  }
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
  const [serverUser, setServerUser] = useState<SessionUserDto | null>(null)
  const [switching, setSwitching] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const bootStarted = useRef(false)
  const requestSeq = useRef(0)

  useEffect(() => {
    window.localStorage.setItem(ROLE_KEY, role)
  }, [role])

  useEffect(() => {
    if (bootStarted.current) return
    bootStarted.current = true

    const apply = (session: SessionDto) => {
      setServerUser(session.user)
      setMode('live')
      setAuthError(null)
    }

    const fallback = (error: unknown) => {
      setMode('preview')
      setAuthError(errorMessage(error))
    }

    void (async () => {
      const stored = readStoredRole()
      try {
        const current = await getSession()
        if (current.user.role === stored) {
          apply(current)
          return
        }
        apply(await loginAs(stored))
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          try {
            apply(await loginAs(stored))
          } catch (loginError) {
            fallback(loginError)
          }
          return
        }
        fallback(error)
      }
    })()
  }, [])

  const setRole = (next: Role) => {
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
        setMode('preview')
        setAuthError(errorMessage(error))
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
    serverUser,
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
