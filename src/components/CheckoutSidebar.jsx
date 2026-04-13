import { useState } from 'react'

export default function CheckoutSidebar({ selectedMembers, onRemove, onEmail, onEmailAll, isOpen, setIsOpen }) {

  if (selectedMembers.length === 0) return null

  return (
    <div
      className={`fixed top-0 right-0 h-full shadow-2xl transition-all duration-300 z-50 flex flex-col ${
        isOpen ? 'w-80' : 'w-16'
      }`}
      style={{ 
        background: '#1e2128', 
        borderLeft: '1px solid #363b47',
        color: '#e4e7ed'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#363b47] flex-shrink-0 h-14">
        {isOpen && (
          <span className="font-semibold text-primary font-mono text-sm tracking-wide truncate pr-2">
            Selected ({selectedMembers.length})
          </span>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-lg hover:bg-[#272b34] text-muted transition-colors flex-shrink-0 mx-auto"
          title={isOpen ? "Collapse menu" : "Expand menu"}
          aria-label="Toggle sidebar"
        >
          {isOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 gap-3 flex flex-col">
        {Object.entries(
          selectedMembers.reduce((acc, member) => {
            if (!acc[member.labName]) acc[member.labName] = [];
            acc[member.labName].push(member);
            return acc;
          }, {})
        ).map(([labName, membersInLab]) => (
          <div key={labName} className="flex flex-col gap-2 relative">
            {isOpen && (
              <div className="sticky top-0 bg-[#1e2128]/95 backdrop-blur z-10 py-1.5 px-2 -mx-2">
                <div className="text-[10px] font-bold text-[#8892a4] uppercase tracking-widest">{labName}</div>
              </div>
            )}
            {membersInLab.map(member => (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border border-[#363b47] bg-[#1e2128] shadow-sm hover:shadow hover:border-[#52586a] ${
                  !isOpen && 'justify-center cursor-pointer hover:bg-[#272b34]'
                }`}
                onClick={() => !isOpen && setIsOpen(true)}
              >
                {/* Avatar */}
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 overflow-hidden bg-[#272b34] text-[#7b9fff]"
                >
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    member.name.charAt(0)
                  )}
                </div>
                
                {isOpen && (
                  <div className="flex-1 min-w-0" onClick={(e) => {
                      e.stopPropagation()
                      onEmail([member])
                    }}>
                    <div className="text-sm font-medium text-[#e4e7ed] truncate hover:text-[#7b9fff] transition-colors cursor-pointer">{member.name}</div>
                    <div className="text-xs text-[#8892a4] font-mono truncate">{member.email}</div>
                  </div>
                )}
                
                {isOpen && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0 ml-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(member.id); }}
                      className="text-[10px] uppercase tracking-wider font-semibold text-[#f87171] hover:text-[#ef4444] hover:bg-[#ef4444]/10 px-2 py-1 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      {isOpen && (
        <div className="p-4 border-t border-[#363b47] bg-[#1e2128] flex-shrink-0">
          <button
            onClick={() => onEmailAll(selectedMembers)}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-all duration-200 text-white shadow hover:shadow-lg focus:ring-2 focus:ring-[#4d6dff] focus:ring-offset-1 transform active:scale-[0.98]"
            style={{ background: '#4d6dff' }}
          >
            Send All ({selectedMembers.length})
          </button>
        </div>
      )}
    </div>
  )
}
