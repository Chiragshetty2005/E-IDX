import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  IdentificationCard,
  ShieldCheck,
  SquaresFour,
  UsersThree,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react'
import { Button } from '../components/Button'
import { useSession, roleHome } from '../session'
import { demoStudentUsn } from '../data/mock'
import type { Role } from '../types'
import { cn } from '../lib/ui'

interface RoleOption {
  value: Role
  label: string
  summary: string
  icon: Icon
}

const roleOptions: RoleOption[] = [
  {
    value: 'admin',
    label: 'Card services',
    summary: 'Campus overview, student register, verification log and card operations.',
    icon: SquaresFour,
  },
  {
    value: 'faculty',
    label: 'Faculty, CSE',
    summary: 'Your cohort, mentor notes, student records and attendance sessions.',
    icon: UsersThree,
  },
  {
    value: 'student',
    label: 'Card holder',
    summary: 'Your e-ink card, campus pass, attendance and student services.',
    icon: IdentificationCard,
  },
]

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden="true">
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
      <span className="heading-5">E-IDX</span>
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

  return (
    <div className="min-h-dvh bg-paper-50 px-4 py-10 sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-12 lg:gap-12">
        <section className="lg:col-span-5">
          <Wordmark />
          <p className="mt-2 caption-5 text-ink-500">
            Dayananda Sagar University
            <br />
            School of Engineering
          </p>

          <h1 className="mt-10 heading-3 text-balance">Sign in to the campus card platform</h1>
          <p className="mt-3 body-3 text-ink-500 text-pretty">
            One account for the e-ink card, the campus pass, attendance and academic support. The
            API decides what each role can read.
          </p>

          <ul className="mt-8 space-y-3">
            <li className="flex items-start gap-3">
              <ShieldCheck size={20} weight="bold" className="mt-0.5 shrink-0 text-ink-700" />
              <p className="caption-2 text-ink-500 text-pretty">
                Every decision is made on the server. The browser holds no access rules of its own.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <IdentificationCard size={20} weight="bold" className="mt-0.5 shrink-0 text-ink-700" />
              <p className="caption-2 text-ink-500 text-pretty">
                Academic risk is a staff signal. It never reaches a card, a campus pass or a card
                update.
              </p>
            </li>
          </ul>
        </section>

        <section className="lg:col-span-7">
          <form
            onSubmit={(event) => {
              void submit(event)
            }}
            className="rounded-2xl border border-paper-200 bg-paper-0 p-5 sm:p-8"
          >
            <fieldset>
              <legend className="field-label">Sign in as</legend>
              <div className="mt-1 grid gap-2">
                {roleOptions.map((option) => {
                  const selected = role === option.value
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-300',
                        selected
                          ? 'border-ink-900 bg-paper-100'
                          : 'border-paper-200 hover:border-ink-400 hover:bg-paper-100/60',
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
                          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                          selected ? 'bg-ink-900 text-paper-50' : 'bg-paper-100 text-ink-700',
                        )}
                        aria-hidden="true"
                      >
                        <option.icon size={18} weight="bold" />
                      </span>
                      <span className="min-w-0">
                        <span className="block body-1">{option.label}</span>
                        <span className="mt-0.5 block caption-5 text-ink-500 text-pretty">
                          {option.summary}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {role === 'student' ? (
              <div className="mt-6">
                <label htmlFor="signin-usn" className="field-label">
                  USN
                </label>
                <input
                  id="signin-usn"
                  type="text"
                  className="field font-mono"
                  value={usn}
                  onChange={(event) => setUsn(event.target.value)}
                  placeholder="1DS23CS0048"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-1 caption-5 text-ink-500">
                  Leave the field empty to use the first student account in the register.
                </p>
              </div>
            ) : null}

            {authError ? (
              <p
                className="mt-6 flex items-start gap-2 rounded-xl bg-critical-soft p-3 caption-2 text-critical"
                role="alert"
              >
                <WarningCircle size={18} weight="bold" className="mt-0.5 shrink-0" />
                {authError}
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={switching}>
                {switching ? 'Signing in…' : 'Sign in'}
                <ArrowRight size={16} weight="bold" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={continueWithSampleData}
                disabled={switching}
              >
                Continue with sample data
              </Button>
            </div>

            <p className="mt-6 caption-5 text-ink-500 text-pretty">
              {apiUnreachable
                ? 'The campus API is not reachable, so the app can only show the sample register.'
                : 'This is the preview sign-in used by the demo. Campus SSO replaces it before deployment, and the API can turn it off with PREVIEW_AUTH=false.'}
            </p>
          </form>
        </section>
      </div>
    </div>
  )
}
