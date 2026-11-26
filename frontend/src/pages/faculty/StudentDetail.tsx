import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle } from '@phosphor-icons/react'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { Button, buttonStyles } from '../../components/Button'
import { CardStatusPill, RiskPill } from '../../components/Status'
import { ShapBars, TrendChart } from '../../components/Charts'
import { EInkCard } from '../../components/EInkCard'
import { EmptyState } from '../../components/EmptyState'
import { modelInfo, shapFor, studentByUsn } from '../../data/mock'
import { riskLabel } from '../../lib/ui'
import type { Intervention } from '../../types'

export function FacultyStudent() {
  const { usn } = useParams()
  const student = usn ? studentByUsn.get(usn) : undefined

  const [notes, setNotes] = useState<Intervention[]>(student?.interventions ?? [])
  const [noteText, setNoteText] = useState('')
  const [saved, setSaved] = useState(false)

  if (!student) {
    return (
      <div>
        <Link to="/faculty" className="caption-1 text-link">
          All students
        </Link>
        <div className="mt-8">
          <EmptyState
            title="Student not found"
            description="This USN is not in the sample register. Go back to the cohort and choose a student."
            action={
              <Link to="/faculty" className={buttonStyles('secondary', 'sm')}>
                Back to cohort
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  const narrative =
    student.risk === 'support'
      ? `${student.driver} Assessment scores and recent VLE activity carry the largest weight in this run.`
      : student.risk === 'watch'
        ? `${student.driver} The model places this student in the watch tier rather than the support group.`
        : `No concerns this term. ${student.driver}`

  const saveNote = () => {
    const text = noteText.trim()
    if (!text) return
    setNotes([
      {
        date: '22 Nov 2026',
        note: text,
        by: 'Dr. Shahin Fatima',
      },
      ...notes,
    ])
    setNoteText('')
    setSaved(true)
  }

  return (
    <div>
      <Link to="/faculty" className="caption-1 text-link">
        All students
      </Link>

      <div className="mt-4">
        <PageHeader
          title={student.name}
          description={`${student.usn}, ${student.programme}, ${student.semester}, ${student.section}.`}
          meta={
            <>
              <span className="caption-4 text-ink-500">Mentor, {student.mentor}</span>
              <span className="font-mono caption-4 text-ink-500">{student.card.id}</span>
            </>
          }
        >
          <RiskPill risk={student.risk} />
        </PageHeader>
      </div>

      <section className="mt-8 border-y border-paper-200 py-4" aria-label="Academic record">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:divide-x sm:divide-paper-200">
          <div className="sm:pr-6">
            <dt className="caption-5 text-ink-500">Attendance</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">
              {student.attendance.toFixed(1)}%
            </dd>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">CGPA</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">
              {student.cgpa.toFixed(2)}
            </dd>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Open backlogs</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{student.backlogs}</dd>
          </div>
          <div className="sm:pl-6">
            <dt className="caption-5 text-ink-500">Assignment rate</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">
              {student.assignmentRate}%
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="min-w-0 space-y-8 lg:col-span-7">
          <section className="rounded-2xl bg-paper-100 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="caption-5 text-ink-500">Model verdict</p>
                <p className="mt-1 heading-5">{riskLabel[student.risk]}</p>
              </div>
              <div className="text-right">
                <p className="font-mono heading-4 tabular-nums">
                  {student.probability.toFixed(2)}
                </p>
                <p className="caption-5 text-ink-500">probability</p>
              </div>
            </div>

            <p className="mt-4 max-w-[560px] body-6 text-ink-700 text-pretty">{narrative}</p>

            <div className="mt-6">
              <h3 className="title-4 text-ink-700">Feature contributions</h3>
              <div className="mt-3">
                <ShapBars features={shapFor(student)} />
              </div>
            </div>

            <p className="mt-6 caption-5 text-ink-500">
              Generated 26 November 2026 with {modelInfo.name} build {modelInfo.build}. The model
              uses assessment and VLE features, not campus attendance. Use this as decision
              support, not as an automatic sanction.
            </p>
          </section>

          <section>
            <SectionHead
              title="Attendance by course"
              description="Sessions held this term and the share attended."
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Attendance by course for {student.name}.</caption>
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
                          <p className="mt-0.5 font-mono caption-5 text-ink-500">
                            {course.code}
                          </p>
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

          <section>
            <SectionHead
              title="SGPA trend"
              description="Semester grade point average across six terms."
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

        <div className="space-y-8 lg:col-span-5">
          <section>
            <SectionHead title="Card" description="Latest state on the student's card." />
            <div className="mt-4">
              <EInkCard student={student} size="compact" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <CardStatusPill status={student.card.status} />
              <p className="caption-5 text-ink-500">
                Battery {student.card.battery}%, last sync {student.card.lastSync}
              </p>
            </div>
          </section>

          <section>
            <SectionHead
              title="Mentor notes"
              description="Conversations and follow ups for this student."
            />
            <ul className="mt-2">
              {notes.map((note, index) => (
                <li
                  key={`${note.date}-${index}`}
                  className="border-b border-paper-200 py-3 last:border-b-0"
                >
                  <p className="font-mono caption-5 text-ink-500">{note.date}</p>
                  <p className="mt-1 body-6 text-pretty">{note.note}</p>
                  <p className="mt-1 caption-5 text-ink-500">{note.by}</p>
                </li>
              ))}
            </ul>

            {notes.length === 0 ? (
              <p className="mt-2 caption-2 text-ink-500">
                No notes yet. Record the first conversation after you meet.
              </p>
            ) : null}

            <div className="mt-6">
              <label htmlFor="mentor-note" className="field-label">
                Add a note
              </label>
              <textarea
                id="mentor-note"
                rows={3}
                value={noteText}
                onChange={(event) => {
                  setNoteText(event.target.value)
                  setSaved(false)
                }}
                placeholder="What did you discuss, and what happens next?"
                className="w-full resize-y rounded-lg border border-paper-300 bg-paper-0 px-3 py-2 body-5 transition-colors duration-300 hover:border-ink-400 focus:border-ink-900"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={saveNote} disabled={noteText.trim().length === 0}>
                  Save note
                </Button>
                {saved ? (
                  <p className="flex items-center gap-1 caption-5 text-verified" role="status">
                    <CheckCircle size={14} weight="bold" />
                    Note saved for {student.name.split(' ')[0]}.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
