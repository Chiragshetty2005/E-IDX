import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  IdentificationCard,
  ShieldCheck,
  SquaresFour,
  UsersThree,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react'
import { Button } from '../components/Button'
import { useSession, roleHome } from '../session'
import { demoStudentUsn, users } from '../data/mock'
import type { Role } from '../types'
import { cn } from '../lib/ui'

interface RoleOption {
  value: Role
  index: string
  label: string
  summary: string
  icon: Icon
}

const roleOptions: RoleOption[] = [
  {
    value: 'admin',
    index: '01',
    label: 'Card services',
    summary: 'Campus overview, register, cards and the verification log.',
    icon: SquaresFour,
  },
  {
    value: 'faculty',
    index: '02',
    label: 'Faculty, CSE',
    summary: 'Cohort, mentor notes, records and attendance sessions.',
    icon: UsersThree,
  },
  {
    value: 'student',
    index: '03',
    label: 'Card holder',
    summary: 'Your card, campus pass, attendance and student services.',
    icon: IdentificationCard,
  },
]

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
        <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" />
        <rect x="14" y="2" width="6" height="6" rx="1" fill="currentColor" />
        <rect x="2" y="14" width="6" height="6" rx="1" fill="currentColor" />
        <rect
          x="12"
          y="14"
          width="8"
          height="8"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <span className="heading-6">E-IDX</span>
    </div>
  )
}

export function SignIn() {
  const {
    role: storedRole,
    status,
    authError,
    apiUnreachable,
    switching,
    signIn,
    enterPreview,
  } = useSession()
  const navigate = useNavigate()

  const [role, setRole] = useState<Role>(storedRole)
  const [usn, setUsn] = useState(demoStudentUsn)

  if (status === 'signed-in') {
    return <Navigate to={roleHome[storedRole]} replace />
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const signedIn = await signIn(role, role === 'student' ? usn.trim() : undefined)
    if (signedIn) navigate(roleHome[role], { replace: true })
  }

  const continueWithSampleData = () => {
    enterPreview()
    navigate(roleHome[role], { replace: true })
  }

  if (status === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-50 px-4">
        <p className="caption-2 text-ink-500">Checking your session…</p>
      </div>
    )
  }

  const account = users[role]

  return (
    <div className="flex min-h-dvh flex-col bg-paper-50">
      <header className="mx-auto w-full max-w-xl px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-paper-200 pb-3">
          <Wordmark />
          <p className="caption-5 text-ink-500">
            Dayananda Sagar University · School of Engineering
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-10 sm:px-8 sm:py-14">
        <div className="rounded-2xl border border-paper-200 bg-paper-0 p-5 sm:p-8">
          <div className="flex items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-mono caption-4 text-ink-500">ACCOUNT ACCESS</p>
            <p className="hidden font-mono caption-5 text-ink-400 min-[360px]:block">
              CAMPUS CARD PLATFORM
            </p>
          </div>

          <h1 className="mt-4 heading-4 text-balance">Sign in</h1>
          <p className="mt-2 body-5 text-ink-500 text-pretty">
            Pick the account to open. The API checks the role on every request.
          </p>

          <fieldset className="mt-6">
            <legend className="sr-only">Account type</legend>
            <div className="divide-y divide-paper-200 overflow-hidden rounded-xl border border-paper-200">
              {roleOptions.map((option) => {
                const selected = role === option.value
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 p-3 transition-colors duration-300',
                      'focus-within:ring-2 focus-within:ring-inset',
                      selected
                        ? 'bg-ink-900 focus-within:ring-paper-50'
                        : 'bg-paper-0 hover:bg-paper-100 focus-within:ring-ink-900',
                    )}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={selected}
                      onChange={() => setRole(option.value)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'font-mono caption-5 mt-0.5 w-5 shrink-0 tabular-nums',
                        selected ? 'text-paper-50/60' : 'text-ink-400',
                      )}
                      aria-hidden="true"
                    >
                      {option.index}
                    </span>
                    <option.icon
                      size={18}
                      weight={selected ? 'fill' : 'regular'}
                      className={cn('mt-0.5 shrink-0', selected ? 'text-paper-50' : 'text-ink-500')}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block body-4',
                          selected ? 'text-paper-50' : 'text-ink-900',
                        )}
                      >
                        {option.label}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 block caption-5 text-pretty',
                          selected ? 'text-paper-50/70' : 'text-ink-500',
                        )}
                      >
                        {option.summary}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                        selected ? 'bg-paper-50' : 'ring-1 ring-paper-300',
                      )}
                      aria-hidden="true"
                    >
                      {selected ? <Check size={12} weight="bold" className="text-ink-900" /> : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {role === 'student' ? (
            <div className="mt-6">
              <label htmlFor="signin-usn" className="caption-3 block text-ink-700">
                USN
              </label>
              <input
                id="signin-usn"
                type="text"
                className="field mt-2 font-mono"
                value={usn}
                onChange={(event) => setUsn(event.target.value)}
                placeholder="1DS23CS0048"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-2 caption-5 text-ink-500">
                Leave the field empty to use the first student account in the register.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-paper-100 p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 caption-4 text-paper-50">
                {account.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate body-4">{account.name}</p>
                <p className="truncate caption-5 text-ink-500">{account.detail}</p>
              </div>
            </div>
          )}

          {authError ? (
            <p className="mt-6 flex items-start gap-2 rounded-lg bg-critical-soft p-3 caption-2 text-critical" role="alert">
              <WarningCircle size={18} weight="bold" className="mt-0.5 shrink-0" />
              {authError}
            </p>
          ) : null}

          <form
            onSubmit={(event) => {
              void submit(event)
            }}
            className="mt-6"
          >
            <Button type="submit" className="w-full" disabled={switching}>
              {switching ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={16} weight="bold" />
            </Button>
          </form>

          <div className="mt-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-paper-200" aria-hidden="true" />
            <span className="caption-5 text-ink-400">or</span>
            <span className="h-px flex-1 bg-paper-200" aria-hidden="true" />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            onClick={continueWithSampleData}
            disabled={switching}
          >
            Continue with sample data
          </Button>

          <p className="mt-4 caption-5 text-ink-500 text-pretty">
            {apiUnreachable
              ? 'The campus API is not reachable, so the app can only show the sample register.'
              : 'The sample register runs on mock data with no server session. The preview sign-in is replaced by campus SSO before deployment.'}
          </p>
        </div>

        <p className="mt-6 flex items-start gap-2 px-1 caption-5 text-ink-500 text-pretty">
          <ShieldCheck size={16} weight="bold" className="mt-0.5 shrink-0 text-ink-700" />
          Academic risk is a staff signal. It never reaches a card, a campus pass or a card update.
        </p>
      </main>
    </div>
  )
}
