import MemberCard from './MemberCard'

export default function LabSection({ lab, roleFilter, selectedMemberIds, onToggleMember, onEmail, anySelected }) {
  const members = roleFilter === 'all'
    ? lab.members
    : lab.members.filter(m => m.role === roleFilter)

  if (members.length === 0) return null

  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-4">
        <h2
          className="text-base font-semibold text-primary"
          style={{ fontFamily: '"Fraunces", Georgia, serif', fontVariationSettings: '"opsz" 18' }}
        >
          {lab.name}
        </h2>
        <span className="text-xs font-mono text-muted">{members.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {members.map(member => (
          <MemberCard
            key={member.id}
            member={member}
            selected={selectedMemberIds.has(member.id)}
            onToggle={onToggleMember}
            onEmail={onEmail}
            anySelected={anySelected}
          />
        ))}
      </div>
    </section>
  )
}
