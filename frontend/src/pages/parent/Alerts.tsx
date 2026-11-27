import { Link } from 'react-router-dom'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { NotificationPill } from '../../components/Status'
import { EmptyState } from '../../components/EmptyState'
import { DataNotice } from '../../components/DataNotice'
import { useParentAlerts } from '../../data/hooks'

export function ParentAlerts() {
  const { data, loading, error } = useParentAlerts()
  const { alerts, summary } = data

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Every push notification and SMS raised for your linked children."
        meta={
          <span className="caption-4 text-ink-500">
            {summary.total} message{summary.total === 1 ? '' : 's'} on record
          </span>
        }
      />

      <DataNotice loading={loading} error={error} />

      <section className="mt-8 border-y border-paper-200 py-4" aria-label="Alert figures">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:divide-x sm:divide-paper-200">
          <div className="sm:pr-6">
            <dt className="caption-5 text-ink-500">Delivered</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{summary.sent}</dd>
            <p className="mt-1 caption-5 text-ink-500">Push and SMS messages</p>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Queued</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{summary.queued}</dd>
            <p className="mt-1 caption-5 text-ink-500">Waiting on the gateway</p>
          </div>
          <div className="sm:px-6">
            <dt className="caption-5 text-ink-500">Failed</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">{summary.failed}</dd>
            <p className="mt-1 caption-5 text-ink-500">Retried by the notification service</p>
          </div>
          <div className="sm:pl-6">
            <dt className="caption-5 text-ink-500">Children</dt>
            <dd className="mt-1 font-mono heading-4 tabular-nums">
              {new Set(alerts.map((alert) => alert.student.usn)).size}
            </dd>
            <p className="mt-1 caption-5 text-ink-500">Linked to this account</p>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <SectionHead
          title="Message log"
          description="Newest first. Only your linked children appear here."
        />

        {alerts.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No alerts yet"
              description="Alerts appear as soon as a reader logs a card at a checkpoint."
              action={
                <Link to="/parent" className="caption-1 text-link">
                  Back to children
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 border-t border-paper-200">
            {alerts.map((alert) => (
              <li key={alert.id} className="border-b border-paper-200 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="body-5">{alert.message}</p>
                    <p className="mt-1 caption-5 text-ink-500">
                      {alert.student.name} · {alert.title} ·{' '}
                      {alert.channel === 'push' ? 'App push' : 'SMS'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono caption-5 text-ink-500">{alert.time}</span>
                    <NotificationPill status={alert.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
