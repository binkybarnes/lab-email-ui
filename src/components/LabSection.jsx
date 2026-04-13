import MemberCard from './MemberCard'

export default function LabSection({ lab, roleFilter, selectedMemberIds, onToggleMember, onEmail, anySelected }) {
  const members = roleFilter === 'all'
    ? lab.members
    : lab.members.filter(m => m.role === roleFilter)

  if (members.length === 0) return null

  return (
    <section className="mb-6">
      <div className="flex items-baseline gap-2 mb-2">
        <h2
          className="text-sm font-medium text-secondary"
          style={{ fontFamily: '"IBM Plex Serif", Georgia, serif' }}
        >
          {lab.name}
        </h2>
        <span className="text-xs font-mono text-muted">{members.length}</span>
      </div>

      {/* Joined panel — no gap, shared border */}
      <div
        style={{
          border: '1px solid #363b47',
          borderRadius: '4px',
          overflow: 'hidden',
          background: '#1e2128',
        }}
      >
        {members.map((member, i) => (
          <MemberCard
            key={member.id}
            member={member}
            selected={selectedMemberIds.has(member.id)}
            onToggle={onToggleMember}
            onEmail={onEmail}
            anySelected={anySelected}
            isLast={i === members.length - 1}
          />
        ))}
      </div>
    </section>
  )
}
