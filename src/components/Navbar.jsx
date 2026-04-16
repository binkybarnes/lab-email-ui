export default function Navbar({ selectedCount = 0, rightOffset = '0', user = null, onSignOut, adminMode = false, onSignIn, onProfile }) {
  return (
    <header
      className="fixed top-0 left-0 z-50 flex items-center justify-between px-6 h-14 transition-all duration-300"
      style={{
        right: rightOffset,
        background: 'rgba(30, 33, 40, 0.88)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #363b47',
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
            className="text-xs px-2.5 py-1 transition-colors"
            style={{ border: '1px solid #363b47', borderRadius: '3px', background: 'transparent', color: '#64748b' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#272b34'; e.currentTarget.style.color = '#e4e7ed' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}
            title="Edit your AI profile"
          >
            ✦ profile
          </button>
        )}
        {selectedCount > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="text-xs px-2.5 py-0.5 rounded"
            style={{
              background: 'rgba(77,109,255,0.15)',
              color: '#7b9fff',
              border: '1px solid rgba(77,109,255,0.3)',
            }}
          >
            {selectedCount} selected
          </div>
        )}

        {adminMode && (
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] px-1.5 py-0.5 uppercase tracking-widest"
              style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', borderRadius: '3px', border: '1px solid rgba(234,179,8,0.3)' }}
            >
              admin
            </span>
            {user ? (
              <>
                <span className="text-xs text-muted">{user.email}</span>
                <button
                  onClick={onSignOut}
                  className="text-xs px-2.5 py-1 text-muted transition-colors"
                  style={{ border: '1px solid #363b47', borderRadius: '3px', background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#272b34'; e.currentTarget.style.color = '#e4e7ed' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '' }}
                >
                  sign out
                </button>
              </>
            ) : onSignIn && (
              <button
                onClick={onSignIn}
                className="text-xs px-2.5 py-1 text-muted transition-colors"
                style={{ border: '1px solid #363b47', borderRadius: '3px', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#272b34'; e.currentTarget.style.color = '#e4e7ed' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '' }}
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
