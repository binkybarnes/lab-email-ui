const ROLE_CONFIG = {
  PI: { bg: 'rgba(217,119,6,0.15)', text: '#fbbf24', accent: '#d97706' },
  Postdoc: { bg: 'rgba(217,119,6,0.10)', text: '#f59e0b', accent: '#b45309' },
  PhD: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', accent: '#3b82f6' },
  MS: { bg: 'rgba(59,130,246,0.10)', text: '#7eb8fb', accent: '#2563eb' },
  Undergrad: { bg: 'rgba(100,116,139,0.12)', text: '#8892a4', accent: '#52586a' },
}

function getInitials(name) {
  const cleaned = name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*/i, '')
  const parts = cleaned.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function IconLink({ href, label, children }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="text-muted hover:text-secondary transition-colors duration-150"
    >
      {children}
    </a>
  )
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
      {/* Checkbox */}
      <div
        className="transition-opacity duration-150 flex-shrink-0 opacity-100"
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => { e.stopPropagation(); onToggle(member.id); }}
          className="w-3.5 h-3.5 cursor-pointer"
          style={{ borderRadius: '2px' }}
          aria-label={`Select ${member.name}`}
        />
      </div>

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
      <div className="text-xs text-muted truncate flex-1 min-w-0">
        {member.email}
      </div>

      {/* Links + action */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150" onClick={e => e.stopPropagation()}>
          <IconLink href={member.linkedin} label="LinkedIn profile">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </IconLink>
          <IconLink href={member.scholar} label="Google Scholar">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 24a7 7 0 110-14 7 7 0 010 14zm0-24L0 9.5l4.838 3.94A8 8 0 0112 11a8 8 0 017.162 2.44L24 9.5z" />
            </svg>
          </IconLink>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(member.id); }}
          className="text-xs px-2 py-0.5 transition-all duration-150"
          style={{
            border: '1px solid #363b47',
            background: 'transparent',
            color: '#8892a4',
            borderRadius: '3px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#4d6dff'
            e.currentTarget.style.color = '#7b9fff'
            e.currentTarget.style.background = 'rgba(77,109,255,0.1)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#363b47'
            e.currentTarget.style.color = '#8892a4'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {selected ? 'Added ✓' : 'Add +'}
        </button>
      </div>
    </div>
  )
}
