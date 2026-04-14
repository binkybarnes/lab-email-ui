const ROLE_CONFIG = {
  PI: { bg: 'rgba(217,119,6,0.15)', text: '#fbbf24', accent: '#d97706' },
  Postdoc: { bg: 'rgba(217,119,6,0.10)', text: '#f59e0b', accent: '#b45309' },
  PhD: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', accent: '#3b82f6' },
  Masters: { bg: 'rgba(59,130,246,0.10)', text: '#7eb8fb', accent: '#2563eb' },
  Staff: { bg: 'rgba(134,239,172,0.12)', text: '#86efac', accent: '#22c55e' },
  Undergrad: { bg: 'rgba(100,116,139,0.12)', text: '#8892a4', accent: '#52586a' },
}

function getInitials(name) {
  const cleaned = name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*/i, '')
  const parts = cleaned.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function MemberCard({ member, selected, onToggle, onEmail, anySelected, isLast }) {
  const cfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.Undergrad

  return (
    <div
      onClick={() => onToggle(member.id)}
      className="relative flex items-center gap-3 px-3 py-2 transition-colors duration-150 group cursor-pointer"
      style={{
        background: selected ? 'rgba(77,109,255,0.08)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid #2d3240',
        borderLeft: `2px solid ${selected ? '#4d6dff' : cfg.accent}`,
        cursor: 'default',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.background = '#272b34'
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded flex items-center justify-center text-xs font-medium flex-shrink-0"
        style={{ background: cfg.bg, color: cfg.text }}
      >
        {member.photo
          ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" style={{ borderRadius: '3px' }} />
          : getInitials(member.name)
        }
      </div>

      {/* Name + Role */}
      <div className="flex items-center gap-2 min-w-0 w-44 flex-shrink-0">
        <span className="text-xs font-medium text-primary truncate leading-none">
          {member.name}
        </span>
        <span
          className="text-xs px-1 py-0.5 flex-shrink-0 leading-none"
          style={{ background: cfg.bg, color: cfg.text, borderRadius: '2px' }}
        >
          {member.role}
        </span>
      </div>

      {/* Email address */}
      <div className="text-xs truncate flex-1 min-w-0" style={{ color: member.email ? '#8892a4' : '#f87171' }}>
        {member.email || 'No email — you\'ll need to enter it'}
      </div>

      {/* Action */}
      <div className="flex items-center flex-shrink-0 ml-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(member.id); }}
          className="text-xs w-20 py-1 transition-all duration-300 flex items-center justify-center font-medium relative overflow-hidden"
          style={{
            border: '1px solid',
            borderColor: selected ? 'rgba(77,109,255,0.4)' : '#363b47',
            background: selected ? 'rgba(77,109,255,0.1)' : 'transparent',
            color: selected ? '#7b9fff' : '#8892a4',
            borderRadius: '4px',
            boxShadow: selected ? '0 0 10px rgba(77,109,255,0.1) inset' : 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#4d6dff'
            e.currentTarget.style.color = '#7b9fff'
            e.currentTarget.style.background = 'rgba(77,109,255,0.15)'
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(77,109,255,0.15)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = selected ? 'rgba(77,109,255,0.4)' : '#363b47'
            e.currentTarget.style.color = selected ? '#7b9fff' : '#8892a4'
            e.currentTarget.style.background = selected ? 'rgba(77,109,255,0.1)' : 'transparent'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = selected ? '0 0 10px rgba(77,109,255,0.1) inset' : 'none'
          }}
        >
          <span className="relative z-10">{selected ? 'Added ✓' : 'Add +'}</span>
        </button>
      </div>
    </div>
  )
}
