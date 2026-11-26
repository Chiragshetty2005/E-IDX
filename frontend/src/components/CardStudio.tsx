import { useState } from 'react'
import { ArrowsClockwise, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { students, demoStudentUsn } from '../data/mock'
import { cn } from '../lib/ui'
import { EInkCard } from './EInkCard'
import { Button } from './Button'

const programmeOptions = [
  { value: 'B.E. Computer science and engineering', label: 'B.E. CSE' },
  { value: 'B.E. Artificial intelligence and machine learning', label: 'B.E. AI and ML' },
  { value: 'B.Tech Information technology', label: 'B.Tech IT' },
]

const validityOptions = ['Dec 2026', 'Jun 2027', 'Dec 2027']

export function CardStudio() {
  const [usn, setUsn] = useState(demoStudentUsn)
  const student = students.find((item) => item.usn === usn) ?? students[0]
  const [view, setView] = useState<'identity' | 'services'>('identity')
  const [programme, setProgramme] = useState(student.programme)
  const [validity, setValidity] = useState(student.card.validTo)
  const [servicesOnTap, setServicesOnTap] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSync, setLastSync] = useState(student.card.lastSync)
  const [message, setMessage] = useState<{ tone: 'verified' | 'critical'; text: string } | null>(
    null,
  )

  const blocked = student.card.status === 'revoked' || student.card.status === 'unprovisioned'

  const selectStudent = (nextUsn: string) => {
    if (refreshing) return
    const next = students.find((item) => item.usn === nextUsn) ?? students[0]
    setUsn(nextUsn)
    setProgramme(next.programme)
    setValidity(next.card.validTo)
    setLastSync(next.card.lastSync)
    setMessage(null)
    if (next.card.status === 'revoked' || next.card.status === 'unprovisioned') {
      setView('identity')
    }
  }

  const pushUpdate = () => {
    if (blocked || refreshing) return
    setRefreshing(true)
    setMessage(null)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(
      () => {
        setRefreshing(false)
        setLastSync('Just now')
        setMessage({
          tone: 'verified',
          text: `Update confirmed on card ${student.card.id} just now.`,
        })
      },
      reduced ? 120 : 850,
    )
  }

  return (
    <section className="min-w-0 rounded-2xl bg-paper-100 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="heading-6">Card studio</h2>
          <p className="mt-1 caption-2 text-ink-500">
            Change a record and send it to the card without a reprint.
          </p>
        </div>
        <p className="font-mono caption-4 text-ink-500">{student.card.id}</p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-5">
        <div className="min-w-0 md:col-span-3">
          <div className="mb-4 inline-flex rounded-lg bg-paper-200 p-1" role="tablist" aria-label="Card view">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'identity'}
              onClick={() => setView('identity')}
              className={cn(
                'rounded-sm px-3 py-1 caption-3 transition-colors duration-300 ease-base',
                view === 'identity'
                  ? 'bg-paper-0 text-ink-900'
                  : 'text-ink-500 hover:text-ink-900',
              )}
            >
              Identity view
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'services'}
              disabled={!servicesOnTap}
              onClick={() => setView('services')}
              className={cn(
                'rounded-sm px-3 py-1 caption-3 transition-colors duration-300 ease-base',
                view === 'services'
                  ? 'bg-paper-0 text-ink-900'
                  : 'text-ink-500 hover:text-ink-900',
                !servicesOnTap && 'cursor-not-allowed opacity-40 hover:text-ink-500',
              )}
            >
              Services view
            </button>
          </div>

          <EInkCard
            student={student}
            view={view}
            programme={programme}
            validTo={validity}
            refreshing={refreshing}
          />

          <dl className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <dt className="caption-5 text-ink-500">Battery</dt>
              <dd className="mt-1 font-mono caption-3">{student.card.battery}%</dd>
            </div>
            <div>
              <dt className="caption-5 text-ink-500">Last sync</dt>
              <dd className="mt-1 caption-3">{lastSync}</dd>
            </div>
            <div>
              <dt className="caption-5 text-ink-500">Firmware</dt>
              <dd className="mt-1 font-mono caption-3">{student.card.firmware}</dd>
            </div>
          </dl>
        </div>

        <div className="min-w-0 md:col-span-2">
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="studio-student">
                Student
              </label>
              <select
                id="studio-student"
                className="field"
                value={usn}
                disabled={refreshing}
                onChange={(event) => selectStudent(event.target.value)}
              >
                {students.map((item) => (
                  <option key={item.usn} value={item.usn}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="studio-programme">
                Programme
              </label>
              <select
                id="studio-programme"
                className="field"
                value={programme}
                onChange={(event) => setProgramme(event.target.value)}
              >
                {programmeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="studio-validity">
                Card valid until
              </label>
              <select
                id="studio-validity"
                className="field"
                value={validity}
                onChange={(event) => setValidity(event.target.value)}
              >
                {validityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-start gap-2">
              <input
                id="studio-services"
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-ink-900"
                checked={servicesOnTap}
                onChange={(event) => {
                  setServicesOnTap(event.target.checked)
                  if (!event.target.checked) setView('identity')
                }}
              />
              <label htmlFor="studio-services" className="body-5">
                Open services view on tap
                <span className="mt-1 block caption-5 text-ink-500">
                  Shows attendance, library, exam and fee status.
                </span>
              </label>
            </div>

            <Button className="w-full" onClick={pushUpdate} disabled={blocked || refreshing}>
              <ArrowsClockwise
                size={16}
                weight="bold"
                className={refreshing ? 'animate-spin' : undefined}
              />
              {refreshing ? 'Pushing update' : 'Push update'}
            </Button>

            {blocked ? (
              <p className="flex items-start gap-2 caption-5 text-critical" role="status">
                <WarningCircle size={16} weight="bold" className="mt-0.5 shrink-0" />
                This card is {student.card.status === 'revoked' ? 'revoked' : 'not provisioned'}. Provision a
                replacement before pushing updates.
              </p>
            ) : null}

            {message ? (
              <p
                className={cn(
                  'flex items-start gap-2 caption-5',
                  message.tone === 'verified' ? 'text-verified' : 'text-critical',
                )}
                role="status"
                aria-live="polite"
              >
                <CheckCircle size={16} weight="bold" className="mt-0.5 shrink-0" />
                {message.text}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
