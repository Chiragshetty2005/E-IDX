import { useMemo, useState } from 'react'
import { MagnifyingGlass, PaperPlaneTilt } from '@phosphor-icons/react'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { PresencePill } from '../../components/Status'
import { EmptyState } from '../../components/EmptyState'
import { DataNotice } from '../../components/DataNotice'
import { Button } from '../../components/Button'
import { usePresenceOverview } from '../../data/hooks'
import { useSession } from '../../session'
import { endpoints } from '../../api/endpoints'
import { errorMessage } from '../../api/client'
import { formatRelative } from '../../api/adapters'
import { cn, methodLabel, zoneLabel } from '../../lib/ui'
import type { CheckpointZone } from '../../types'

type Level = 'school' | 'college'

const scopeOptions: Array<{ value: Level; label: string }> = [
  { value: 'school', label: 'School pilot' },
  { value: 'college', label: 'College' },
]

export function AdminPresence() {
  const { isLive } = useSession()
  const [level, setLevel] = useState<Level>('school')
  const { data, loading, error, refresh } = usePresenceOverview(level)

  const [query, setQuery] = useState('')
  const [zone, setZone] = useState<'all' | CheckpointZone>('all')

  const [studentUsn, setStudentUsn] = useState('')
  const [checkpointCode, setCheckpointCode] = useState('')
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [method, setMethod] = useState<'uhf' | 'qr' | 'nfc'>('uhf')
  const [simMessage, setSimMessage] = useState<string | null>(null)
  const [simError, setSimError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const changeLevel = (next: Level) => {
    if (next === level) return
    setLevel(next)
    setSimMessage(null)
    setSimError(null)
    setStudentUsn('')
    setCheckpointCode('')
  }

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return data.students.filter((student) => {
      const matchesSearch =
        search.length === 0 ||
        student.name.toLowerCase().includes(search) ||
        student.usn.toLowerCase().includes(search)
      const matchesZone = zone === 'all' || student.checkpoint?.zone === zone
      return matchesSearch && matchesZone
    })
  }, [data.students, query, zone])

  const zoneTotal = Math.max(1, ...data.zones.map((entry) => entry.count))

  const submitSimulation = async () => {
    setSimMessage(null)
    setSimError(null)

    if (!studentUsn || !checkpointCode) {
      setSimError('Choose a student and a checkpoint first.')
      return
    }

    if (!isLive) {
      setSimMessage(
        'Preview mode: the sample register cannot take a simulated read. Connect the API to raise a real one.',
      )
      return
    }

    setSending(true)
    try {
      const response = await endpoints.simulatePresence({
        student_usn: studentUsn,
        checkpoint_code: checkpointCode,
        direction,
        method,
      })
      setSimMessage(
        `${response.notification.message} ${response.notification.recipients} parent notification${
          response.notification.recipients === 1 ? '' : 's'
        } raised.`,
      )
      refresh()
    } catch (cause) {
      setSimError(errorMessage(cause))
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Campus presence"
        description="Hands-free checkpoint reads from the bus, the gate and the classrooms."
        meta={
          <>
            <span className="caption-4 text-ink-500">{data.scope.label}</span>
            <span className="caption-4 text-ink-500">
              Last read {data.summary.lastEventAt ? formatRelative(data.summary.lastEventAt) : 'never'}
            </span>
          </>
        }
      >
        <div className="inline-flex rounded-lg bg-paper-100 p-1" role="tablist" aria-label="Campus level">
          {scopeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={level === option.value}
              onClick={() => changeLevel(option.value)}
              className={cn(
                'rounded-sm px-3 py-1 caption-3 transition-colors duration-300',
                level === option.value
                  ? 'bg-paper-0 text-ink-900'
                  : 'text-ink-500 hover:text-ink-900',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <DataNotice loading={loading} error={error} />

      <section className="mt-8 border-y border-paper-200 py-4" aria-label="Presence figures">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-paper-200">
          <div className="lg:pr-6">
            <dt className="caption-5 text-ink-500">On campus</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{data.summary.onCampus}</dd>
            <p className="mt-1 caption-5 text-ink-500">of {data.summary.expected} expected</p>
          </div>
          <div className="lg:px-6">
            <dt className="caption-5 text-ink-500">On the bus</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{data.summary.onBus}</dd>
            <p className="mt-1 caption-5 text-ink-500">logged at the bus door</p>
          </div>
          <div className="lg:px-6">
            <dt className="caption-5 text-ink-500">Left campus</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{data.summary.leftCampus}</dd>
            <p className="mt-1 caption-5 text-ink-500">picked up already</p>
          </div>
          <div className="lg:px-6">
            <dt className="caption-5 text-ink-500">Not arrived</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{data.summary.notArrived}</dd>
            <p className="mt-1 caption-5 text-ink-500">no read today</p>
          </div>
          <div className="lg:pl-6">
            <dt className="caption-5 text-ink-500">Alerts sent</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{data.summary.alertsToday}</dd>
            <p className="mt-1 caption-5 text-ink-500">push and SMS today</p>
          </div>
        </dl>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-7">
          <SectionHead
            title="Live on campus"
            description="The latest read for each student in this scope."
            action={
              <span className="caption-5 text-ink-500">
                {filtered.length} of {data.students.length}
              </span>
            }
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                aria-hidden="true"
              />
              <label htmlFor="presence-search" className="sr-only">
                Search by name or USN
              </label>
              <input
                id="presence-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or USN"
                className="field pl-9"
              />
            </div>
            <label htmlFor="presence-zone" className="sr-only">
              Filter by zone
            </label>
            <select
              id="presence-zone"
              value={zone}
              onChange={(event) => setZone(event.target.value as 'all' | CheckpointZone)}
              className="field sm:w-44"
            >
              <option value="all">All zones</option>
              {(Object.keys(zoneLabel) as CheckpointZone[]).map((value) => (
                <option key={value} value={value}>
                  {zoneLabel[value]}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No student matches this filter"
                description="Clear the search or pick another zone to see the rest of the register."
              />
            </div>
          ) : (
            <ul className="mt-4 max-h-[32rem] overflow-y-auto border-t border-paper-200">
              {filtered.map((student) => (
                <li key={student.usn} className="border-b border-paper-200 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 caption-5 text-paper-50">
                        {student.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate body-5">{student.name}</p>
                        <p className="mt-0.5 truncate font-mono caption-5 text-ink-500">
                          {student.classLabel ?? student.section ?? student.usn}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="hidden text-right sm:block">
                        <p className="caption-5 text-ink-700">
                          {student.checkpoint ? student.checkpoint.name : 'No read today'}
                        </p>
                        <p className="font-mono caption-5 text-ink-500">
                          {student.time}
                          {student.method ? ` · ${methodLabel[student.method] ?? student.method}` : ''}
                        </p>
                      </div>
                      <PresencePill state={student.state} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="min-w-0 space-y-8 lg:col-span-5">
          <section>
            <SectionHead
              title="Where students are"
              description="Latest read grouped by checkpoint zone."
            />
            <ul className="mt-4 space-y-3">
              {data.zones.length === 0 ? (
                <li className="caption-2 text-ink-500">No checkpoint reads yet today.</li>
              ) : (
                data.zones.map((entry) => (
                  <li key={entry.zone}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="caption-2 text-ink-700">{entry.label}</span>
                      <span className="font-mono caption-4 text-ink-700">{entry.count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-paper-200">
                      <div
                        className="h-2 rounded-full bg-ink-900"
                        style={{ width: `${Math.max(4, (entry.count / zoneTotal) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-2xl bg-paper-100 p-5">
            <SectionHead
              title="Emergency headcount"
              description="Expected against present, by class."
            />
            <div className="mt-4 flex items-baseline gap-3">
              <p className="font-mono heading-4 tabular-nums">{data.headcount.present}</p>
              <p className="caption-2 text-ink-500">
                present of {data.headcount.expected} expected
              </p>
            </div>
            <ul className="mt-4 space-y-2">
              {data.headcount.byClass.map((row) => (
                <li key={row.label} className="flex items-baseline justify-between gap-3">
                  <span className="caption-2 text-ink-700">{row.label}</span>
                  <span className="font-mono caption-4 text-ink-700">
                    {row.present} / {row.expected}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 caption-5 text-ink-500 text-pretty">
              A child is counted present when the last read was an entry at the gate, a classroom,
              the library or the canteen. The bus and the exit gate are not counted as on campus.
            </p>
          </section>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-7">
          <SectionHead
            title="Checkpoint feed"
            description="The latest reads, newest first."
          />
          <ul className="mt-2">
            {data.events.slice(0, 12).map((event) => (
              <li key={event.id} className="border-b border-paper-200 py-3 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate body-5">{event.name}</p>
                    <p className="mt-0.5 truncate caption-5 text-ink-500">
                      {event.checkpoint.name} · {methodLabel[event.method] ?? event.method}
                      {event.source === 'simulated' ? ' · simulated' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono caption-5 text-ink-500">{event.time}</span>
                    {event.notifications > 0 ? (
                      <span className="caption-5 text-ink-500">
                        {event.notifications} alert{event.notifications === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
            {data.events.length === 0 ? (
              <li className="py-3 caption-2 text-ink-500">No reads recorded today.</li>
            ) : null}
          </ul>
        </section>

        <section className="min-w-0 lg:col-span-5">
          <SectionHead
            title="Simulate a reader"
            description="Stands in for a UHF reader during the demo."
          />

          <div className="mt-4 space-y-4 rounded-2xl border border-paper-200 bg-paper-0 p-5">
            <div>
              <label htmlFor="sim-student" className="field-label">
                Student
              </label>
              <select
                id="sim-student"
                value={studentUsn}
                onChange={(event) => setStudentUsn(event.target.value)}
                className="field"
              >
                <option value="">Choose a student</option>
                {data.students.map((student) => (
                  <option key={student.usn} value={student.usn}>
                    {student.name} · {student.classLabel ?? student.section ?? student.usn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sim-checkpoint" className="field-label">
                Checkpoint
              </label>
              <select
                id="sim-checkpoint"
                value={checkpointCode}
                onChange={(event) => setCheckpointCode(event.target.value)}
                className="field"
              >
                <option value="">Choose a checkpoint</option>
                {data.checkpoints.map((checkpoint) => (
                  <option key={checkpoint.code} value={checkpoint.code}>
                    {checkpoint.name} · {zoneLabel[checkpoint.zone]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sim-direction" className="field-label">
                  Direction
                </label>
                <select
                  id="sim-direction"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value as 'in' | 'out')}
                  className="field"
                >
                  <option value="in">Entry</option>
                  <option value="out">Exit</option>
                </select>
              </div>
              <div>
                <label htmlFor="sim-method" className="field-label">
                  Method
                </label>
                <select
                  id="sim-method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value as 'uhf' | 'qr' | 'nfc')}
                  className="field"
                >
                  <option value="uhf">UHF read</option>
                  <option value="qr">QR scan</option>
                  <option value="nfc">NFC tap</option>
                </select>
              </div>
            </div>

            <Button type="button" onClick={() => void submitSimulation()} disabled={sending}>
              {sending ? 'Raising the read…' : 'Raise a simulated read'}
              <PaperPlaneTilt size={16} weight="bold" />
            </Button>

            {simMessage ? (
              <p className="caption-5 text-verified" role="status" aria-live="polite">
                {simMessage}
              </p>
            ) : null}
            {simError ? (
              <p className="caption-5 text-critical" role="alert">
                {simError}
              </p>
            ) : null}

            <p className="caption-5 text-ink-500 text-pretty">
              A browser cannot read a passive UHF tag. This control writes the same event a reader
              would post, so the parent alert and the headcount can be shown end to end.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
