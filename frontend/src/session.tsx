import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Role } from './types'
import { users } from './data/mock'

export const roleHome: Record<Role, string> = {
  admin: '/admin',
  faculty: '/faculty',
  student: '/student',
}

interface SessionValue {
  role: Role
  setRole: (role: Role) => void
  user: (typeof users)[Role]
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    const stored = window.localStorage.getItem('eidx-role')
    return stored === 'faculty' || stored === 'student' ? stored : 'admin'
  })

  useEffect(() => {
    window.localStorage.setItem('eidx-role', role)
  }, [role])

  const setRole = (next: Role) => {
    setRoleState(next)
  }

  return (
    <SessionContext.Provider value={{ role, setRole, user: users[role] }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used inside SessionProvider')
  }
  return context
}
