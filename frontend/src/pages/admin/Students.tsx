import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { PageHeader } from '../../components/PageHeader'
import { Button, buttonStyles } from '../../components/Button'
import { CardStatusPill, RiskPill } from '../../components/Status'
import { Drawer } from '../../components/Drawer'
import { EInkCard } from '../../components/EInkCard'
import { EmptyState } from '../../components/EmptyState'
import { DataNotice } from '../../components/DataNotice'
import { errorMessage } from '../../api/client'
import { endpoints } from '../../api/endpoints'
import { useStudentsPage, useStudentRecord } from '../../data/hooks'
import { useSession } from '../../session'
import { useDebounced } from '../../lib/useDebounced'
import { cardStatusLabel, cn } from '../../lib/ui'
import type { CardStatus } from '../../types'

const statusOptions: { value: CardStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: cardStatusLabel.active },
  { value: 'sync', label: cardStatusLabel.sync },
  { value: 'low-battery', label: cardStatusLabel['low-battery'] },
  { value: 'revoked', label: cardStatusLabel.revoked },
]

function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `card-update-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function AdminStudents() {
  const { isLive } = useSession()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CardStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [selectedUsn, setSelectedUsn] = useState<string | null>(null)
  const [queuedFor, setQueuedFor] = useState<string | null>(null)
  const [queueMessage, setQueueMessage] = useState<string | null>(null)

  const debouncedQuery = useDebounced(query, 250)

  const { data, loading, error } = useStudentsPage(debouncedQuery, status, page)
  const { data: record, loading: recordLoading } = useStudentRecord(selectedUsn)

  const rows = data.students
  const hasFilters = query.trim().length > 0 || status !== 'all'
  const selectedRow = rows.find((row) => row.usn === selectedUsn) ?? null

  const clearFilters = () => {
    setQuery('')
    setStatus('all')
    setPage(1)
  }

  const queueUpdate = async () => {
    if (!record) return
    if (!isLive) {
      setQueuedFor(record.usn)
      setQueueMessage(`Update queued for ${record.card.id}. It will be sent at the next wake.`)
      return
    }

    try {
      const response = await endpoints.queueCardUpdate(record.usn, {
        change_type: 'status',
        summary: 'Card record confirmed from the register',
        payload: { status: record.card.status },
        idempotency_key: idempotencyKey(),
      })
      setQueuedFor(record.usn)
      setQueueMessage(
        response.update.state === 'confirmed'
          ? `Update confirmed on ${record.card.id}.`
          : `Update queued for ${record.card.id}. It will be sent at the next wake.`,
      )
    } catch (cause) {
      setQueueMessage(errorMessage(cause))
    }
  }

  return (
    <div>
      <PageHeader
        title="Students and cards"
        description="Find a student, inspect their card and queue an update."
        meta={
          <span className="caption-4 text-ink-500">
            {isLive
              ? `${data.pagination.total.toLocaleString('en-IN')} students in the register`
              : '12 sample records · connect the API for the full register'}
          </span>
        }
      >
        <Link to="/admin" className={buttonStyles('secondary', 'sm')}>
          Back to overview
        </Link>
      </PageHeader>

      <DataNotice loading={loading} error={error} />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <label htmlFor="student-search" className="sr-only">
            Search by name or USN
          </label>
          <input
            id="student-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search by name or USN"
            className="h-10 w-full rounded-lg border border-paper-300 bg-paper-0 pl-8 pr-3 body-5 transition-colors duration-300 hover:border-ink-400 focus:border-ink-900"
          />
        </div>

        <div>
          <label htmlFor="status-filter" className="sr-only">
            Filter by card status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as CardStatus | 'all')
              setPage(1)
            }}
            className="field w-full sm:w-40"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="No students match this search"
            description={
              query.trim()
                ? `Nothing matches “${query.trim()}”. Try a USN or clear the filters.`
                : 'No cards match this status. Clear the filter to see the full register.'
            }
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Students, card status and last sync time.
              </caption>
              <thead>
                <tr className="border-b border-paper-200">
                  <th className="py-3 pr-4 caption-3 text-ink-500" scope="col">
                    Student
                  </th>
                  <th className="hidden px-4 py-3 caption-3 text-ink-500 md:table-cell" scope="col">
                    Class
                  </th>
                  <th className="hidden px-4 py-3 caption-3 text-ink-500 md:table-cell" scope="col">
                    Card
                  </th>
                  <th className="px-4 py-3 caption-3 text-ink-500" scope="col">
                    Status
                  </th>
                  <th className="hidden px-4 py-3 caption-3 text-ink-500 md:table-cell" scope="col">
                    Battery
                  </th>
                  <th className="hidden px-4 py-3 caption-3 text-ink-500 md:table-cell" scope="col">
                    Last sync
                  </th>
                  <th className="py-3 pl-4 text-right caption-3 text-ink-500" scope="col">
                    Record
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => (
                  <tr
                    key={student.usn}
                    onClick={() => {
                      setSelectedUsn(student.usn)
                      setQueuedFor(null)
                      setQueueMessage(null)
                    }}
                    className="cursor-pointer border-b border-paper-200 transition-colors duration-300 hover:bg-paper-100/70"
                  >
                    <th scope="row" className="py-3 pr-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-paper-50 caption-5">
                          {student.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="body-5">{student.name}</p>
                          <p className="mt-0.5 font-mono caption-5 text-ink-500">
                            {student.usn}
                          </p>
                          <p className="mt-0.5 font-mono caption-5 text-ink-500 md:hidden">
                            {student.card.id}
                          </p>
                        </div>
                      </div>
                    </th>
                    <td className="hidden px-4 py-3 body-6 text-ink-700 md:table-cell">
                      {student.level === 'school'
                        ? `Primary school, ${student.classLabel ?? student.section}`
                        : `CSE, ${student.semester.replace('Semester ', 'Sem ')}, ${student.section.replace('Section ', 'Sec ')}`}
                    </td>
                    <td className="hidden px-4 py-3 font-mono caption-4 text-ink-700 md:table-cell">
                      {student.card.id}
                    </td>
                    <td className="px-4 py-3">
                      <CardStatusPill status={student.card.status} />
                    </td>
                    <td
                      className={cn(
                        'hidden px-4 py-3 font-mono caption-4 md:table-cell',
                        student.card.battery < 20
                          ? 'text-critical'
                          : student.card.battery < 40
                            ? 'text-attention'
                            : 'text-ink-700',
                      )}
                    >
                      {student.card.battery}%
                    </td>
                    <td className="hidden px-4 py-3 caption-5 text-ink-500 md:table-cell">
                      {student.card.lastSync}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedUsn(student.usn)
                          setQueuedFor(null)
                          setQueueMessage(null)
                        }}
                        className="caption-1 text-link"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="caption-5 text-ink-500">
          {isLive
            ? `Showing ${rows.length} of ${data.pagination.total.toLocaleString('en-IN')} students · page ${data.pagination.page} of ${data.pagination.pages}`
            : `Showing ${rows.length} of ${rows.length} sample records. Connect the API to search the full register.`}
        </p>
        {isLive && data.pagination.pages > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={data.pagination.page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={data.pagination.page >= data.pagination.pages}
              onClick={() => setPage((value) => Math.min(data.pagination.pages, value + 1))}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>

      <Drawer
        open={selectedUsn !== null}
        onClose={() => setSelectedUsn(null)}
        title={record?.name ?? selectedRow?.name ?? 'Student record'}
      >
        {record ? (
          <div className="space-y-6">
            <EInkCard student={record} size="compact" />

            <div className="flex flex-wrap items-center gap-2">
              <CardStatusPill status={record.card.status} />
              <p className="font-mono caption-4 text-ink-500">{record.card.id}</p>
            </div>

            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="caption-5 text-ink-500">Battery</dt>
                <dd className="mt-1 font-mono caption-3">{record.card.battery}%</dd>
              </div>
              <div>
                <dt className="caption-5 text-ink-500">Last sync</dt>
                <dd className="mt-1 caption-3">{record.card.lastSync}</dd>
              </div>
              <div>
                <dt className="caption-5 text-ink-500">Valid until</dt>
                <dd className="mt-1 caption-3">{record.card.validTo}</dd>
              </div>
              <div>
                <dt className="caption-5 text-ink-500">Firmware</dt>
                <dd className="mt-1 font-mono caption-3">{record.card.firmware}</dd>
              </div>
            </dl>

            <div className="rule pt-4">
              <dl className="space-y-3">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="caption-2 text-ink-500">Programme</dt>
                  <dd className="text-right body-5">{record.programme}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="caption-2 text-ink-500">Mentor</dt>
                  <dd className="body-5">{record.mentor}</dd>
                </div>
                {record.level === 'college' ? (
                  <>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="caption-2 text-ink-500">Attendance</dt>
                      <dd className="font-mono body-5">{record.attendance.toFixed(1)}%</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="caption-2 text-ink-500">Academic status</dt>
                      <dd>
                        <RiskPill risk={record.risk} />
                      </dd>
                    </div>
                  </>
                ) : (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="caption-2 text-ink-500">Register</dt>
                    <dd className="body-5">
                      Primary school, {record.classLabel ?? record.section}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {record.level === 'college' ? (
              <div className="rounded-xl bg-paper-100 p-3">
                <p className="caption-5 text-ink-500">Why the model flags this student</p>
                <p className="mt-1 body-6 text-pretty">{record.driver}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-paper-100 p-3">
                <p className="caption-5 text-ink-500">Academic risk</p>
                <p className="mt-1 body-6 text-pretty">
                  The risk model scores university students only. A primary school record carries no
                  risk score.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                disabled={record.card.status === 'revoked' || record.card.status === 'unprovisioned'}
                onClick={() => void queueUpdate()}
              >
                Queue update
              </Button>
              <Link
                to={`/admin/verifications?q=${record.usn}`}
                className={buttonStyles('secondary', 'sm')}
              >
                View checks
              </Link>
            </div>

            {queuedFor === record.usn && queueMessage ? (
              <p className="caption-5 text-verified" role="status" aria-live="polite">
                {queueMessage}
              </p>
            ) : null}

            {record.card.status === 'revoked' ? (
              <p className="caption-5 text-critical">
                This card is revoked. Provision a replacement before sending updates.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="caption-2 text-ink-500" role="status">
            {recordLoading ? 'Loading the student record…' : 'No record found for this student.'}
          </p>
        )}
      </Drawer>
    </div>
  )
}
