import { Link } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { PresencePill } from '../../components/Status'
import { EmptyState } from '../../components/EmptyState'
import { DataNotice } from '../../components/DataNotice'
import { useParentChildren } from '../../data/hooks'
import { useSession } from '../../session'

export function ParentChildren() {
  const { user } = useSession()
  const { data, loading, error } = useParentChildren()
  const { children } = data

  return (
    <div>
      <PageHeader
        title="Children"
        description="Every checkpoint read for the children linked to your account, in one place."
        meta={
          <>
            <span className="caption-4 text-ink-500">{user.name}</span>
            <span className="caption-4 text-ink-500">
              {children.length} linked {children.length === 1 ? 'child' : 'children'}
            </span>
          </>
        }
      />

      <DataNotice loading={loading} error={error} />

      {children.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No children are linked to this account yet"
            description="A parent account only shows the children a member of staff has linked to it. Ask the card office to add the link."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {children.map((child) => (
            <article
              key={child.usn}
              className="rounded-2xl border border-paper-200 bg-paper-0 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-900 caption-4 text-paper-50">
                    {child.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate body-1">{child.name}</p>
                    <p className="mt-0.5 font-mono caption-5 text-ink-500">
                      {child.classLabel ?? child.section}
                    </p>
                  </div>
                </div>
                <PresencePill state={child.state} />
              </div>

              <dl className="mt-5 space-y-3 border-t border-paper-200 pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="caption-5 text-ink-500">Last checkpoint</dt>
                  <dd className="text-right body-6">
                    {child.checkpoint ? child.checkpoint.name : 'No read yet today'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="caption-5 text-ink-500">Seen at</dt>
                  <dd className="font-mono body-6">{child.time}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="caption-5 text-ink-500">Card</dt>
                  <dd className="text-right body-6">
                    {child.card ? `${child.card.id} · ${child.card.battery}%` : 'No card issued'}
                  </dd>
                </div>
              </dl>

              <Link
                to={`/parent/children/${child.usn}`}
                className="mt-5 inline-flex items-center gap-2 caption-1 text-link"
              >
                Open today&apos;s timeline
                <ArrowRight size={14} weight="bold" />
              </Link>
            </article>
          ))}
        </div>
      )}

      <section className="mt-10">
        <SectionHead
          title="What this portal shows"
          description="Checkpoint reads, not live tracking."
        />
        <p className="mt-2 max-w-[680px] body-6 text-ink-700 text-pretty">
          A reader logs a card at the bus door, the gate and the classroom. You get a push
          notification and an SMS for every read, and you can see the day&apos;s history for your
          linked children. There is no map and no GPS: the platform only knows a checkpoint the
          child passed.
        </p>
      </section>
    </div>
  )
}
