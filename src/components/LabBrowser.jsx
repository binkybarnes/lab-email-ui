import LabSection from './LabSection'

const ROLES = ['PI', 'Postdoc', 'PhD', 'MS', 'Undergrad']

const ROLE_CHIP_ACTIVE = {
  background: '#1d4ed8',
  color: '#ffffff',
  border: '1px solid #1d4ed8',
}
const ROLE_CHIP_IDLE = {
  background: '#ffffff',
  color: '#64748b',
  border: '1px solid #e2e8f0',
}

export default function LabBrowser({
  data,
  visibleLabs,
  roleFilter,
  setRoleFilter,
  selectedMemberIds,
  onToggleMember,
  onEmail,
  onApplyRoleSelection,
  rightOffset,
}) {
  const anySelected = selectedMemberIds.size > 0

  const grouped = data.departments
    .map(dept => ({
      dept,
      labs: visibleLabs.filter(l => l.departmentId === dept.id),
    }))
    .filter(g => g.labs.length > 0)

  function handleChip(role) {
    setRoleFilter(role)
    onApplyRoleSelection(role)
  }

  return (
    <main 
      className="ml-64 pt-14 min-h-screen relative z-10 transition-all duration-300"
      style={{ paddingRight: rightOffset }}
    >
      <div className="px-8 py-7">

        {/* Role filter chips */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          <span className="text-xs font-mono text-muted mr-1">Role:</span>
          {['all', ...ROLES].map(role => {
            const active = roleFilter === role
            return (
              <button
                key={role}
                onClick={() => handleChip(role)}
                className="text-xs font-mono px-3 py-1.5 rounded-full transition-all duration-150"
                style={active ? ROLE_CHIP_ACTIVE : ROLE_CHIP_IDLE}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = '#f8fafc'
                    e.currentTarget.style.borderColor = '#94a3b8'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = ROLE_CHIP_IDLE.background
                    e.currentTarget.style.borderColor = '#e2e8f0'
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
          <div key={dept.id} className="mb-14">
            <div
              className="text-xs font-mono uppercase tracking-widest text-muted mb-6 pb-3"
              style={{ borderBottom: '1px solid #f1f5f9' }}
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
                onEmail={onEmail}
                anySelected={anySelected}
              />
            ))}
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted text-sm font-mono">
              No labs selected — check labs in the sidebar to get started
            </p>
          </div>
        )}

        {/* Right padding for checkout sidebar */}
        <div className="h-10" />
      </div>
    </main>
  )
}
