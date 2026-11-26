import { cn } from '../lib/ui'

/**
 * A small line under the page header that explains where the numbers came
 * from. Live pages show it while they load and when the API call fails.
 */
export function DataNotice({
  loading,
  error,
  className,
}: {
  loading: boolean
  error: string | null
  className?: string
}) {
  if (!loading && !error) return null

  return (
    <p
      className={cn('mt-2 caption-5', error ? 'text-critical' : 'text-ink-500', className)}
      role={error ? 'alert' : 'status'}
    >
      {error
        ? `Live data unavailable (${error}). The preview register is shown instead.`
        : 'Loading live data from the campus API…'}
    </p>
  )
}
