import { useState } from 'react'

function ChevronIcon({ open }) {
  return (
    <svg
      className="w-3 h-3 transition-transform duration-200"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', color: '#5c6478' }}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function DeptSection({ dept, visibleLabIds, onToggleLab }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 w-full text-left px-3 py-2 transition-colors"
        style={{ borderRadius: '3px' }}
        onMouseEnter={e => e.currentTarget.style.background = '#272b34'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <ChevronIcon open={open} />
        <span className="text-xs font-mono text-muted uppercase tracking-widest">
          {dept.name}
        </span>
      </button>

      {open && (
        <ul className="mt-0.5">
          {dept.labs.map(lab => {
            const checked = visibleLabIds.has(lab.id)
            return (
              <li key={lab.id}>
                <label
                  className="flex items-center gap-3 px-4 py-1.5 cursor-pointer transition-colors group"
                  style={{ borderRadius: '3px' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#272b34'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleLab(lab.id)}
                    className="w-3.5 h-3.5 cursor-pointer flex-shrink-0"
                    style={{ borderRadius: '2px' }}
                  />
                  <span className={`text-xs flex-1 leading-tight font-mono ${checked ? 'text-primary' : 'text-secondary'}`}>
                    {lab.name}
                  </span>
                  <span className="text-xs font-mono text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    {lab.members?.length ?? 0}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function Sidebar({ data, visibleLabIds, onToggleLab }) {
  return (
    <aside
      className="fixed top-12 left-0 bottom-0 w-60 overflow-y-auto z-40 py-3 px-2"
      style={{
        background: '#1e2128',
        borderRight: '1px solid #363b47',
      }}
    >
      <div className="px-2 pb-3">
        <p className="text-xs text-muted font-mono leading-relaxed">
          Check labs to show · select members to email
        </p>
      </div>
      {data.departments.map(dept => (
        <DeptSection
          key={dept.id}
          dept={dept}
          visibleLabIds={visibleLabIds}
          onToggleLab={onToggleLab}
        />
      ))}
    </aside>
  )
}
