import { Link } from 'react-router-dom'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { Pill, RiskPill } from '../../components/Status'
import { TrendChart } from '../../components/Charts'
import { buttonStyles } from '../../components/Button'
import { DataNotice } from '../../components/DataNotice'
import { useCohort } from '../../data/hooks'
import { useSession } from '../../session'
import { attendanceTrend } from '../../data/mock'

export function FacultyCohort() {
  const { user, serverUser } = useSession()
  const { data, loading, error } = useCohort()
  const { students, support, watch, interventions30d, watchlist, sessions } = data
  const flagged = support + watch
  const section = serverUser?.section ?? 'Section A'
  const courseCount = new Set(sessions.map((session) => session.code)).size

  return (
    <div>
      <PageHeader
        title="CSE, Semester VI"
        description={`${section}, ${students.toLocaleString('en-IN')} students in your cohort this term.`}
        meta={
          <>
            <span className="caption-4 text-ink-500">Mentor, {user.name}</span>
            <span className="caption-4 text-ink-500">Week 8</span>
          </>
        }
      >
        <Link to="/faculty/sessions" className={buttonStyles('secondary', 'sm')}>
          Attendance sessions
        </Link>
      </PageHeader>

      <DataNotice loading={loading} error={error} />

      <section className="mt-8 border-y border-paper-200 py-4" aria-label="Cohort figures">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:divide-x sm:divide-paper-200">
          <div className="sm:pr-6">
            <dt className="caption-5 text-ink-500">Attendance this week</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">80.4%</dd>
            <p className="mt-1 caption-5 text-ink-500">Illustrative weekly average</p>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Mentor notes</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{interventions30d}</dd>
            <p className="mt-1 caption-5 text-ink-500">Logged in the last 30 days</p>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Sessions today</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{sessions.length}</dd>
            <p className="mt-1 caption-5 text-ink-500">
              Across {courseCount} course{courseCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="sm:pl-6">
            <dt className="caption-5 text-ink-500">Need support</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{support}</dd>
            <p className="mt-1 caption-5 text-ink-500">{watch} more are on watch</p>
          </div>
        </dl>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <SectionHead
            title="Students who need support"
            description="Ranked by the latest model run. Reasons come from SHAP."
            action={
              <span className="caption-5 text-ink-500">
                Showing {Math.min(6, watchlist.length)} of {flagged}
              </span>
            }
          />
          <ul className="mt-2">
            {watchlist.slice(0, 6).map((student) => (
              <li key={student.usn} className="border-b border-paper-200 py-4 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="body-1">{student.name}</p>
                      <RiskPill risk={student.risk} />
                    </div>
                    <p className="mt-1 font-mono caption-5 text-ink-500">
                      {student.usn}, {student.semester}
                    </p>
                    <p className="mt-2 max-w-[520px] body-6 text-ink-700 text-pretty">
                      {student.driver}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="font-mono heading-6">{student.probability.toFixed(2)}</p>
                    <p className="caption-5 text-ink-500">probability</p>
                    <Link
                      to={`/faculty/students/${student.usn}`}
                      className="caption-1 text-link"
                    >
                      Open student
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {watchlist.length === 0 ? (
            <p className="mt-3 caption-2 text-ink-500">
              No students in this section are flagged in the latest run.
            </p>
          ) : null}
          <p className="mt-4 max-w-[680px] caption-5 text-ink-500 text-pretty">
            Each flag is a prompt for a conversation. The model never changes a grade, a fee record
            or a student's card status.
          </p>
        </section>

        <div className="space-y-8 lg:col-span-5">
          <section>
            <SectionHead
              title="Attendance trend"
              description="Illustrative section average. Weekly attendance history is not stored yet."
            />
            <div className="mt-4 rounded-2xl bg-paper-100 p-4 sm:p-6">
              <TrendChart
                data={attendanceTrend}
                label="Section attendance fell from 87.4 percent in week 1 to 80.4 percent in week 8."
              />
            </div>
          </section>

          <section>
            <SectionHead
              title="Today's sessions"
              description="Tap a card during an open session to log attendance."
              action={
                <Link to="/faculty/sessions" className="caption-1 text-link">
                  All sessions
                </Link>
              }
            />
            <ul className="mt-2">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-start justify-between gap-3 border-b border-paper-200 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-mono caption-3">
                      {session.start} to {session.end}
                    </p>
                    <p className="mt-0.5 body-5">{session.title}</p>
                    <p className="mt-0.5 caption-5 text-ink-500">{session.room}</p>
                  </div>
                  <Pill
                    label={
                      session.status === 'open'
                        ? 'Open now'
                        : session.status === 'closed'
                          ? 'Closed'
                          : 'Upcoming'
                    }
                    tone={session.status === 'open' ? 'verified' : 'neutral'}
                  />
                </li>
              ))}
            </ul>
            {sessions.length === 0 ? (
              <p className="mt-3 caption-2 text-ink-500">No sessions are scheduled for today.</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
