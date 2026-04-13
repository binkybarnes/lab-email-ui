export default function Navbar({ selectedCount }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14"
      style={{
        background: 'rgba(247, 248, 250, 0.88)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="text-primary font-semibold text-sm tracking-tight"
          style={{ fontFamily: '"DM Sans", sans-serif' }}
        >
          UCSD Lab Browser
        </span>
        <span className="text-muted text-xs font-mono hidden sm:inline">
          Browse labs · contact researchers
        </span>
      </div>

      {selectedCount > 0 && (
        <div
          className="text-xs font-mono px-2.5 py-1 rounded-full"
          style={{
            background: '#dbeafe',
            color: '#1e40af',
            border: '1px solid #bfdbfe',
          }}
        >
          {selectedCount} selected
        </div>
      )}
    </header>
  )
}
