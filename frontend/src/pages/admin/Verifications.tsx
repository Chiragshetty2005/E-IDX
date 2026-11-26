import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { Pill, MethodPill, ResultPill } from '../../components/Status'
import { VolumeBars } from '../../components/Charts'
import { EmptyState } from '../../components/EmptyState'
import { Button, buttonStyles } from '../../components/Button'
import { DataNotice } from '../../components/DataNotice'
import { useVerificationLog, useVerificationSummary } from '../../data/hooks'
import { useSession } from '../../session'
import { cn } from '../../lib/ui'
import type { VerificationMethod } from '../../types'

type Filter = 'all' | VerificationMethod | 'rejected'

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All checks' },
  { value: 'qr', label: 'QR scan' },
  { value: 'nfc', label: 'NFC tap' },
  { value: 'rejected', label: 'Rejected' },
]

export function AdminVerifications() {
  const { isLive } = useSession()
  const [params, setParams] = useSearchParams()
  const statusFilter = (params.get('result') as Filter | null) ?? 'all'
  const usnFilter = params.get('q')
  const [filter, setFilter] = useState<Filter>(statusFilter)
  const [page, setPage] = useState(1)

  const activeFilter = usnFilter ? 'all' : filter

  const { data: summary, loading: summaryLoading, error: summaryError } = useVerificationSummary()
  const { data, loading, error } = useVerificationLog({
    method: activeFilter === 'qr' || activeFilter === 'nfc' ? activeFilter : undefined,
    result: activeFilter === 'rejected' ? 'rejected' : undefined,
    q: usnFilter ?? undefined,
    page,
  })

  const focusStudent = usnFilter
    ? { usn: usnFilter, name: data.items[0]?.name ?? usnFilter }
    : null

  const setActiveFilter = (next: Filter) => {
    setFilter(next)
    setPage(1)
    if (usnFilter) {
      setParams({})
    }
  }

  const clearStudent = () => {
    params.delete('q')
    setParams(params)
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        title="Verification log"
        description="Every QR scan and NFC tap is decided by the backend, not by the card."
        meta={
          <>
            <span className="caption-4 text-ink-500">Today</span>
            <span className="caption-4 text-ink-500">
              {summary.total.toLocaleString('en-IN')} checks
            </span>
          </>
        }
      >
        <Link to="/verify" className={buttonStyles('secondary', 'sm')}>
          Open verification console
        </Link>
      </PageHeader>

      <DataNotice loading={loading || summaryLoading} error={error ?? summaryError} />

      <section className="mt-8 border-y border-paper-200 py-4" aria-label="Verification figures">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:divide-x sm:divide-paper-200">
          <div className="sm:pr-6">
            <dt className="caption-5 text-ink-500">Accepted</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">
              {summary.acceptanceRate.toFixed(1)}%
            </dd>
            <p className="mt-1 caption-5 text-ink-500">
              {summary.accepted.toLocaleString('en-IN')} checks
            </p>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Rejected</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{summary.rejected}</dd>
            <p className="mt-1 caption-5 text-ink-500">Revoked or expired</p>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Median latency</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">
              {summary.medianSeconds === null ? '—' : `${summary.medianSeconds.toFixed(2)} s`}
            </dd>
            <p className="mt-1 caption-5 text-ink-500">Target is 1.00 s</p>
          </div>
          <div className="sm:pl-6">
            <dt className="caption-5 text-ink-500">Readers online</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">
              {summary.readersOnline} of {summary.readers.length}
            </dd>
            <p className="mt-1 caption-5 text-ink-500">Across gates, labs and the library</p>
          </div>
        </dl>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <SectionHead
            title="Checks by hour"
            description="Daytime volume across gates, labs and the library."
          />
          <div className="mt-4 rounded-2xl bg-paper-100 p-4 sm:p-6">
            <VolumeBars data={summary.hourly} />
          </div>
        </section>

        <section className="lg:col-span-5">
          <SectionHead title="Reader health" description="Median time for today's checks." />
          <ul className="mt-2">
            {summary.readers.map((reader) => (
              <li
                key={reader.id}
                className="flex items-center justify-between gap-3 border-b border-paper-200 py-3 last:border-b-0"
              >
                <div>
                  <p className="font-mono caption-3">{reader.id}</p>
                  <p className="mt-0.5 caption-5 text-ink-500">
                    {reader.place}, {reader.median.toFixed(2)} s median
                  </p>
                </div>
                <Pill
                  label={reader.state}
                  tone={reader.state === 'Online' ? 'verified' : 'attention'}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead title="Recent checks" description="Newest decisions first." />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter checks">
            {filters.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveFilter(option.value)}
                aria-pressed={activeFilter === option.value}
                className={cn(
                  'rounded-full px-3 py-1 caption-3 transition-colors duration-300 ease-base',
                  activeFilter === option.value
                    ? 'bg-ink-900 text-paper-50'
                    : 'bg-paper-100 text-ink-700 hover:bg-paper-200',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {focusStudent ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper-100 px-3 py-2">
            <p className="caption-2">
              Showing checks for {focusStudent.name}, {focusStudent.usn}
            </p>
            <Button variant="ghost" size="sm" onClick={clearStudent}>
              Clear student
            </Button>
          </div>
        ) : null}

        <div className="mt-4">
          {data.items.length === 0 ? (
            <EmptyState
              title="No checks match this filter"
              description="Try another method, or clear the filters to see every check from today."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilter('all')
                    setParams({})
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Recent verification checks with method, location, reader, result and latency.
                </caption>
                <thead>
                  <tr className="border-b border-paper-200">
                    <th className="py-3 pr-4 caption-3 text-ink-500" scope="col">
                      Time
                    </th>
                    <th className="px-4 py-3 caption-3 text-ink-500" scope="col">
                      Student
                    </th>
                    <th className="hidden px-4 py-3 caption-3 text-ink-500 md:table-cell" scope="col">
                      Method
                    </th>
                    <th className="hidden px-4 py-3 caption-3 text-ink-500 sm:table-cell" scope="col">
                      Location
                    </th>
                    <th className="hidden px-4 py-3 caption-3 text-ink-500 md:table-cell" scope="col">
                      Reader
                    </th>
                    <th className="px-4 py-3 caption-3 text-ink-500" scope="col">
                      Result
                    </th>
                    <th className="hidden py-3 pl-4 text-right caption-3 text-ink-500 md:table-cell" scope="col">
                      Latency
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-paper-200 transition-colors duration-300 hover:bg-paper-100/70"
                    >
                      <td className="py-3 pr-4 font-mono caption-4">{item.time}</td>
                      <td className="px-4 py-3">
                        <p className="body-5">{item.name}</p>
                        <p className="mt-0.5 font-mono caption-5 text-ink-500">{item.usn}</p>
                        <p className="mt-0.5 caption-5 text-ink-500 md:hidden">
                          {item.method === 'qr' ? 'QR' : 'NFC'}
                          <span className="sm:hidden">, {item.location}</span>,{' '}
                          {item.latency.toFixed(2)} s
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <MethodPill method={item.method} />
                      </td>
                      <td className="hidden px-4 py-3 body-6 text-ink-700 sm:table-cell">
                        {item.location}
                      </td>
                      <td className="hidden px-4 py-3 font-mono caption-4 text-ink-700 md:table-cell">
                        {item.reader}
                      </td>
                      <td className="px-4 py-3">
                        <ResultPill result={item.result} />
                      </td>
                      <td
                        className={cn(
                          'hidden py-3 pl-4 text-right font-mono caption-4 md:table-cell',
                          item.latency > 1 ? 'text-attention' : 'text-ink-700',
                        )}
                      >
                        {item.latency.toFixed(2)} s
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
              ? `Showing ${data.items.length} of ${data.total.toLocaleString('en-IN')} checks · page ${data.page} of ${data.pages}`
              : `Showing ${data.items.length} of ${data.total} sample checks. The full log holds 6,284 checks from today.`}
          </p>
          {isLive && data.pages > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={data.page >= data.pages}
                onClick={() => setPage((value) => Math.min(data.pages, value + 1))}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
