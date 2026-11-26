import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle,
  ContactlessPayment,
  QrCode,
  Scan,
  ShieldCheck,
  XCircle,
} from '@phosphor-icons/react'
import { QRCodeSVG } from 'qrcode.react'
import { PageHeader, SectionHead } from '../components/PageHeader'
import { Button, buttonStyles } from '../components/Button'
import { Pill } from '../components/Status'
import { studentByUsn } from '../data/mock'
import { useSession } from '../session'
import { cn } from '../lib/ui'

type Method = 'qr' | 'nfc'
type Outcome = 'accepted' | 'expired' | 'revoked' | 'cloned'

interface Scenario {
  key: string
  label: string
  method: Method
  usn: string
  outcome: Outcome
  latency: number
  detail: string
}

const scenarios: Scenario[] = [
  {
    key: 'valid-qr',
    label: 'Valid pass',
    method: 'qr',
    usn: '1DS23CS0048',
    outcome: 'accepted',
    latency: 0.71,
    detail: 'Identity confirmed. Attendance logged to CS602 Machine learning.',
  },
  {
    key: 'expired-qr',
    label: 'Expired pass',
    method: 'qr',
    usn: '1DS23CS0031',
    outcome: 'expired',
    latency: 0.69,
    detail: 'This pass expired 41 seconds ago. Ask the student to refresh the code.',
  },
  {
    key: 'revoked-qr',
    label: 'Revoked card',
    method: 'qr',
    usn: '1DS23CS0056',
    outcome: 'revoked',
    latency: 0.74,
    detail: 'Card EIDX 0056 was revoked on 14 November. Hand the card to the card office.',
  },
  {
    key: 'valid-nfc',
    label: 'Valid tap',
    method: 'nfc',
    usn: '1DS23CS0017',
    outcome: 'accepted',
    latency: 0.64,
    detail: 'Challenge answered. Attendance logged to CS602 Machine learning.',
  },
  {
    key: 'cloned-nfc',
    label: 'Cloned tag',
    method: 'nfc',
    usn: '1DS23CS0084',
    outcome: 'cloned',
    latency: 0.78,
    detail: 'The card did not answer the challenge. Keep the card and call the card office.',
  },
  {
    key: 'revoked-nfc',
    label: 'Revoked card',
    method: 'nfc',
    usn: '1DS23CS0084',
    outcome: 'revoked',
    latency: 0.81,
    detail: 'Card EIDX 0084 was revoked on 14 November. Hand the card to the card office.',
  },
]

type ScreenState = 'idle' | 'loading' | 'done'

