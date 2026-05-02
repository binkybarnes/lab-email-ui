import useUsageStore from '../stores/useUsageStore'

const SPINNER = (
  <span
    className="animate-spin"
    style={{
      display: 'inline-block',
      width: 10,
      height: 10,
      border: '1.5px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
    }}
  />
)

/**
 * Blue AI action button — used in both EmailModal and ProfileModal.
 * Props: onClick, disabled, loading, loadingText, children
 */
export function AiActionButton({ onClick, disabled, loading, loadingText = 'Working...', children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="text-xs px-4 py-1.5 text-white bg-accent hover:bg-accent-hover rounded-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
    >
      {loading ? (
        <>
          {SPINNER}
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  )
}

/**
 * Shows "X left" in yellow or "Limit reached" in red.
 * Reads from Zustand store — no props needed for usage data.
 * Props: isAdmin (optional) — hides for admins
 */
export function UsageIndicator({ isAdmin }) {
  const remaining = useUsageStore(s => s.remaining)

  if (isAdmin || remaining === null || remaining > 5) return null

  if (remaining === 0) {
    return <span className="text-xs" style={{ color: '#f87171' }}>Limit reached</span>
  }

  return <span className="text-xs" style={{ color: '#ca8a04' }}>{remaining} left</span>
}

/**
 * "Limit reached — resets in Xh Xm" message in red.
 * Only renders when remaining === 0.
 * Props: isAdmin (optional) — hides for admins
 */
export function ExhaustedMessage({ isAdmin }) {
  const remaining = useUsageStore(s => s.remaining)
  const resetsAt = useUsageStore(s => s.resetsAt)

  if (isAdmin || remaining !== 0) return null

  let resetLabel = null
  if (resetsAt) {
    const diff = Math.max(0, Math.floor((new Date(resetsAt).getTime() - Date.now()) / 1000))
    if (diff <= 0) {
      resetLabel = 'now'
    } else {
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      resetLabel = h > 0 ? `${h}h ${m}m` : `${m}m`
    }
  }

  return (
    <span className="text-xs" style={{ color: '#f87171' }}>
      Limit reached{resetLabel ? ` — resets in ${resetLabel}` : ' — try again later'}
    </span>
  )
}
