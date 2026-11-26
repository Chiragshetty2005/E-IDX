import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { SessionProvider, roleHome, useSession } from './session'
import type { Role } from './types'
import { AppShell } from './components/AppShell'
import { AdminOverview } from './pages/admin/Overview'
import { AdminStudents } from './pages/admin/Students'
import { AdminVerifications } from './pages/admin/Verifications'
import { AdminInsights } from './pages/admin/Insights'
import { FacultyCohort } from './pages/faculty/Cohort'
import { FacultyStudent } from './pages/faculty/StudentDetail'
import { FacultySessions } from './pages/faculty/Sessions'
import { StudentMyCard } from './pages/student/MyCard'
import { StudentServices } from './pages/student/Services'
import { VerifyConsole } from './pages/Verify'
import { NotFound } from './pages/NotFound'
import { SignIn } from './pages/SignIn'

/**
 * Access boundary for the browser. The API enforces the role and the record
 * scope on every request; this only keeps the screens consistent.
 */
function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useSession()
  if (!roles.includes(role)) {
    return <Navigate to={roleHome[role]} replace />
  }
  return <>{children}</>
}

/** Sends anyone without a session to the sign-in page. */
function SessionGate() {
  const { status } = useSession()

  if (status === 'checking') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="caption-2 text-ink-500">Checking your session…</p>
      </div>
    )
  }

  if (status === 'signed-out') {
    return <Navigate to="/signin" replace />
  }

  return <Outlet />
}

function HomeRedirect() {
  const { role } = useSession()
  return <Navigate to={roleHome[role]} replace />
}

/** Remount the record when the USN changes so note drafts reset with it. */
function FacultyStudentRoute() {
  const { usn } = useParams()
  return <FacultyStudent key={usn} />
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="signin" element={<SignIn />} />
          <Route element={<AppShell />}>
            <Route element={<SessionGate />}>
              <Route index element={<HomeRedirect />} />
              <Route
                path="admin"
                element={
                  <RoleGate roles={['admin']}>
                    <AdminOverview />
                  </RoleGate>
                }
              />
              <Route
                path="admin/students"
                element={
                  <RoleGate roles={['admin']}>
                    <AdminStudents />
                  </RoleGate>
                }
              />
              <Route
                path="admin/verifications"
                element={
                  <RoleGate roles={['admin']}>
                    <AdminVerifications />
                  </RoleGate>
                }
              />
              <Route
                path="admin/insights"
                element={
                  <RoleGate roles={['admin']}>
                    <AdminInsights />
                  </RoleGate>
                }
              />
              <Route
                path="faculty"
                element={
                  <RoleGate roles={['faculty']}>
                    <FacultyCohort />
                  </RoleGate>
                }
              />
              <Route
                path="faculty/students/:usn"
                element={
                  <RoleGate roles={['faculty']}>
                    <FacultyStudentRoute />
                  </RoleGate>
                }
              />
              <Route
                path="faculty/sessions"
                element={
                  <RoleGate roles={['faculty']}>
                    <FacultySessions />
                  </RoleGate>
                }
              />
              <Route
                path="verify"
                element={
                  <RoleGate roles={['admin', 'faculty']}>
                    <VerifyConsole />
                  </RoleGate>
                }
              />
              <Route
                path="student"
                element={
                  <RoleGate roles={['student']}>
                    <StudentMyCard />
                  </RoleGate>
                }
              />
              <Route
                path="student/services"
                element={
                  <RoleGate roles={['student']}>
                    <StudentServices />
                  </RoleGate>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  )
}