export function VerifyConsole() {
  const { role } = useSession()
  const [method, setMethod] = useState<Method>('qr')
  const [scenarioKey, setScenarioKey] = useState('valid-qr')
  const [screen, setScreen] = useState<ScreenState>('idle')

  const methodScenarios = scenarios.filter((item) => item.method === method)
  const scenario = methodScenarios.find((item) => item.key === scenarioKey) ?? scenarios[0]
  const student = studentByUsn.get(scenario.usn)
  const accepted = scenario.outcome === 'accepted'

  const pickMethod = (next: Method) => {
    setMethod(next)
    const first = scenarios.find((item) => item.method === next)
    if (first) setScenarioKey(first.key)
    setScreen('idle')
  }

  const run = () => {
    setScreen('loading')
    window.setTimeout(() => setScreen('done'), 850)
  }

  return (
    <div>
      <PageHeader
        title="Verification console"
        description="Run a QR or NFC check and see how a reader decision is presented."
        meta={
          <>
            <span className="caption-4 text-ink-500">Reader GATE 01, Main gate</span>
            <span className="caption-4 text-ink-500">Scripted test cases</span>
          </>
        }
      >
        {role === 'admin' ? (
          <Link to="/admin/verifications" className={buttonStyles('secondary', 'sm')}>
            Open verification log
          </Link>
        ) : null}
      </PageHeader>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <h2 className="heading-6">Run a check</h2>
          <p className="mt-1 caption-2 text-ink-500">
            Choose a method and a test case. The result arrives after a short simulated round
            trip.
          </p>

          <div className="mt-5 inline-flex rounded-lg bg-paper-100 p-1" role="tablist" aria-label="Verification method">
            <button
              type="button"
              role="tab"
              aria-selected={method === 'qr'}
              onClick={() => pickMethod('qr')}
              className={cn(
                'inline-flex items-center gap-2 rounded-sm px-3 py-1 caption-3 transition-colors duration-300 ease-base',
                method === 'qr' ? 'bg-paper-0 text-ink-900' : 'text-ink-500 hover:text-ink-900',
              )}
            >
              <QrCode size={16} weight="bold" />
              QR scan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={method === 'nfc'}
              onClick={() => pickMethod('nfc')}
              className={cn(
                'inline-flex items-center gap-2 rounded-sm px-3 py-1 caption-3 transition-colors duration-300 ease-base',
                method === 'nfc' ? 'bg-paper-0 text-ink-900' : 'text-ink-500 hover:text-ink-900',
              )}
            >
              <ContactlessPayment size={16} weight="bold" />
              NFC tap
            </button>
          </div>

          <div className="mt-5">
            <label htmlFor="test-case" className="field-label">
              Test case
            </label>
            <select
              id="test-case"
              className="field"
              value={scenario.key}
              onChange={(event) => {
                setScenarioKey(event.target.value)
                setScreen('idle')
              }}
            >
              {methodScenarios.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex aspect-square w-full items-center justify-center rounded-2xl border border-paper-300 bg-paper-100 p-6">
            {method === 'qr' ? (
              <div className="relative flex items-center justify-center">
                <div className="rounded-xl bg-paper-0 p-4 opacity-50">
                  <QRCodeSVG
                    value={`eidx://verify?token=${scenario.key}&usn=${scenario.usn}`}
                    size={148}
                    level="M"
                    marginSize={0}
                    bgColor="#fbfcf8"
                    fgColor="#151917"
                  />
                </div>
                <span className="absolute -left-2 -top-2 size-6 rounded-tl-lg border-l-2 border-t-2 border-ink-900" />
                <span className="absolute -right-2 -top-2 size-6 rounded-tr-lg border-r-2 border-t-2 border-ink-900" />
                <span className="absolute -bottom-2 -left-2 size-6 rounded-bl-lg border-b-2 border-l-2 border-ink-900" />
                <span className="absolute -bottom-2 -right-2 size-6 rounded-br-lg border-b-2 border-r-2 border-ink-900" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex size-24 items-center justify-center rounded-2xl border border-paper-300 bg-paper-0">
                  <ContactlessPayment size={56} className="text-ink-900" />
                </div>
                <p className="caption-2 text-ink-500">Place the card on the reader</p>
              </div>
            )}
          </div>

          <Button className="mt-6 w-full" onClick={run} disabled={screen === 'loading'}>
            <Scan size={18} weight="bold" />
            {screen === 'loading' ? 'Checking card' : 'Run check'}
          </Button>

          <p className="mt-3 caption-5 text-ink-500">
            These test cases are scripted on this screen. No reader hardware is connected, and real
            decisions are recorded in the verification log.
          </p>
        </section>

        <section className="lg:col-span-7">
          <h2 className="heading-6">Decision</h2>
          <p className="mt-1 caption-2 text-ink-500">
            Identity is trusted only after the server checks the token and card status.
          </p>

          <div
            className="mt-5 min-h-96 rounded-2xl border border-paper-200 bg-paper-0 p-4 sm:p-6"
            aria-live="polite"
          >
            {screen === 'loading' ? (
              <p className="sr-only" role="status">
                Checking card
              </p>
            ) : null}

            {screen === 'idle' ? (
              <div className="flex h-full min-h-80 flex-col items-center justify-center text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-paper-100">
                  <ShieldCheck size={24} className="text-ink-500" />
                </div>
                <p className="mt-4 body-1">No check yet</p>
                <p className="mt-1 max-w-80 body-6 text-ink-500 text-pretty">
                  Pick a test case and run a check. The result will show the identity record, the
                  reader and the time taken.
                </p>
              </div>
            ) : null}

            {screen === 'loading' ? (
              <div className="space-y-4" aria-hidden="true">
                <div className="h-5 w-24 animate-pulse rounded-full bg-paper-200" />
                <div className="h-8 w-56 animate-pulse rounded-full bg-paper-200" />
                <div className="h-4 w-40 animate-pulse rounded-full bg-paper-200" />
                <div className="mt-8 grid grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="space-y-2">
                      <div className="h-3 w-16 animate-pulse rounded-full bg-paper-200" />
                      <div className="h-4 w-24 animate-pulse rounded-full bg-paper-200" />
                    </div>
                  ))}
                </div>
                <div className="mt-8 h-20 animate-pulse rounded-xl bg-paper-100" />
                <p className="pt-2 caption-5 text-ink-500">Waiting for the simulated decision.</p>
              </div>
            ) : null}

            {screen === 'done' ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Pill
                    label={accepted ? 'Verified' : 'Rejected'}
                    tone={accepted ? 'verified' : 'critical'}
                  />
                  <p className="font-mono caption-4 text-ink-500">10:42:08</p>
                </div>

                {accepted ? (
                  <div className="mt-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle size={28} weight="fill" className="text-verified" />
                      <div>
                        <p className="heading-4">{student?.name}</p>
                        <p className="mt-1 font-mono caption-4 text-ink-500">{student?.usn}</p>
                      </div>
                    </div>
                    <p className="mt-3 max-w-[520px] body-6 text-ink-700">
                      {student?.programme}, {student?.semester}, {student?.section}.
                    </p>

                    <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-paper-200 pt-4 sm:grid-cols-4">
                      <div>
                        <dt className="caption-5 text-ink-500">Method</dt>
                        <dd className="mt-1 caption-3">{method === 'qr' ? 'QR scan' : 'NFC tap'}</dd>
                      </div>
                      <div>
                        <dt className="caption-5 text-ink-500">Reader</dt>
                        <dd className="mt-1 font-mono caption-3">GATE 01</dd>
                      </div>
                      <div>
                        <dt className="caption-5 text-ink-500">Latency</dt>
                        <dd className="mt-1 font-mono caption-3">{scenario.latency.toFixed(2)} s</dd>
                      </div>
                      <div>
                        <dt className="caption-5 text-ink-500">Valid to</dt>
                        <dd className="mt-1 caption-3">{student?.card.validTo}</dd>
                      </div>
                    </dl>

                    <div className="mt-6 flex items-start gap-3 rounded-xl bg-verified-soft p-3">
                      <CheckCircle size={18} weight="bold" className="mt-0.5 shrink-0 text-verified" />
                      <p className="caption-1 text-verified text-pretty">{scenario.detail}</p>
                    </div>

                    <p className="mt-4 caption-5 text-ink-500">
                      Trust decision made on the server. The card only displayed the token.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6">
                    <div className="flex items-center gap-3">
                      <XCircle size={28} weight="fill" className="text-critical" />
                      <div>
                        <p className="heading-4">Check rejected</p>
                        <p className="mt-1 font-mono caption-4 text-ink-500">
                          Card {student?.card.id}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 max-w-[520px] body-6 text-ink-700 text-pretty">
                      {scenario.detail}
                    </p>

                    <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-paper-200 pt-4 sm:grid-cols-4">
                      <div>
                        <dt className="caption-5 text-ink-500">Presented by</dt>
                        <dd className="mt-1 caption-3">{student?.name}</dd>
                      </div>
                      <div>
                        <dt className="caption-5 text-ink-500">Method</dt>
                        <dd className="mt-1 caption-3">{method === 'qr' ? 'QR scan' : 'NFC tap'}</dd>
                      </div>
                      <div>
                        <dt className="caption-5 text-ink-500">Reader</dt>
                        <dd className="mt-1 font-mono caption-3">GATE 01</dd>
                      </div>
                      <div>
                        <dt className="caption-5 text-ink-500">Latency</dt>
                        <dd className="mt-1 font-mono caption-3">{scenario.latency.toFixed(2)} s</dd>
                      </div>
                    </dl>

                    <div className="mt-6 flex items-start gap-3 rounded-xl bg-critical-soft p-3">
                      <XCircle size={18} weight="bold" className="mt-0.5 shrink-0 text-critical" />
                      <p className="caption-1 text-critical">No attendance was written.</p>
                    </div>

                    <p className="mt-4 caption-5 text-ink-500">
                      The reader did not grant entry. The card was not trusted on its own.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <SectionHead
          title="What the backend checks"
          description="The card never makes the trust decision."
        />
        <dl className="mt-4 grid gap-4 border-y border-paper-200 py-4 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-paper-200">
          <div className="lg:pr-6">
            <dt className="body-5">Signature and expiry</dt>
            <dd className="mt-1 caption-5 text-ink-500 text-pretty">
              The token must carry a valid signature and must not be past its 60 second window.
            </dd>
          </div>
          <div className="lg:px-6">
            <dt className="body-5">Nonce reuse</dt>
            <dd className="mt-1 caption-5 text-ink-500 text-pretty">
              A token that has already been used is rejected, so a screenshot cannot be replayed.
            </dd>
          </div>
          <div className="lg:px-6">
            <dt className="body-5">Card status</dt>
            <dd className="mt-1 caption-5 text-ink-500 text-pretty">
              A revoked or unprovisioned card is stopped before attendance is written.
            </dd>
          </div>
          <div className="lg:pl-6">
            <dt className="body-5">Reader scope</dt>
            <dd className="mt-1 caption-5 text-ink-500 text-pretty">
              The reader's role and location decide which services the check can open.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
