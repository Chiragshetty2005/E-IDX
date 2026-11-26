import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowsClockwise } from '@phosphor-icons/react'
import type { Student } from '../types'
import { Button } from './Button'

function makeToken(usn: string) {
  const nonce = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `EIDX.${usn.slice(-4)}.${nonce}`
}

export function QrPass({ student }: { student: Student }) {
  const [token, setToken] = useState(() => makeToken(student.usn))
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + 60_000)
  const [seconds, setSeconds] = useState(60)

  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setSeconds(remaining)
      if (remaining === 0) {
        setToken(makeToken(student.usn))
        setExpiresAt(Date.now() + 60_000)
        setSeconds(60)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt, student.usn])

  const refresh = () => {
    setToken(makeToken(student.usn))
    setExpiresAt(Date.now() + 60_000)
    setSeconds(60)
  }

  const radius = 18
  const circumference = 2 * Math.PI * radius

  return (
    <section className="min-w-0 rounded-2xl border border-paper-200 bg-paper-0 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="heading-6">Verification pass</h2>
          <p className="mt-1 caption-2 text-ink-500">
            The code is signed by the card service and expires after 60 seconds.
          </p>
        </div>
        <div className="relative flex size-12 shrink-0 items-center justify-center">
          <svg viewBox="0 0 44 44" className="absolute inset-0 size-12 -rotate-90" aria-hidden="true">
            <circle cx="22" cy="22" r={radius} fill="none" stroke="#dbe1d4" strokeWidth="2" />
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke="#151917"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - seconds / 60)}
            />
          </svg>
          <span className="font-mono caption-3" aria-label={`Code refreshes in ${seconds} seconds`}>
            {seconds}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <div className="rounded-xl border border-paper-200 bg-paper-0 p-3">
          <QRCodeSVG
            value={`eidx://verify?token=${token}&usn=${student.usn}&exp=${expiresAt}`}
            size={168}
            level="M"
            marginSize={0}
            bgColor="#fbfcf8"
            fgColor="#151917"
          />
        </div>
        <p className="mt-4 font-mono caption-4 text-ink-700">{token}</p>
        <p className="mt-1 caption-5 text-ink-500">Scan at a gate reader or an exam desk.</p>
      </div>

      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="caption-5 text-ink-500">A screenshot stops working after expiry.</p>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <ArrowsClockwise size={14} weight="bold" />
          Refresh code
        </Button>
      </div>
    </section>
  )
}
