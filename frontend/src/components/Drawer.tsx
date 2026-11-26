import { useEffect, useRef, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { cn } from '../lib/ui'

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      closeRef.current?.focus()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!open) return
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!nodes || nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div
      className={cn('fixed inset-0 z-40', !open && 'pointer-events-none')}
      aria-hidden={!open}
      inert={!open}
    >
      <div
        className={cn(
          'absolute inset-0 bg-ink-900/40 transition-opacity duration-300 ease-base',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={cn(
          'absolute right-0 top-0 flex h-dvh w-full max-w-lg flex-col bg-paper-50 shadow-eink transition-transform duration-500 ease-base',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="caption-5 text-ink-500">Student record</p>
            <h2 id="drawer-title" className="mt-1 heading-6">
              {title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-700 transition-colors duration-300 hover:bg-paper-100 focus-ring"
            aria-label="Close record"
          >
            <X size={20} weight="bold" />
          </button>
        </header>
        <div className="rule" />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
      </aside>
    </div>
  )
}
