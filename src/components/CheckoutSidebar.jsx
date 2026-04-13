import { motion, AnimatePresence } from 'motion/react'

const ROLE_ACCENT = {
  PI: '#d97706',
  Postdoc: '#b45309',
  PhD: '#3b82f6',
  MS: '#2563eb',
  Undergrad: '#52586a',
}

export default function CheckoutSidebar({ selectedMembers, onRemove, onEmail, onEmailAll, isOpen, setIsOpen }) {
  if (selectedMembers.length === 0) return null

  const grouped = selectedMembers.reduce((acc, member) => {
    if (!acc[member.labName]) acc[member.labName] = []
    acc[member.labName].push(member)
    return acc
  }, {})

  return (
    <motion.aside
      initial={{ x: '100%' }}
      animate={{ x: 0, width: isOpen ? 320 : 64 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 500, damping: 34, mass: 0.8}}
      className="fixed top-0 right-0 h-full z-50 flex flex-col"
      style={{
        background: '#1e2128',
        borderLeft: '1px solid #363b47',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.35)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 flex-shrink-0 h-14"
        style={{ borderBottom: '1px solid #363b47' }}
      >
        
        <AnimatePresence>
          {isOpen && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="font-medium text-primary text-xs tracking-wide truncate"
            >
              Selected ({selectedMembers.length})
            </motion.span>
          )}
        </AnimatePresence>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 hover:bg-[#272b34] text-primary transition-colors flex-shrink-0"
          style={{ borderRadius: '3px' }}
          title={isOpen ? 'Collapse' : 'Expand'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={isOpen ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-1">
        {Object.entries(grouped).map(([labName, membersInLab]) => (
          <div key={labName}>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] text-muted uppercase tracking-widest px-2 py-1.5 truncate"
                >
                  {labName}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {membersInLab.map((member, i) => (
                <motion.div
                  key={member.id}
                  layout
                  initial={{ opacity: 0, x: 40, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.95 }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                    delay: i * 0.04,
                  }}
                  className="flex items-center gap-2.5 px-2 py-1.5 group transition-colors"
                  style={{ borderRadius: '3px', borderLeft: `2px solid ${ROLE_ACCENT[member.role] || ROLE_ACCENT.Undergrad}` }}
                  onMouseEnter={e => e.currentTarget.style.background = '#272b34'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => !isOpen && setIsOpen(true)}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 flex items-center justify-center text-xs font-medium flex-shrink-0"
                    style={{ background: '#272b34', color: (ROLE_ACCENT[member.role] || '#7b9fff'), borderRadius: '3px' }}
                  >
                    {member.photo
                      ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" style={{ borderRadius: '3px' }} />
                      : member.name.charAt(0)
                    }
                  </div>

                  {isOpen && (
                    <>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={e => { e.stopPropagation(); onEmail([member]) }}
                      >
                        <div className="text-xs font-medium text-primary truncate hover:text-[#7b9fff] transition-colors">
                          {member.name}
                        </div>
                        <div className="text-[11px] text-muted truncate">{member.email}</div>
                      </div>

                      <button
                        onClick={e => { e.stopPropagation(); onRemove(member.id) }}
                        className="text-[10px] text-muted hover:text-[#f87171] px-1.5 py-0.5 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                        style={{ borderRadius: '2px' }}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Footer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="p-3 flex-shrink-0"
            style={{ borderTop: '1px solid #363b47' }}
          >
            <button
              onClick={() => onEmailAll(selectedMembers)}
              className="w-full py-2 text-xs transition-all duration-150 truncate"
              style={{ background: '#4d6dff', color: '#fff', borderRadius: '3px' }}
              onMouseEnter={e => e.currentTarget.style.background = '#3d5df0'}
              onMouseLeave={e => e.currentTarget.style.background = '#4d6dff'}
            >
              Send All ({selectedMembers.length})
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
