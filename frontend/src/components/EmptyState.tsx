import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-paper-200 bg-paper-0 px-4 py-10 text-center sm:px-6">
      <p className="body-2">{title}</p>
      <p className="mx-auto mt-1 max-w-[420px] body-6 text-ink-500 text-pretty">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
