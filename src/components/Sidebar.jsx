import { useState } from 'react'

function ChevronIcon({ open }) {
  return (
    <svg
      className="w-3 h-3 transition-transform duration-200"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', color: '#94a3b8' }}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function DeptSection({ dept, visibleLabIds, onToggleLab }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors rounded-md"
      >
        <ChevronIcon open={open} />
        <span className="text-xs font-mono text-secondary uppercase tracking-widest">
          {dept.name}
        </span>
      </button>

      {open && (
        <ul className="mt-0.5">
          {dept.labs.map(lab => {
            const checked = visibleLabIds.has(lab.id)
            return (
              <li key={lab.id}>
                <label className="flex items-center gap-3 px-5 py-2 cursor-pointer hover:bg-gray-50 transition-colors rounded-md group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleLab(lab.id)}
                    className="w-3.5 h-3.5 cursor-pointer rounded flex-shrink-0"
                  />
                  <span className={`text-sm flex-1 leading-tight ${checked ? 'text-primary font-medium' : 'text-secondary'}`}>
                    {lab.name}
                  </span>
                  <span className="text-xs font-mono text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    {lab.members.length}
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
      className="fixed top-14 left-0 bottom-0 w-64 overflow-y-auto z-40 py-4 px-2"
      style={{
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
      }}
    >
      <div className="px-2 pb-3">
        <p className="text-xs text-muted font-mono">
          Check labs to filter · select members to email
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
