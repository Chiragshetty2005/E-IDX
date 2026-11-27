import type {
  CardStatus,
  PresenceState,
  RiskLevel,
  VerificationResult,
} from '../types'
import { cardStatusLabel, cn, presenceStateLabel, riskLabel } from '../lib/ui'

type Tone = 'neutral' | 'verified' | 'attention' | 'critical'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-paper-100 text-ink-700',
  verified: 'bg-verified-soft text-verified',
  attention: 'bg-attention-soft text-attention',
  critical: 'bg-critical-soft text-critical',
}

export function Pill({
  label,
  tone = 'neutral',
  className,
}: {
  label: string
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 caption-3 whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    >
      {label}
    </span>
  )
}

export function CardStatusPill({ status }: { status: CardStatus }) {
  const tone: Tone =
    status === 'active'
      ? 'verified'
      : status === 'sync' || status === 'low-battery'
        ? 'attention'
        : status === 'revoked'
          ? 'critical'
          : 'neutral'
  return <Pill label={cardStatusLabel[status]} tone={tone} />
}

export function RiskPill({ risk }: { risk: RiskLevel }) {
  const tone: Tone = risk === 'support' ? 'critical' : risk === 'watch' ? 'attention' : 'verified'
  return <Pill label={riskLabel[risk]} tone={tone} />
}

export function ResultPill({ result }: { result: VerificationResult }) {
  return (
    <Pill
      label={result === 'accepted' ? 'Accepted' : 'Rejected'}
      tone={result === 'accepted' ? 'verified' : 'critical'}
    />
  )
}

export function MethodPill({ method }: { method: 'qr' | 'nfc' }) {
  return <Pill label={method === 'qr' ? 'QR scan' : 'NFC tap'} tone="neutral" />
}

export function PresencePill({ state }: { state: PresenceState }) {
  const tone: Tone =
    state === 'on-campus'
      ? 'verified'
      : state === 'on-bus'
        ? 'attention'
        : state === 'not-arrived'
          ? 'attention'
          : 'neutral'
  return <Pill label={presenceStateLabel[state]} tone={tone} />
}

export function NotificationPill({
  status,
  className,
}: {
  status: 'sent' | 'queued' | 'failed'
  className?: string
}) {
  const tone: Tone = status === 'sent' ? 'verified' : status === 'queued' ? 'attention' : 'critical'
  return (
    <Pill
      label={status === 'sent' ? 'Sent' : status === 'queued' ? 'Queued' : 'Failed'}
      tone={tone}
      className={className}
    />
  )
}
