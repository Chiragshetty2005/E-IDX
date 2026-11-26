import { Link } from 'react-router-dom'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { CardStudio } from '../../components/CardStudio'
import { RiskBar } from '../../components/Charts'
import { ResultPill, CardStatusPill, Pill } from '../../components/Status'
import { buttonStyles } from '../../components/Button'
import {
  campusRisk,
  campusStats,
  recentCardUpdates,
  recentVerifications,
  studentByUsn,
  students,
} from '../../data/mock'

const attentionCards = students.filter((student) => student.card.status !== 'active')

const attentionNotes: Record<string, string> = {
  sync: 'Queued for the next wake',
  'low-battery': 'Charge before 10:00 tomorrow',
  revoked: 'Replacement not issued',
  unprovisioned: 'No card assigned',
  active: '',
}

export function AdminOverview() {
  return (
    <div>
      <PageHeader
        title="Campus overview"
        description="Card activity, sync health and academic signals across the university."
        meta={
          <>
            <span className="caption-4 text-ink-500">Sunday, 22 November 2026</span>
            <span className="caption-4 text-ink-500">Semester VI</span>
          </>
        }
      >
        <Link to="/admin/insights" className={buttonStyles('secondary', 'sm')}>
          Open academic insights
        </Link>
      </PageHeader>

      <section className="mt-8 border-y border-paper-200 py-4" aria-label="Campus figures">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:divide-x sm:divide-paper-200">
          <div className="sm:pr-6">
            <dt className="caption-5 text-ink-500">Active cards</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">
              {campusStats.activeCards.toLocaleString('en-IN')}
            </dd>
            <p className="mt-1 caption-5 text-ink-500">99.1% synced in the last hour</p>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Awaiting sync</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{campusStats.awaitingSync}</dd>
            <p className="mt-1 caption-5 text-ink-500">18 retried, 19 queued</p>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Verifications today</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">
              {campusStats.verificationsToday.toLocaleString('en-IN')}
            </dd>
            <p className="mt-1 caption-5 text-ink-500">99.4% accepted</p>
          </div>
          <div className="sm:pl-6">
            <dt className="caption-5 text-ink-500">Students needing support</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{campusStats.needsSupport}</dd>
            <p className="mt-1 caption-5 text-ink-500">10.0% of the student body</p>
          </div>
        </dl>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <CardStudio />

          <section className="mt-8">
            <SectionHead
              title="Recent card updates"
              description="Sent to cards in the last hour."
              action={
                <Link to="/admin/students" className="caption-1 text-link">
                  Open register
                </Link>
              }
            />
            <ul className="mt-2">
              {recentCardUpdates.map((update) => {
                const student = studentByUsn.get(update.usn)
                if (!student) return null
                return (
                  <li
                    key={update.id}
                    className="border-b border-paper-200 py-3 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate body-5">{student.name}</p>
                      <Pill
                        label={update.state === 'queued' ? 'Queued' : 'Confirmed'}
                        tone={update.state === 'queued' ? 'attention' : 'verified'}
                        className="shrink-0"
                      />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-3">
                      <p
                        className="min-w-0 truncate caption-5 text-ink-500"
                        title={`${student.card.id}, ${update.change}`}
                      >
                        {student.card.id}, {update.change}
                      </p>
                      <span className="shrink-0 font-mono caption-5 text-ink-500">
                        {update.time}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <div className="min-w-0 space-y-8 lg:col-span-5">
          <section>
            <SectionHead
              title="Recent verifications"
              description="Server decisions from the last ten minutes."
              action={
                <Link to="/admin/verifications" className="caption-1 text-link">
                  Open log
                </Link>
              }
            />
            <ul className="mt-2">
              {recentVerifications.slice(0, 5).map((item) => {
                const student = studentByUsn.get(item.usn)
                if (!student) return null
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-paper-200 py-3 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-paper-50 caption-5">
                        {student.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate body-5">{student.name}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 caption-5 text-ink-500">
                          <span className="font-mono">{item.time}</span>
                          <span>{item.method === 'qr' ? 'QR scan' : 'NFC tap'}</span>
                          <span>{item.location}</span>
                        </p>
                      </div>
                    </div>
                    <ResultPill result={item.result} />
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <SectionHead
              title="Cards needing attention"
              description="Revoked, low battery or waiting for a sync."
              action={
                <Link to="/admin/students" className="caption-1 text-link">
                  View cards
                </Link>
              }
            />
            <ul className="mt-2">
              {attentionCards.map((student) => (
                <li
                  key={student.usn}
                  className="flex items-center justify-between gap-3 border-b border-paper-200 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate body-5">{student.name}</p>
                    <p className="mt-0.5 font-mono caption-5 text-ink-500">
                      {student.card.id}, {attentionNotes[student.card.status]}
                    </p>
                  </div>
                  <CardStatusPill status={student.card.status} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="mt-10">
        <SectionHead
          title="Academic snapshot"
          description="Risk classes from the current term model run."
          action={
            <Link to="/admin/insights" className="caption-1 text-link">
              Open academic insights
            </Link>
          }
        />
        <div className="mt-4 rounded-2xl bg-paper-100 p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="heading-5">{campusRisk.support} students need support</p>
              <p className="mt-1 caption-2 text-ink-500">
                CatBoost build 2026.11.26, trained on 26,361 active enrolments at day 60.
              </p>
            </div>
            <p className="caption-5 text-ink-500">
              {((campusRisk.support / campusRisk.total) * 100).toFixed(1)}% of 4,786 students
            </p>
          </div>
          <div className="mt-6">
            <RiskBar
              support={campusRisk.support}
              watch={campusRisk.watch}
              onTrack={campusRisk.onTrack}
              total={campusRisk.total}
            />
          </div>
          <p className="mt-6 max-w-[680px] caption-5 text-ink-500 text-pretty">
            Socio economic attributes are excluded from the deployed model. Predictions support
            mentors and are never used for automatic sanctions.
          </p>
        </div>
      </section>
    </div>
  )
}
