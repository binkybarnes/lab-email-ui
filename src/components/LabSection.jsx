import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import MemberCard from './MemberCard'

export default function LabSection({ lab, roleFilter, selectedMemberIds, onToggleMember, onToggleLabMembers, onEmail, anySelected }) {
  const [isOpen, setIsOpen] = useState(true)

  const members = roleFilter === 'all'
    ? lab.members
    : lab.members.filter(m => m.role === roleFilter)

  if (members.length === 0) return null

  const memberIds = members.map(m => m.id)
  const allSelected = memberIds.length > 0 && memberIds.every(id => selectedMemberIds.has(id))
  const someSelected = memberIds.some(id => selectedMemberIds.has(id))

  const handleToggleAll = () => {
    onToggleLabMembers(memberIds)
  }

  return (
    <motion.section
      className="mb-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
    >
      <div className="flex items-center gap-2 mb-2 group cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={handleToggleAll}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded appearance-none cursor-pointer border-2 transition-colors flex-shrink-0"
          style={{
            borderColor: allSelected ? '#4d6dff' : someSelected ? '#637ae6' : '#52586a',
            backgroundColor: allSelected ? '#4d6dff' : someSelected ? 'rgba(77,109,255,0.2)' : 'transparent',
            display: 'grid',
            placeItems: 'center'
          }}
        />
        {/* Custom checkmark/minus overlay */}
        <div 
          className="absolute pointer-events-none flex items-center justify-center w-4 h-4"
          style={{ opacity: (allSelected || someSelected) ? 1 : 0 }}
        >
          {allSelected ? (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <div className="w-2 h-0.5 bg-[#7b9fff] rounded-full" />
          )}
        </div>
        
        <h2 className="text-md font-semibold text-primary font-serif flex-1">
          {lab.name}
          <span className="text-sm text-secondary ml-2 font-sans font-normal">{members.length}</span>
        </h2>
        
        <button
          className="p-1 hover:bg-[#272b34] text-primary transition-colors rounded flex-shrink-0"
          title={isOpen ? 'Collapse Lab' : 'Expand Lab'}
        >
          <motion.svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
