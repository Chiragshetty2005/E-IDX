import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { EInkCard } from '../../components/EInkCard'
import { QrPass } from '../../components/QrPass'
import { CardStatusPill } from '../../components/Status'
import { TrendChart } from '../../components/Charts'
import { buttonStyles } from '../../components/Button'
import { demoStudent, exams, loans } from '../../data/mock'

export function StudentMyCard() {
  const [view, setView] = useState<'identity' | 'services'>('identity')
  const student = demoStudent
  const attended = student.courses.reduce((sum, course) => sum + course.attended, 0)
  const held = student.courses.reduce((sum, course) => sum + course.held, 0)
  const nextExam = exams[0]

  return (
    <div>
      <PageHeader
        title="Your card"
        description="Your card is active and the last update reached it eight minutes ago."
        meta={
          <>
            <span className="font-mono caption-4 text-ink-500">{student.usn}</span>
            <span className="caption-4 text-ink-500">
              {student.semester}, {student.section}
            </span>
          </>
        }
      >
        <Link to="/student/services" className={buttonStyles('secondary', 'sm')}>
          All campus services
        </Link>
      </PageHeader>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-7">
          <div className="mb-4 inline-flex rounded-lg bg-paper-100 p-1" role="tablist" aria-label="Card view">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'identity'}
              onClick={() => setView('identity')}
              className={
                view === 'identity'
                  ? 'rounded-sm bg-paper-0 px-3 py-1 caption-3 text-ink-900'
                  : 'rounded-sm px-3 py-1 caption-3 text-ink-500 transition-colors duration-300 hover:text-ink-900'
              }
            >
              Identity view
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'services'}
              onClick={() => setView('services')}
              className={
                view === 'services'
                  ? 'rounded-sm bg-paper-0 px-3 py-1 caption-3 text-ink-900'
                  : 'rounded-sm px-3 py-1 caption-3 text-ink-500 transition-colors duration-300 hover:text-ink-900'
              }
            >
              Services view
            </button>
          </div>

          <EInkCard student={student} view={view} />

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <CardStatusPill status={student.card.status} />
            <p className="caption-5 text-ink-500">Battery {student.card.battery}%</p>
            <p className="caption-5 text-ink-500">Last sync {student.card.lastSync}</p>
            <p className="font-mono caption-5 text-ink-500">Valid to {student.card.validTo}</p>
          </div>

          <p className="mt-6 max-w-[560px] caption-5 text-ink-500 text-pretty">
            A tap on a campus reader opens the services view. Your card holds only what is needed
            for identity and campus access.
          </p>
        </section>

        <div className="min-w-0 lg:col-span-5">
          <QrPass student={student} />
        </div>
      </div>

      <section className="mt-10">
        <SectionHead
          title="Campus services"
          description="The same details your card shows on a tap."
          action={
            <Link to="/student/services" className="caption-1 text-link">
              Open details
            </Link>
          }
        />
        <dl className="mt-4 grid grid-cols-2 gap-4 border-y border-paper-200 py-4 sm:grid-cols-4 sm:divide-x sm:divide-paper-200">
          <div className="sm:pr-6">
            <dt className="caption-5 text-ink-500">Attendance</dt>
            <dd className="mt-1 font-mono heading-5 tabular-nums">
              {student.attendance.toFixed(1)}%
            </dd>
            <p className="mt-1 caption-5 text-ink-500">
              {attended} of {held} sessions
            </p>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Library</dt>
            <dd className="mt-1 body-1">No dues</dd>
            <p className="mt-1 caption-5 text-ink-500">{loans.length} books on loan</p>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Next exam</dt>
            <dd className="mt-1 font-mono heading-5">{nextExam.date.replace(' 2026', '')}</dd>
            <p className="mt-1 caption-5 text-ink-500">
              {nextExam.time}, {nextExam.hall}
            </p>
          </div>
          <div className="sm:pl-6">
            <dt className="caption-5 text-ink-500">Fees</dt>
            <dd className="mt-1 body-1">Paid</dd>
            <p className="mt-1 caption-5 text-ink-500">Semester VI, no dues</p>
          </div>
        </dl>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-7">
          <SectionHead
            title="Attendance by course"
            description="Sessions held this term and the share attended."
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Your attendance by course.</caption>
              <thead>
                <tr className="border-b border-paper-200">
                  <th className="py-2 pr-4 caption-3 text-ink-500" scope="col">
                    Course
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 caption-3 text-ink-500" scope="col">
                    Attended
                  </th>
                  <th className="py-2 pl-4 caption-3 text-ink-500" scope="col">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {student.courses.map((course) => {
                  const rate = (course.attended / course.held) * 100
                  return (
                    <tr key={course.code} className="border-b border-paper-200 last:border-b-0">
                      <th scope="row" className="py-3 pr-4 text-left">
                        <p className="body-5">{course.title}</p>
                        <p className="mt-0.5 font-mono caption-5 text-ink-500">{course.code}</p>
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 font-mono caption-4 text-ink-700">
                        {course.attended} of {course.held}
                      </td>
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="hidden h-2 w-24 rounded-full bg-paper-200 sm:block">
                            <div
                              className="h-2 rounded-full bg-ink-900"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="font-mono caption-4">{rate.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5">
          <SectionHead
            title="Academic standing"
            description={`CGPA ${student.cgpa.toFixed(2)} across six terms.`}
          />
          <div className="mt-4 rounded-2xl bg-paper-100 p-4 sm:p-6">
            <TrendChart
              data={student.sgpa.map((term) => ({ label: term.term, value: term.value }))}
              label={`SGPA moved from ${student.sgpa[0].value.toFixed(1)} in semester 1 to ${student.sgpa[5].value.toFixed(1)} in semester 6.`}
              min={4}
              max={10}
              suffix=""
            />
          </div>
        </section>
      </div>

      <section className="mt-10 rounded-2xl bg-paper-100 p-4 sm:p-6">
        <h2 className="heading-6">Academic support stays with your mentor</h2>
        <p className="mt-2 max-w-[680px] body-6 text-ink-700 text-pretty">
          Support conversations are private to you and {student.mentor}. They never appear on your
          card or change a grade. Office hours are Tuesday, 14:00 to 16:00, cabin B 312.
        </p>
      </section>
    </div>
  )
}
