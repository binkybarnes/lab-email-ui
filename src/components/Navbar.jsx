export default function Navbar({ selectedCount = 0, rightOffset = '0' }) {
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
        <span
          className="text-primary font-semibold text-2xl tracking-tight font-serif"
        >
          UCSD Lab Browser
        </span>
      </div>

      {selectedCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="text-xs  px-2.5 py-0.5 rounded"
          style={{
            background: 'rgba(77,109,255,0.15)',
            color: '#7b9fff',
            border: '1px solid rgba(77,109,255,0.3)',
          }}
        >
          {selectedCount} selected
        </div>
      )}
    </header>
  )
}
