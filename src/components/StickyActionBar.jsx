export default function StickyActionBar({ selectedMembers, onEmailSelected, onClear }) {
  const visible = selectedMembers.length > 0

  return (
    <div
      className="fixed bottom-0 left-60 right-0 z-50 flex items-center justify-between px-7 py-3 transition-transform duration-300 ease-out"
      style={{
        background: 'rgba(30, 33, 40, 0.96)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid #363b47',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-center gap-4">
        <span className="text-sm font-mono text-secondary">
          <span className="text-primary font-medium">{selectedMembers.length}</span>
          {' '}{selectedMembers.length === 1 ? 'member' : 'members'} selected
        </span>
        <button
          onClick={onClear}
          className="text-xs font-mono text-muted hover:text-secondary transition-colors"
        >
          clear
        </button>
      </div>
      <button
        onClick={() => onEmailSelected(selectedMembers)}
        className="text-xs font-mono px-4 py-1.5 transition-all duration-150"
        style={{ background: '#4d6dff', color: '#ffffff', borderRadius: '3px' }}
        onMouseEnter={e => e.currentTarget.style.background = '#3d5df0'}
        onMouseLeave={e => e.currentTarget.style.background = '#4d6dff'}
      >
        Email Selected →
      </button>
    </div>
  )
}
