import { motion, AnimatePresence } from 'motion/react'

const ROLE_ACCENT = {
  PI: '#d97706',
  Postdoc: '#b45309',
  PhD: '#3b82f6',
  MS: '#2563eb',
  Undergrad: '#52586a',
}

const SPRING = { type: 'spring', stiffness: 500, damping: 34, mass: 0.8 }

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
      transition={SPRING}
      className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
      style={{
        background: '#1e2128',
        borderLeft: '1px solid #363b47',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.35)',
      }}
    >
      {/* Header */}
      <div
        className="relative flex items-center flex-shrink-0 h-14"
        style={{ borderBottom: '1px solid #363b47' }}
      >
        <motion.span
          animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : -8 }}
          transition={SPRING}
          className="font-medium text-primary text-xs tracking-wide truncate whitespace-nowrap px-4"
          style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
        >
          Selected ({selectedMembers.length})
        </motion.span>
        <motion.div
          className="absolute top-0 h-14 flex items-center"
          animate={{ right: 0, width: 64 }}
          transition={SPRING}
          style={{ justifyContent: 'center' }}
        >
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-10 h-10 flex items-center justify-center hover:bg-[#272b34] text-primary transition-colors flex-shrink-0"
            style={{ borderRadius: '3px' }}
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            <motion.svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ rotate: isOpen ? 0 : 180 }}
              transition={SPRING}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </motion.svg>
          </button>
        </motion.div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-1">
        {Object.entries(grouped).map(([labName, membersInLab]) => (
          <div key={labName}>
            <motion.div
              animate={{ opacity: isOpen ? 1 : 0 }}
              transition={SPRING}
              className="text-[13px] text-primary uppercase tracking-widest px-2 py-1.5 truncate whitespace-nowrap"
            >
              {labName}
            </motion.div>

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
                  className="flex items-stretch gap-2.5 pl-2 group transition-colors"
                  style={{ borderRadius: '3px', borderLeft: `2px solid ${ROLE_ACCENT[member.role] || ROLE_ACCENT.Undergrad}` }}
                  onMouseEnter={e => e.currentTarget.style.background = '#272b34'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => !isOpen && setIsOpen(true)}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 flex items-center justify-center text-xs font-medium flex-shrink-0 self-center my-1.5"
                    style={{ background: '#272b34', color: (ROLE_ACCENT[member.role] || '#7b9fff'), borderRadius: '3px' }}
                  >
                    {member.photo
                      ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" style={{ borderRadius: '3px' }} />
                      : member.name.charAt(0)
                    }
                  </div>

                  <motion.div
                    animate={{ opacity: isOpen ? 1 : 0 }}
                    transition={SPRING}
                    className="flex items-stretch gap-2 flex-1 min-w-0"
                    style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
                  >
                    <div
                      className="flex-1 min-w-0 cursor-pointer flex flex-col justify-center py-1.5"
                      onClick={e => { e.stopPropagation(); onEmail([member]) }}
                    >
                      <div className="text-xs font-medium text-primary truncate hover:text-[#7b9fff] transition-colors whitespace-nowrap">
                        {member.name}
                      </div>
                      <div className="text-[11px] text-muted truncate whitespace-nowrap">{member.email}</div>
                    </div>

                    <button
                      onClick={e => { e.stopPropagation(); onRemove(member.id) }}
                      className="text-[15px] text-[#f87171] w-10 flex items-center justify-center transition-colors flex-shrink-0 hover:bg-red-500/10"
                      style={{ borderTopRightRadius: '3px', borderBottomRightRadius: '3px' }}
                    >
                      ✕
                    </button>
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Footer */}
      <motion.div
        animate={{ opacity: isOpen ? 1 : 0, height: isOpen ? 56 : 0 }}
        transition={SPRING}
        className="flex-shrink-0 overflow-hidden"
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
      >
        <div
          className="px-3 py-3"
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
        </div>
      </motion.div>
    </motion.aside>
  )
}
