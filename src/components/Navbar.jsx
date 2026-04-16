import { useState, useEffect, useRef } from 'react'
import useUsageStore from '../stores/useUsageStore'

function useTimeUntil(resetsAt) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!resetsAt) { setLabel(''); return }
    function update() {
      const diff = Math.max(0, Math.floor((new Date(resetsAt).getTime() - Date.now()) / 1000))
      if (diff <= 0) { setLabel('now'); return }
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [resetsAt])
  return label
}

function UsageDropdown() {
  const dailyRemaining = useUsageStore(s => s.remaining)
  const usageLimit = useUsageStore(s => s.limit)
  const resetsAt = useUsageStore(s => s.resetsAt)
  const resetLabel = useTimeUntil(resetsAt)
  const loading = dailyRemaining === null || usageLimit === null
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const max = usageLimit || 10
  const used = loading ? 0 : max - dailyRemaining
  const pct = loading ? 0 : (used / max) * 100
  const barColor = dailyRemaining === 0 ? '#f87171' : dailyRemaining !== null && dailyRemaining <= 3 ? '#eab308' : 'var(--color-accent, #4d6dff)'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={`text-xs px-2.5 py-1 rounded-sm border transition-colors ${
          open
            ? 'border-accent bg-accent/10 text-secondary'
            : 'border-border text-muted hover:bg-panel-hover hover:text-primary'
        }`}
      >
        usage
      </button>
      {open && (
        <div className="absolute right-0 mt-2 px-4 py-3 flex flex-col gap-2 w-[200px] bg-surface border border-border rounded-md shadow-panel z-50">
          {loading ? (
            <div className="flex items-center gap-2">
              <span
                className="animate-spin"
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  border: '1.5px solid rgba(148,163,184,0.3)',
                  borderTopColor: '#94a3b8',
                  borderRadius: '50%',
                }}
              />
              <span className="text-xs text-muted">Loading...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{dailyRemaining} remaining</span>
                <span className="text-xs text-muted/60">{used}/{max}</span>
              </div>
              <div className="h-1 bg-panel rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor, transition: 'width 0.3s ease' }} />
              </div>
              {resetLabel && (
                <span className="text-[11px] text-muted/60">
                  resets in {resetLabel}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function Navbar({ selectedCount = 0, rightOffset = '0', user = null, onSignOut, devMode = false, onSignIn, onProfile }) {
  return (
    <header
      className="fixed top-0 left-0 z-50 flex items-center justify-between px-6 h-14 transition-all duration-300 border-b border-border"
      style={{
        right: rightOffset,
        background: 'rgba(30, 33, 40, 0.88)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-baseline gap-3">
        <span className="text-primary font-semibold text-2xl tracking-tight font-serif">
          UCSD Lab Browser
        </span>
      </div>

      <div className="flex items-center gap-3">
        {onProfile && (
          <button
            onClick={onProfile}
            className="text-xs px-2.5 py-1 rounded-sm border border-border text-muted hover:bg-panel-hover hover:text-primary transition-colors"
            title="Edit your AI profile"
          >
            ✦ profile
          </button>
        )}
        <UsageDropdown />
        {selectedCount > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="text-xs px-2.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/30"
          >
            {selectedCount} selected
          </div>
        )}

        {devMode && (
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="text-xs text-muted">{user.email}</span>
                <button
                  onClick={onSignOut}
                  className="text-xs px-2.5 py-1 rounded-sm border border-border text-muted hover:bg-panel-hover hover:text-primary transition-colors"
                >
                  sign out
                </button>
              </>
            ) : onSignIn && (
              <button
                onClick={onSignIn}
                className="text-xs px-2.5 py-1 rounded-sm border border-border text-muted hover:bg-panel-hover hover:text-primary transition-colors"
              >
                sign in with Google
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
