import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarCheck,
  ChartLineUp,
  IdentificationCard,
  List,
  Scan,
  ShieldCheck,
  SquaresFour,
  UsersThree,
  X,
  type Icon,
} from '@phosphor-icons/react'
import { useSession, roleHome } from '../session'
import type { Role } from '../types'
import { cn } from '../lib/ui'

interface NavItem {
  to: string
  label: string
  icon: Icon
  end?: boolean
}

const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { to: '/admin', label: 'Overview', icon: SquaresFour, end: true },
    { to: '/admin/students', label: 'Students and cards', icon: IdentificationCard },
    { to: '/admin/verifications', label: 'Verification log', icon: ShieldCheck },
    { to: '/admin/insights', label: 'Academic intelligence', icon: ChartLineUp },
    { to: '/verify', label: 'Verification console', icon: Scan },
  ],
  faculty: [
    { to: '/faculty', label: 'Cohort', icon: UsersThree, end: true },
    { to: '/faculty/sessions', label: 'Attendance sessions', icon: CalendarCheck },
    { to: '/verify', label: 'Verification console', icon: Scan },
  ],
  student: [
    { to: '/student', label: 'My card', icon: IdentificationCard, end: true },
    { to: '/student/services', label: 'Campus services', icon: BookOpen },
  ],
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
        <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" />
        <rect x="14" y="2" width="6" height="6" rx="1" fill="currentColor" />
        <rect x="2" y="14" width="6" height="6" rx="1" fill="currentColor" />
        <rect
          x="12"
          y="12"
          width="8"
          height="8"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <span className="heading-6">E-IDX</span>
      {compact ? null : <span className="sr-only">campus card platform</span>}
    </div>
  )
}

function RoleSwitcher({ id, onSwitch }: { id: string; onSwitch?: () => void }) {
  const { role, setRole } = useSession()
  const navigate = useNavigate()

  return (
    <div>
      <label htmlFor={id} className="mb-1 block caption-5 text-ink-500">
        Viewing as
      </label>
      <select
        id={id}
        className="field"
        value={role}
        onChange={(event) => {
          const next = event.target.value as Role
          setRole(next)
          navigate(roleHome[next])
          onSwitch?.()
        }}
      >
        <option value="admin">Admin, card services</option>
        <option value="faculty">Faculty, CSE</option>
        <option value="student">Student, card holder</option>
      </select>
    </div>
  )
}

function UserPanel({ idPrefix }: { idPrefix: string }) {
  const { user } = useSession()
  return (
    <div className="rounded-2xl bg-paper-0 p-2">
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-paper-50 caption-4">
          {user.initials}
        </div>
        <div className="min-w-0">
          <p className="truncate caption-1">{user.name}</p>
          <p className="truncate caption-5 text-ink-500">{user.detail}</p>
        </div>
      </div>
      <div className="mt-3">
        <RoleSwitcher id={`${idPrefix}-role`} />
      </div>
    </div>
  )
}

function PreviewBadge() {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-paper-0 px-2 py-1 caption-5 text-ink-500">
      <span className="size-2 rounded-full bg-attention" aria-hidden="true" />
      Preview data
    </p>
  )
}

function Sidebar() {
  const { role } = useSession()
  return (
    <aside className="hidden bg-paper-100 px-4 py-6 lg:sticky lg:top-0 lg:col-start-1 lg:flex lg:h-dvh lg:flex-col">
      <div className="px-2">
        <Wordmark />
        <p className="mt-2 caption-5 text-ink-500">
          Dayananda Sagar University
          <br />
          School of Engineering
        </p>
      </div>

      <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Main">
        {navByRole[role].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 body-5 transition-colors duration-300 ease-base',
                isActive
                  ? 'bg-ink-900 text-paper-50'
                  : 'text-ink-700 hover:bg-paper-200 hover:text-ink-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} weight={isActive ? 'fill' : 'regular'} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3">
        <PreviewBadge />
        <UserPanel idPrefix="desktop" />
      </div>
    </aside>
  )
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, user } = useSession()
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
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-opacity duration-300 ease-base lg:hidden',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="absolute inset-0 bg-paper-50/95 backdrop-blur-xl" aria-hidden="true" />
      <div
        className="relative flex h-dvh flex-col p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
      >
        <div className="flex items-center justify-between">
          <Wordmark compact />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-lg text-ink-700 transition-colors duration-300 hover:bg-paper-100 focus-ring"
            aria-label="Close menu"
          >
            <X size={22} weight="bold" />
          </button>
        </div>

        <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Main">
          {navByRole[role].map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              style={{ transitionDelay: open ? `${index * 60}ms` : '0ms' }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 title-2 transition-all duration-300 ease-base',
                  isActive
                    ? 'bg-ink-900 text-paper-50'
                    : 'text-ink-700 hover:bg-paper-100',
                  open ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
                )
              }
            >
              <item.icon size={20} weight="regular" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3">
          <PreviewBadge />
          <div className="rounded-2xl bg-paper-0 p-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-paper-50 caption-4">
                {user.initials}
              </div>
              <div className="min-w-0">
                <p className="truncate caption-1">{user.name}</p>
                <p className="truncate caption-5 text-ink-500">{user.detail}</p>
              </div>
            </div>
            <div className="mt-3">
              <RoleSwitcher id="mobile-role" onSwitch={onClose} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closeMenu = () => {
    setMenuOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="min-h-dvh bg-paper-50 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only button-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-ink-900 focus:px-3 focus:py-2 focus:text-paper-50"
      >
        Skip to content
      </a>

      <Sidebar />

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-paper-50/90 px-4 backdrop-blur lg:hidden">
          <Wordmark compact />
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex size-10 items-center justify-center rounded-lg text-ink-700 transition-colors duration-300 hover:bg-paper-100 focus-ring"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <List size={24} weight="bold" />
          </button>
        </header>

        <div id="mobile-menu">
          <MobileMenu open={menuOpen} onClose={closeMenu} />
        </div>

        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-10">
          <p className="rule pt-4 caption-5 text-ink-500">
            E-IDX frontend preview. This screen uses sample data and is not connected to a card or
            server.
          </p>
        </footer>
      </div>
    </div>
  )
}
