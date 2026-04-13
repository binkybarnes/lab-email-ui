export default function StickyActionBar({ selectedMembers, onEmailSelected, onClear }) {
  const visible = selectedMembers.length > 0

  return (
    <div
      className="fixed bottom-0 left-64 right-0 z-50 flex items-center justify-between px-8 py-3.5 transition-transform duration-300 ease-out"
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid #e2e8f0',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        boxShadow: '0 -4px 24px rgba(15,23,42,0.06)',
      }}
    >
      <div className="flex items-center gap-4">
        <span className="text-sm text-primary">
          <span className="font-semibold">{selectedMembers.length}</span>
          <span className="text-secondary ml-1">
            {selectedMembers.length === 1 ? 'member' : 'members'} selected
          </span>
        </span>
        <button
          onClick={onClear}
          className="text-xs font-mono text-muted hover:text-secondary transition-colors"
        >
          Clear
        </button>
      </div>
      <button
        onClick={() => onEmailSelected(selectedMembers)}
        className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150"
        style={{ background: '#1d4ed8', color: '#ffffff' }}
        onMouseEnter={e => e.currentTarget.style.background = '#1e40af'}
        onMouseLeave={e => e.currentTarget.style.background = '#1d4ed8'}
      >
        Email Selected →
      </button>
    </div>
  )
}
