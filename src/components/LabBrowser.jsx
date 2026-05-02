import { useState, useEffect, useRef } from 'react'
import LabSection from './LabSection'

const BATCH_SIZE = 8

function useProgressiveList(items) {
  const [count, setCount] = useState(BATCH_SIZE)
  const prevItems = useRef(items)

  useEffect(() => {
    if (prevItems.current !== items) {
      prevItems.current = items
      setCount(BATCH_SIZE)
    }
  }, [items])

  useEffect(() => {
    if (count >= items.length) return
    const id = requestAnimationFrame(() => setCount(c => c + BATCH_SIZE))
    return () => cancelAnimationFrame(id)
  }, [count, items.length])

  return items.slice(0, count)
}

const ROLES = ['PI', 'Postdoc', 'PhD', 'Masters', 'Staff', 'Undergrad']

const ROLE_CHIP_ACTIVE = {
  background: 'rgba(77,109,255,0.2)',
  color: '#7b9fff',
  border: '1px solid rgba(77,109,255,0.5)',
}
const ROLE_CHIP_IDLE = {
  background: 'transparent',
  color: '#8892a4',
  border: '1px solid #363b47',
}

export default function LabBrowser({
  data,
  visibleLabs,
  roleFilter,
  setRoleFilter,
  selectedMemberIds,
  onToggleMember,
  onToggleLabMembers,
  onEmail,
  onApplyRoleSelection,
  rightOffset,
  emailResults = {},
}) {
  const anySelected = selectedMemberIds.size > 0
  const batchedLabs = useProgressiveList(visibleLabs)

  const grouped = data.departments
    .map(dept => ({
      dept,
      labs: batchedLabs.filter(l => l.departmentId === dept.id),
    }))
    .filter(g => g.labs.length > 0)

  function handleChip(role) {
    setRoleFilter(role)
    onApplyRoleSelection(role)
  }

  return (
    <main
      className="ml-60 pt-12 min-h-screen relative z-10"
      style={{ marginRight: rightOffset, transition: 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      <div className="px-7 py-6">

        {/* Role filter chips */}
        <div className="flex items-center gap-1.5 mb-7 flex-wrap">
          <span className="text-xs text-muted mr-1">Role:</span>
          {['all', ...ROLES].map(role => {
            const active = roleFilter === role
            return (
              <button
                key={role}
                onClick={() => handleChip(role)}
                className="text-xs px-2.5 py-1 transition-all duration-150"
                style={{ ...(active ? ROLE_CHIP_ACTIVE : ROLE_CHIP_IDLE), borderRadius: '3px' }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = '#272b34'
                    e.currentTarget.style.borderColor = '#52586a'
                    e.currentTarget.style.color = '#e4e7ed'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = ROLE_CHIP_IDLE.background
                    e.currentTarget.style.borderColor = '#363b47'
                    e.currentTarget.style.color = '#8892a4'
                  }
                }}
              >
                {role === 'all' ? 'All roles' : role}
              </button>
            )
          })}
        </div>

        {/* Department groups */}
        {grouped.map(({ dept, labs }) => (
          <div key={dept.id} className="mb-10">
            <div
              className="text-lg font-semibold uppercase tracking-widest text-muted mb-4 pb-2 font-serif"
              style={{ borderBottom: '1px solid #2d3240' }}
            >
              {dept.name}
            </div>
            {labs.map(lab => (
              <LabSection
                key={lab.id}
                lab={lab}
                roleFilter={roleFilter}
                selectedMemberIds={selectedMemberIds}
                onToggleMember={onToggleMember}
                onToggleLabMembers={onToggleLabMembers}
                onEmail={onEmail}
                anySelected={anySelected}
                emailResults={emailResults}
              />
            ))}
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted text-sm">
              No labs selected — check labs in the sidebar to get started
            </p>
          </div>
        )}

        <div className="h-20" />
      </div>
    </main>
  )
}
