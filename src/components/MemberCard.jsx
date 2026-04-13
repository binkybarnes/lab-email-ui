const ROLE_CONFIG = {
  PI:       { bg: '#fef3c7', text: '#92400e', accent: '#d97706' },
  Postdoc:  { bg: '#fffbeb', text: '#b45309', accent: '#d97706' },
  PhD:      { bg: '#dbeafe', text: '#1e40af', accent: '#2563eb' },
  MS:       { bg: '#eff6ff', text: '#1d4ed8', accent: '#2563eb' },
  Undergrad:{ bg: '#f1f5f9', text: '#475569', accent: '#94a3b8' },
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
      className="text-muted hover:text-accent transition-colors duration-150"
    >
      {children}
    </a>
  )
}

export default function MemberCard({ member, selected, onToggle, onEmail, anySelected }) {
  const cfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.Undergrad

  return (
    <div
      onClick={() => onToggle(member.id)}
      className="relative flex flex-col gap-3 p-4 rounded-xl bg-white transition-all duration-200 group cursor-pointer"
      style={{
        border: selected ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
        borderLeft: `3px solid ${cfg.accent}`,
        boxShadow: selected
          ? '0 0 0 3px rgba(147,197,253,0.25), 0 1px 4px rgba(15,23,42,0.06)'
          : '0 1px 4px rgba(15,23,42,0.06)',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.10), 0 0 0 1px rgba(15,23,42,0.08)'
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.boxShadow = '0 1px 4px rgba(15,23,42,0.06)'
      }}
    >
      <div
        className={`absolute top-3 right-3 transition-opacity duration-150 ${
          anySelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(member.id)}
          className="w-4 h-4 cursor-pointer rounded"
          aria-label={`Select ${member.name}`}
        />
      </div>

      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono font-medium flex-shrink-0"
          style={{ background: cfg.bg, color: cfg.text }}
        >
          {member.photo
            ? <img src={member.photo} alt={member.name} className="w-full h-full rounded-full object-cover" />
            : getInitials(member.name)
          }
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <div className="text-sm font-medium text-primary leading-snug truncate">
            {member.name}
          </div>
          <div className="mt-1">
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: cfg.bg, color: cfg.text }}
            >
              {member.role}
            </span>
          </div>
        </div>
      </div>

      <div className="text-xs font-mono text-muted truncate">{member.email}</div>

      <div className="flex items-center justify-between pt-1 mt-auto">
        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          <IconLink href={member.linkedin} label="LinkedIn profile">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </IconLink>
          <IconLink href={member.scholar} label="Google Scholar">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 24a7 7 0 110-14 7 7 0 010 14zm0-24L0 9.5l4.838 3.94A8 8 0 0112 11a8 8 0 017.162 2.44L24 9.5z"/>
            </svg>
          </IconLink>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(member.id); }}
          className={`text-xs font-mono px-2.5 py-1 rounded-md transition-all duration-150 ${
            selected 
              ? 'text-green-700 bg-green-50 border-green-200' 
              : 'text-accent bg-transparent'
          }`}
          style={{ border: '1px solid', borderColor: selected ? '#bbf7d0' : '#bfdbfe' }}
          onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#dbeafe' }}
          onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
        >
          {selected ? 'Added ✓' : 'Add +'}
        </button>
      </div>
    </div>
  )
}
