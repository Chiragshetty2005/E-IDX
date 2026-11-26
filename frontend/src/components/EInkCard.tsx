import { QRCodeSVG } from 'qrcode.react'
import type { CardHolder } from '../types'
import { cn } from '../lib/ui'

interface EInkCardProps {
  student: CardHolder
  view?: 'identity' | 'services'
  size?: 'preview' | 'compact'
  programme?: string
  validTo?: string
  refreshing?: boolean
  className?: string
}

export function EInkCard({
  student,
  view = 'identity',
  size = 'preview',
  programme,
  validTo,
  refreshing = false,
  className,
}: EInkCardProps) {
  const compact = size === 'compact'
  const shownProgramme = programme ?? student.programme
  const shownValidity = validTo ?? student.card.validTo

  return (
    <div
      className={cn(
        'relative min-w-0 w-full bg-ink-900 shadow-eink',
        compact ? 'rounded-xl p-1' : 'rounded-2xl p-2',
        className,
      )}
    >
      <div
        className={cn(
          'relative aspect-[2.04/1] overflow-hidden rounded-lg bg-eink text-eink-ink max-[379px]:aspect-auto max-[379px]:min-h-44',
          compact ? 'px-3 py-3' : 'px-4 py-4',
        )}
      >
        {view === 'identity' ? (
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="caption-3">Dayananda Sagar University</p>
                <p className="mt-1 caption-5 text-eink-ink/60">Student identity card</p>
              </div>
              <p className="shrink-0 font-mono caption-5 text-eink-ink/60">{student.card.id}</p>
            </div>

            <div className="flex min-h-0 items-center gap-3">
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-sm bg-ink-900 text-eink',
                  compact ? 'size-10' : 'size-12',
                )}
              >
                <span className={compact ? 'caption-4' : 'caption-3'}>{student.initials}</span>
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={compact ? 'truncate title-4' : 'truncate title-2'}
                  title={student.name}
                >
                  {student.name}
                </p>
                <p className="mt-1 font-mono caption-4 text-eink-ink/70">{student.usn}</p>
                {!compact ? (
                  <p className="mt-1 hidden truncate caption-5 text-eink-ink/60 sm:block">
                    {shownProgramme}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0">
                <QRCodeSVG
                  value={`EIDX.VERIFY.${student.usn}.${shownValidity}`}
                  size={compact ? 42 : 62}
                  level="M"
                  marginSize={1}
                  bgColor="#f2f3ec"
                  fgColor="#171a18"
                />
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <p className="caption-5 text-eink-ink/60">
                {student.semester}, {student.section.replace('Section ', 'Sec ')}
              </p>
              <p className="font-mono caption-5 text-eink-ink/70">
                <span className="max-[379px]:hidden">Valid to </span>
                {shownValidity}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="caption-3">Campus services</p>
                <p className="mt-1 caption-5 text-eink-ink/60">{student.name}</p>
              </div>
              <p className="shrink-0 font-mono caption-5 text-eink-ink/60">{student.card.id}</p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <ServiceRow label="Attendance" value={`${student.attendance.toFixed(1)}%`} />
              <ServiceRow label="Library" value="No dues" />
              <ServiceRow label="Next exam" value="02 Dec" />
              <ServiceRow label="Hall" value="C 203" />
              <ServiceRow label="Fees" value="Paid" />
              <ServiceRow label="Last tap" value="09:41" />
            </dl>

            <div className="flex items-end justify-between gap-3">
              <p className="caption-5 text-eink-ink/60">Tap the card to change view</p>
              <p className="font-mono caption-5 text-eink-ink/70">
                <span className="max-[379px]:hidden">Valid to </span>
                {shownValidity}
              </p>
            </div>
          </div>
        )}

        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 z-10 bg-eink-ink transition-opacity duration-300 ease-base',
            refreshing ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
    </div>
  )
}

function ServiceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-eink-ink/10 pb-1">
      <dt className="caption-5 text-eink-ink/55">{label}</dt>
      <dd className="caption-3">{value}</dd>
    </div>
  )
}
