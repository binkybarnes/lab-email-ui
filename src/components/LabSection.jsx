import { motion } from 'motion/react'
import MemberCard from './MemberCard'

export default function LabSection({ lab, roleFilter, selectedMemberIds, onToggleMember, onEmail, anySelected }) {
  const members = roleFilter === 'all'
    ? lab.members
    : lab.members.filter(m => m.role === roleFilter)

  if (members.length === 0) return null

  return (
    <motion.section
      className="mb-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
    >
      <div className="flex items-baseline gap-2 mb-2">
        <h2
          className="text-lg font-semibold text-primary font-serif"
        >
          {lab.name}
        </h2>
        <span className="text-sm text-secondary">{members.length}</span>
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
    </motion.section>
  )
}
