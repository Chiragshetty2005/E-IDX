import { useState } from 'react'
import { Fingerprint, X } from '@phosphor-icons/react'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Pill } from '../../components/Status'
import { EmptyState } from '../../components/EmptyState'
import { DataNotice } from '../../components/DataNotice'
import { errorMessage } from '../../api/client'
import { endpoints } from '../../api/endpoints'
import { useSessions } from '../../data/hooks'
import { useSession } from '../../session'
import { liveTaps, students } from '../../data/mock'

interface Tap {
  name: string
  usn: string
  time: string
}

export function FacultySessions() {
  const { isLive, serverUser } = useSession()
  const { data: sessionRows, loading, error, refresh } = useSessions()

  const [openId, setOpenId] = useState<string | null>('S-442')
  const [closedIds, setClosedIds] = useState<string[]>(['S-441'])
  const [counts, setCounts] = useState<Record<string, number>>({
    'S-441': 54,
    'S-442': 41,
  })
  const [taps, setTaps] = useState<Tap[]>(liveTaps)
  const [tapIndex, setTapIndex] = useState(0)
  const [simulated, setSimulated] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)

  // In live mode the server owns the session state. The preview keeps the
  // original local simulation.
  const openSession = isLive
    ? (sessionRows.find((session) => session.status === 'open') ?? null)
    : (sessionRows.find((session) => session.id === openId) ?? null)

  const present = isLive
    ? (openSession?.present ?? 0) + simulated
    : openId
      ? counts[openId] ?? 0
      : 0
  const rate = openSession && openSession.total > 0 ? (present / openSession.total) * 100 : 0

  const nextSession = isLive
    ? (sessionRows.find((session) => session.status === 'upcoming') ?? null)
    : (sessionRows.find(
        (session) => session.id !== openId && !closedIds.includes(session.id),
      ) ?? null)

  const statusFor = (id: string) => {
    if (isLive) {
      return sessionRows.find((session) => session.id === id)?.status ?? 'upcoming'
    }
    if (id === openId) return 'open'
    if (closedIds.includes(id)) return 'closed'
    return 'upcoming'
  }

  const open = async (id: string) => {
    setActionError(null)
    if (isLive) {
      try {
        await endpoints.openSession(id)
        refresh()
      } catch (cause) {
        setActionError(errorMessage(cause))
      }
      return
    }

    setClosedIds((previous) => {
      const withClosed = openId ? [...previous, openId] : previous
      return withClosed.filter((item) => item !== id)
    })
    setOpenId(id)
    setCounts((previous) => ({ ...previous, [id]: previous[id] ?? 0 }))
    setTaps([])
  }

  const close = async () => {
    setActionError(null)
    if (isLive) {
      if (!openSession) return
      try {
        await endpoints.closeSession(openSession.id)
        setSimulated(0)
        refresh()
      } catch (cause) {
        setActionError(errorMessage(cause))
      }
      return
    }

    if (!openId) return
    setClosedIds((previous) => [...previous, openId])
    setOpenId(null)
  }

  const simulateTap = () => {
    if (!openSession) return
    const candidate =
      students.filter((student) => !taps.some((tap) => tap.usn === student.usn))[tapIndex] ??
      students[tapIndex % students.length]
    const [hours, minutes, seconds = 0] = (taps[0]?.time ?? openSession.start)
      .split(':')
      .map(Number)
    const totalSeconds = (hours * 3600 + minutes * 60 + seconds + 9) % 86400
    const time = [
      Math.floor(totalSeconds / 3600),
      Math.floor((totalSeconds % 3600) / 60),
      totalSeconds % 60,
    ]
      .map((value) => String(value).padStart(2, '0'))
      .join(':')
    setTaps(
      (previous) =>
        [{ name: candidate.name, usn: candidate.usn, time }, ...previous].slice(0, 8),
    )
    setTapIndex((index) => index + 1)
    if (isLive) {
      setSimulated((value) => value + 1)
    } else {
      setCounts((previous) => ({
        ...previous,
        [openSession.id]: Math.min(openSession.total, (previous[openSession.id] ?? 0) + 1),
      }))
    }
  }

  const cohortSize = sessionRows[0]?.total ?? 62
  const section = serverUser?.section ?? 'Section A'

  return (
    <div>
      <PageHeader
        title="Attendance sessions"
        description="Open a session and taps from the class are written to attendance."
        meta={
          <>
            <span className="caption-4 text-ink-500">Today</span>
            <span className="caption-4 text-ink-500">
              {section}, {cohortSize} students
            </span>
          </>
        }
      >
        {openSession ? (
          <Button variant="secondary" size="sm" onClick={() => void close()}>
            <X size={14} weight="bold" />
            Close session
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={!nextSession}
            onClick={() => nextSession && void open(nextSession.id)}
          >
            Open next session
          </Button>
        )}
      </PageHeader>

      <DataNotice loading={loading} error={error ?? actionError} />

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="min-w-0 space-y-8 lg:col-span-8">
          {openSession ? (
            <section className="rounded-2xl bg-paper-100 p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="caption-5 text-ink-500">Session open</p>
                  <p className="mt-1 heading-5">{openSession.title}</p>
                  <p className="mt-1 caption-2 text-ink-500">
                    {openSession.code}, {openSession.room}, {openSession.start} to {openSession.end}
                  </p>
                </div>
                <Pill label="Open now" tone="verified" />
              </div>

              <div className="mt-6 flex items-end justify-between gap-4">
                <p>
                  <span className="font-mono heading-3 tabular-nums">{present}</span>
                  <span className="ml-2 caption-2 text-ink-500">
                    of {openSession.total} present
                  </span>
                </p>
                <p className="font-mono caption-3">{rate.toFixed(1)}%</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-paper-200">
                <div
                  className="h-2 rounded-full bg-ink-900"
                  style={{ width: `${rate}%` }}
                />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={simulateTap} disabled={present >= openSession.total}>
                  <Fingerprint size={16} weight="bold" />
                  Simulate tap
                </Button>
                <p className="caption-5 text-ink-500">
                  {isLive
                    ? 'Simulated taps stay in this browser. A real reader writes attendance through the API.'
                    : 'Test only. No reader hardware is connected in this preview.'}
                </p>
              </div>

              <div className="mt-8">
                <h3 className="title-4">Recent taps</h3>
                {taps.length > 0 ? (
                  <ul className="mt-2 grid gap-x-8 sm:grid-cols-2">
                    {taps.map((tap) => (
                      <li
                        key={`${tap.usn}-${tap.time}`}
                        className="flex items-center justify-between gap-3 border-b border-paper-200 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-mono caption-5 text-ink-500">{tap.time}</span>
                          <span className="truncate caption-1">{tap.name}</span>
                        </div>
                        <span className="shrink-0 font-mono caption-5 text-ink-500">
                          {tap.usn.slice(-4)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 caption-2 text-ink-500">Waiting for the first tap.</p>
                )}
              </div>
            </section>
          ) : (
            <EmptyState
              title="No session is open"
              description="Open a session from the list to start logging taps. Only one session stays open at a time."
              action={
                nextSession ? (
                  <Button size="sm" onClick={() => void open(nextSession.id)}>
                    Open {nextSession.code}
                  </Button>
                ) : undefined
              }
            />
          )}

          <section>
            <SectionHead
              title="Today's sessions"
              description="Opening a session starts a fifty minute attendance window."
            />
            <ul className="mt-2 divide-y divide-paper-200 sm:hidden">
              {sessionRows.map((session) => {
                const status = statusFor(session.id)
                const count = counts[session.id]
                return (
                  <li key={session.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono caption-4">
                        {session.start} to {session.end}
                      </p>
                      <Pill
                        label={
                          status === 'open'
                            ? 'Open now'
                            : status === 'closed'
                              ? 'Closed'
                              : 'Upcoming'
                        }
                        tone={status === 'open' ? 'verified' : 'neutral'}
                      />
                    </div>
                    <p className="mt-1 body-5">{session.title}</p>
                    <p className="mt-0.5 font-mono caption-5 text-ink-500">
                      {session.code}, {session.room}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="caption-5 text-ink-500">
                        {status === 'upcoming'
                          ? 'Not started'
                          : `${count ?? session.present} of ${session.total} present`}
                      </p>
                      {status === 'open' ? (
                        <Button variant="secondary" size="sm" onClick={() => void close()}>
                          Close
                        </Button>
                      ) : status === 'upcoming' ? (
                        <Button variant="secondary" size="sm" onClick={() => void open(session.id)}>
                          Open
                        </Button>
                      ) : (
                        <span className="caption-5 text-ink-400">Ended</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Today's sessions, attendance and controls.</caption>
                <thead>
                  <tr className="border-b border-paper-200">
                    <th className="py-2 pr-4 caption-3 text-ink-500" scope="col">
                      Time
                    </th>
                    <th className="px-4 py-2 caption-3 text-ink-500" scope="col">
                      Course
                    </th>
                    <th className="hidden px-4 py-2 caption-3 text-ink-500 md:table-cell" scope="col">
                      Room
                    </th>
                    <th className="hidden px-4 py-2 caption-3 text-ink-500 sm:table-cell" scope="col">
                      Present
                    </th>
                    <th className="px-4 py-2 caption-3 text-ink-500" scope="col">
                      Status
                    </th>
                    <th className="py-2 pl-4 text-right caption-3 text-ink-500" scope="col">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessionRows.map((session) => {
                    const status = statusFor(session.id)
                    const count = counts[session.id]
                    return (
                      <tr
                        key={session.id}
                        className="border-b border-paper-200 last:border-b-0"
                      >
                        <td className="py-3 pr-4">
                          <p className="font-mono caption-3">{session.start}</p>
                          <p className="caption-5 text-ink-500">to {session.end}</p>
                        </td>
                        <th scope="row" className="px-4 py-3 text-left">
                          <p className="body-5">{session.title}</p>
                          <p className="font-mono caption-5 text-ink-500">
                            {session.code}, {session.room}
                          </p>
                        </th>
                        <td className="hidden px-4 py-3 body-6 text-ink-700 md:table-cell">
                          {session.room}
                        </td>
                        <td className="hidden px-4 py-3 font-mono caption-4 sm:table-cell">
                          {status === 'upcoming' ? (
                            <span className="text-ink-400">Not started</span>
                          ) : (
                            `${count ?? session.present} of ${session.total}`
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Pill
                            label={
                              status === 'open'
                                ? 'Open now'
                                : status === 'closed'
                                  ? 'Closed'
                                  : 'Upcoming'
                            }
                            tone={status === 'open' ? 'verified' : 'neutral'}
                          />
                        </td>
                        <td className="py-3 pl-4 text-right">
                          {status === 'open' ? (
                            <Button variant="secondary" size="sm" onClick={() => void close()}>
                              Close
                            </Button>
                          ) : status === 'upcoming' ? (
                            <Button variant="secondary" size="sm" onClick={() => void open(session.id)}>
                              Open
                            </Button>
                          ) : (
                            <span className="caption-5 text-ink-400">Ended</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 caption-5 text-ink-500">
              Taps outside an open session are not written to attendance.
            </p>
          </section>
        </div>

        <aside className="space-y-8 lg:col-span-4">
          <section>
            <SectionHead title="How a tap is handled" />
            <ul className="mt-2">
              <li className="border-b border-paper-200 py-3 last:border-b-0">
                <p className="body-5">The reader sends a challenge</p>
                <p className="mt-1 caption-5 text-ink-500 text-pretty">
                  The card signs it with its per card key. A cloned UID is never enough.
                </p>
              </li>
              <li className="border-b border-paper-200 py-3 last:border-b-0">
                <p className="body-5">The backend decides</p>
                <p className="mt-1 caption-5 text-ink-500 text-pretty">
                  Card status, token freshness and the session window are checked before a row is
                  written.
                </p>
              </li>
              <li className="border-b border-paper-200 py-3 last:border-b-0">
                <p className="body-5">A revoked card is rejected</p>
                <p className="mt-1 caption-5 text-ink-500 text-pretty">
                  No attendance is recorded, and the reader shows a rejection.
                </p>
              </li>
              <li className="py-3">
                <p className="body-5">Offline taps wait</p>
                <p className="mt-1 caption-5 text-ink-500 text-pretty">
                  A reader queues taps and syncs when the network returns.
                </p>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl bg-paper-100 p-4">
            <h2 className="heading-6">Session defaults</h2>
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-2 text-ink-500">Reader</dt>
                <dd className="font-mono caption-3">CSE 03</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-2 text-ink-500">Window</dt>
                <dd className="caption-3">50 minutes</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-2 text-ink-500">Late after</dt>
                <dd className="caption-3">10 minutes</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-2 text-ink-500">Method</dt>
                <dd className="caption-3">NFC or QR</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}
