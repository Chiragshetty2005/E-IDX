import { Link } from 'react-router-dom'
import { useSession, roleHome } from '../session'
import { buttonStyles } from '../components/Button'

export function NotFound() {
  const { role } = useSession()

  return (
    <div className="flex min-h-[60vh] items-center">
      <div className="max-w-[680px]">
        <svg viewBox="0 0 24 24" className="size-10 text-ink-900" aria-hidden="true">
          <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" />
          <rect x="14" y="2" width="6" height="6" rx="1" fill="currentColor" />
          <rect x="2" y="14" width="6" height="6" rx="1" fill="currentColor" />
          <rect
            x="12"
            y="12"
            width="8"
            height="8"
            rx="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        <h1 className="mt-6 heading-3 text-balance">This page is not part of the card</h1>
        <p className="mt-3 body-3 text-ink-500 text-pretty">
          The address may be out of date, or the page may have moved. Go back to the campus
          platform and continue from there.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={roleHome[role]} className={buttonStyles('primary', 'sm')}>
            Go to the overview
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className={buttonStyles('secondary', 'sm')}
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}
