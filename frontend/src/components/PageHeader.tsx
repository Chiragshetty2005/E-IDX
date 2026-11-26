import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  meta,
  children,
}: {
  title: string
  description: string
  meta?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-[680px]">
        <h1 className="heading-4 text-balance">{title}</h1>
        <p className="mt-2 body-3 text-ink-500 text-pretty">{description}</p>
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-3">{meta}</div> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div> : null}
    </header>
  )
}

export function SectionHead({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="heading-6 text-balance">{title}</h2>
        {description ? (
          <p className="mt-1 caption-2 text-ink-500 text-pretty">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
