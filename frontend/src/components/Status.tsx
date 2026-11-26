import type { CardStatus, RiskLevel, VerificationResult } from '../types'
import { cardStatusLabel, cn, riskLabel } from '../lib/ui'

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
