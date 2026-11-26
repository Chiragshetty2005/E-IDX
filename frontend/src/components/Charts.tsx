import type { ShapFeature } from '../types'
import { cn } from '../lib/ui'

export function TrendChart({
  data,
  label,
  min = 70,
  max = 100,
  suffix = '%',
}: {
  data: { label: string; value: number }[]
  label: string
  min?: number
  max?: number
  suffix?: string
}) {
  const width = 400
  const height = 96
  const top = 10
  const bottom = 86
  const step = width / Math.max(1, data.length - 1)
  const points = data.map((point, index) => ({
    x: index * step,
    y: bottom - ((point.value - min) / (max - min)) * (bottom - top),
  }))
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
  const last = data[data.length - 1]

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full"
        role="img"
        aria-label={label}
      >
        {[top, (top + bottom) / 2, bottom].map((y) => (
          <line
            key={y}
            x1="0"
            x2={width}
            y1={y}
            y2={y}
            stroke="#dbe1d4"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={path}
          fill="none"
          stroke="#151917"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((point, index) => (
          <circle
            key={data[index].label}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 4 : 2.5}
            fill={index === points.length - 1 ? '#151917' : '#f3f5ef'}
            stroke="#151917"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="caption-5 text-ink-500">
          {data[0].label}, {data[0].value.toFixed(1)}
          {suffix}
        </p>
        <p className="caption-5 text-ink-700">
          {last.label}, {last.value.toFixed(1)}
          {suffix}
        </p>
      </div>
    </div>
  )
}

export function RiskBar({
  support,
  watch,
  onTrack,
  total,
  showCounts = true,
}: {
  support: number
  watch: number
  onTrack: number
  total: number
  showCounts?: boolean
}) {
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-paper-200" aria-hidden="true">
        <div className="bg-critical" style={{ width: `${(support / total) * 100}%` }} />
        <div className="bg-attention" style={{ width: `${(watch / total) * 100}%` }} />
        <div className="bg-ink-300" style={{ width: `${(onTrack / total) * 100}%` }} />
      </div>
      <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <LegendItem color="bg-critical" label="Needs support" value={support} showCount={showCounts} />
        <LegendItem color="bg-attention" label="Watch" value={watch} showCount={showCounts} />
        <LegendItem color="bg-ink-300" label="On track" value={onTrack} showCount={showCounts} />
      </dl>
    </div>
  )
}

function LegendItem({
  color,
  label,
  value,
  showCount,
}: {
  color: string
  label: string
  value: number
  showCount: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('size-2 rounded-full', color)} />
      <dt className="caption-5 text-ink-500">{label}</dt>
      {showCount ? <dd className="font-mono caption-4">{value.toLocaleString('en-IN')}</dd> : null}
    </div>
  )
}

export function FeatureBars({
  features,
}: {
  features: { label: string; value: number }[]
}) {
  const max = Math.max(...features.map((feature) => feature.value))
  return (
    <div className="space-y-3">
      {features.map((feature) => (
        <div key={feature.label}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="caption-1 text-ink-700">{feature.label}</p>
            <p className="font-mono caption-4 text-ink-500">{feature.value.toFixed(2)}</p>
          </div>
          <div className="mt-1 h-2 rounded-full bg-paper-200">
            <div
              className="h-2 rounded-full bg-ink-900"
              style={{ width: `${(feature.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ShapBars({ features }: { features: ShapFeature[] }) {
  const max = Math.max(...features.map((feature) => Math.abs(feature.value)))
  return (
    <div>
      <div className="space-y-3">
        {features.map((feature) => (
          <div key={feature.label}>
            <div className="flex items-baseline justify-between gap-4">
              <p className="caption-1 text-ink-700">{feature.label}</p>
              <p
                className={cn(
                  'font-mono caption-4',
                  feature.value < 0 ? 'text-critical' : 'text-verified',
                )}
              >
                {feature.value > 0 ? '+' : ''}
                {feature.value.toFixed(2)}
              </p>
            </div>
            <div className="relative mt-1 h-2 rounded-full bg-paper-200">
              <div
                className={cn(
                  'absolute top-0 h-2 rounded-full',
                  feature.value < 0 ? 'right-1/2 bg-critical' : 'left-1/2 bg-verified',
                )}
                style={{ width: `${(Math.abs(feature.value) / max) * 46}%` }}
              />
              <div className="absolute left-1/2 top-0 z-10 h-2 w-px -translate-x-1/2 bg-paper-300" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-critical" />
          <p className="caption-5 text-ink-500">Pushes toward risk</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-verified" />
          <p className="caption-5 text-ink-500">Pushes toward success</p>
        </div>
      </div>
    </div>
  )
}

export function VolumeBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((item) => item.value))
  return (
    <div>
      <div className="flex h-20 items-end gap-2">
        {data.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-sm bg-ink-900"
              style={{ height: `${Math.max(6, (item.value / max) * 68)}px` }}
              title={`${item.label}: ${item.value} checks`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((item) => (
          <p key={item.label} className="min-w-0 flex-1 text-center caption-5 text-ink-500">
            {item.label}
          </p>
        ))}
      </div>
    </div>
  )
}
