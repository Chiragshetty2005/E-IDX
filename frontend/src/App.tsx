import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
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

/**
 * Prototype access boundary. Real access control belongs on the server; this
 * keeps the preview consistent while switching roles.
 */
function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useSession()
  if (!roles.includes(role)) {
    return <Navigate to={roleHome[role]} replace />
  }
  return <>{children}</>
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
          <Route element={<AppShell />}>
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
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  )
}
