import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { PresencePill, NotificationPill } from '../../components/Status'
import { EmptyState } from '../../components/EmptyState'
import { DataNotice } from '../../components/DataNotice'
import { useParentChild } from '../../data/hooks'
import { cardStatusLabel, methodLabel } from '../../lib/ui'

function eventSentence(
  checkpoint: { name: string; zone: string },
  direction: 'in' | 'out',
): string {
  if (checkpoint.zone === 'bus') {
    return direction === 'in' ? 'Boarded the bus' : 'Got off the bus'
  }
  if (checkpoint.zone === 'gate') {
    return direction === 'in' ? 'Reached the school gate' : 'Left campus'
  }
  if (checkpoint.zone === 'classroom') {
    return direction === 'in' ? 'Entered the classroom' : 'Left the classroom'
  }
  if (checkpoint.zone === 'library') {
    return direction === 'in' ? 'Checked in at the library' : 'Checked out of the library'
  }
  return direction === 'in' ? 'Checked in at the canteen' : 'Checked out of the canteen'
}

export function ParentChildDetail() {
  const { usn } = useParams()
  const { data, loading, error } = useParentChild(usn ?? null)

  if (!data) {
    return (
      <div>
        <PageHeader
          title="Child record"
          description="The linked child could not be loaded."
        />
        <DataNotice loading={loading} error={error} />
        <div className="mt-8">
          <EmptyState
            title="No linked child"
            description="This account is not linked to that child, or the record no longer exists."
            action={
              <Link to="/parent" className="caption-1 text-link">
                Back to children
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  const { child, events, alerts } = data

  return (
    <div>
      <Link to="/parent" className="inline-flex items-center gap-2 caption-3 text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} weight="bold" />
        All children
      </Link>

      <div className="mt-4">
        <PageHeader
          title={child.name}
          description={`${child.classLabel ?? 'Primary school'} · ${child.relationship} · card ${child.card?.id ?? 'not issued'}`}
          meta={
            <>
              <PresencePill state={child.state} />
              <span className="font-mono caption-4 text-ink-500">{child.usn}</span>
            </>
          }
        />
      </div>

      <DataNotice loading={loading} error={error} />

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-7">
          <SectionHead
            title="Today's timeline"
            description="Every checkpoint read recorded for this child today."
          />

          {events.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No reads today"
                description="Nothing has been recorded at a checkpoint yet. The first read usually happens at the bus."
              />
            </div>
          ) : (
            <ol className="mt-4 border-l border-paper-200 pl-5">
              {events.map((event) => (
                <li key={event.id} className="relative pb-5 last:pb-0">
                  <span
                    className="absolute -left-[26px] top-1.5 size-2.5 rounded-full bg-ink-900 ring-4 ring-paper-50"
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="body-5">{eventSentence(event.checkpoint, event.direction)}</p>
                    <p className="font-mono caption-5 text-ink-500">{event.time}</p>
                  </div>
                  <p className="mt-0.5 caption-5 text-ink-500">
                    {event.checkpoint.name} · {methodLabel[event.method] ?? event.method}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="min-w-0 space-y-8 lg:col-span-5">
          <section className="rounded-2xl border border-paper-200 bg-paper-0 p-5">
            <SectionHead title="Card" description="The physical card in use today." />
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-5 text-ink-500">Card</dt>
                <dd className="font-mono body-5">{child.card?.id ?? '—'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-5 text-ink-500">Status</dt>
                <dd className="body-5">
                  {child.card ? cardStatusLabel[child.card.status] : 'Not issued'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-5 text-ink-500">Battery</dt>
                <dd className="font-mono body-5">{child.card ? `${child.card.battery}%` : '—'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-5 text-ink-500">Last sync</dt>
                <dd className="body-5">{child.card?.lastSync ?? '—'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-5 text-ink-500">Valid until</dt>
                <dd className="body-5">{child.card?.validTo ?? '—'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-5 text-ink-500">NFC UID</dt>
                <dd className="font-mono caption-5 text-ink-700">{child.card?.nfcUid ?? '—'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="caption-5 text-ink-500">UHF tag</dt>
                <dd className="font-mono caption-5 text-ink-700">{child.card?.uhfTagId ?? '—'}</dd>
              </div>
            </dl>
          </section>

          <section>
            <SectionHead
              title="Recent alerts"
              description="Push and SMS messages raised for this child."
              action={
                <Link to="/parent/alerts" className="caption-1 text-link">
                  All alerts
                </Link>
              }
            />
            <ul className="mt-2">
              {alerts.slice(0, 6).map((alert) => (
                <li key={alert.id} className="border-b border-paper-200 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="body-6 text-pretty">{alert.message}</p>
                    <NotificationPill status={alert.status} className="shrink-0" />
                  </div>
                  <p className="mt-1 caption-5 text-ink-500">
                    {alert.channel === 'push' ? 'App push' : 'SMS'} · {alert.time}
                  </p>
                </li>
              ))}
              {alerts.length === 0 ? (
                <li className="py-3 caption-2 text-ink-500">No alerts for this child yet.</li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
