import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowsClockwise, WarningCircle } from '@phosphor-icons/react'
import { errorMessage } from '../api/client'
import { endpoints } from '../api/endpoints'
import { useSession } from '../session'
import { Button } from './Button'

const PREVIEW_TTL_SECONDS = 60

function makeToken(usn: string) {
  const nonce = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `EIDX.${usn.slice(-4)}.${nonce}`
}

export function QrPass({ usn }: { usn: string }) {
  const { isLive } = useSession()
  const [liveToken, setLiveToken] = useState<string | null>(null)
  const [previewToken, setPreviewToken] = useState(() => makeToken(usn))
  const [seconds, setSeconds] = useState(PREVIEW_TTL_SECONDS)
  const [ttl, setTtl] = useState(PREVIEW_TTL_SECONDS)
  const [expiry, setExpiry] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const issuePass = useCallback(async () => {
    if (!isLive) {
      setExpiry(Date.now() + PREVIEW_TTL_SECONDS * 1000)
      setPreviewToken(makeToken(usn))
      setSeconds(PREVIEW_TTL_SECONDS)
      setError(null)
      return
    }

    setLoading(true)
    try {
      const response = await endpoints.createPass()
      const expiresAt = new Date(response.pass.expires_at).getTime()
      setLiveToken(response.pass.token)
      setExpiry(expiresAt)
      setTtl(Math.max(1, Math.round((expiresAt - Date.now()) / 1000)))
      setSeconds(Math.max(1, Math.round((expiresAt - Date.now()) / 1000)))
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [isLive, usn])

  useEffect(() => {
    if (!isLive) return
    void issuePass()
  }, [isLive, issuePass])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (seconds > 0) return
    if (isLive) {
      void issuePass()
      return
    }
    setExpiry(Date.now() + PREVIEW_TTL_SECONDS * 1000)
    setPreviewToken(makeToken(usn))
    setSeconds(PREVIEW_TTL_SECONDS)
  }, [seconds, isLive, issuePass, usn])

  const token = isLive ? liveToken : previewToken
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(1, seconds / ttl))

  return (
    <section className="min-w-0 rounded-2xl border border-paper-200 bg-paper-0 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="heading-6">Verification pass</h2>
          <p className="mt-1 caption-2 text-ink-500">
            {isLive
              ? 'The code is signed by the card service and refreshes automatically.'
              : 'The code is signed by the card service and expires after 60 seconds.'}
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
              strokeDashoffset={circumference * (1 - progress)}
            />
          </svg>
          <span className="font-mono caption-3" aria-label={`Code refreshes in ${seconds} seconds`}>
            {seconds}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <div className="rounded-xl border border-paper-200 bg-paper-0 p-3">
          {token ? (
            <QRCodeSVG
              value={isLive ? token : `eidx://verify?token=${token}&usn=${usn}&exp=${expiry}`}
              size={168}
              level="M"
              marginSize={0}
              bgColor="#fbfcf8"
              fgColor="#151917"
            />
          ) : (
            <div className="flex size-[168px] items-center justify-center rounded-lg bg-paper-100 caption-5 text-ink-500">
              Requesting a pass…
            </div>
          )}
        </div>
        <p className="mt-4 font-mono caption-4 text-ink-700">
          {isLive && token ? `Signed pass · ${token.slice(-10)}` : token}
        </p>
        <p className="mt-1 caption-5 text-ink-500">Scan at a gate reader or an exam desk.</p>

        {error ? (
          <p className="mt-3 flex items-start gap-2 caption-5 text-critical" role="alert">
            <WarningCircle size={16} weight="bold" className="mt-0.5 shrink-0" />
            The pass could not be issued: {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="caption-5 text-ink-500">A screenshot stops working after expiry.</p>
        <Button variant="secondary" size="sm" onClick={() => void issuePass()} disabled={loading}>
          <ArrowsClockwise size={14} weight="bold" />
          {loading ? 'Refreshing' : 'Refresh code'}
        </Button>
      </div>
    </section>
  )
}
