import { useState } from 'react'

export default function CheckoutSidebar({ selectedMembers, onRemove, onEmail, onEmailAll, isOpen, setIsOpen }) {

  if (selectedMembers.length === 0) return null

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-white shadow-2xl transition-all duration-300 z-50 flex flex-col ${
        isOpen ? 'w-80' : 'w-16'
      }`}
      style={{ borderLeft: '1px solid #e2e8f0' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0 h-14">
        {isOpen && (
          <span className="font-semibold text-primary font-mono text-sm tracking-wide truncate pr-2">
            Selected ({selectedMembers.length})
          </span>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-muted transition-colors flex-shrink-0 mx-auto"
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
              <div className="sticky top-0 bg-white/95 backdrop-blur z-10 py-1.5 px-2 -mx-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{labName}</div>
              </div>
            )}
            {membersInLab.map(member => (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border border-gray-100 bg-white shadow-sm hover:shadow hover:border-gray-300 ${
                  !isOpen && 'justify-center cursor-pointer hover:bg-gray-50'
                }`}
                onClick={() => !isOpen && setIsOpen(true)}
              >
                {/* Avatar */}
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 overflow-hidden bg-indigo-50 text-indigo-700"
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
                    <div className="text-sm font-medium text-gray-800 truncate hover:text-indigo-600 transition-colors cursor-pointer">{member.name}</div>
                    <div className="text-xs text-gray-400 font-mono truncate">{member.email}</div>
                  </div>
                )}
                
                {isOpen && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0 ml-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(member.id); }}
                      className="text-[10px] uppercase tracking-wider font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
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
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <button
            onClick={() => onEmailAll(selectedMembers)}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-all duration-200 text-white shadow hover:shadow-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transform active:scale-[0.98]"
            style={{ background: '#4f46e5' }}
          >
            Send All ({selectedMembers.length})
          </button>
        </div>
      )}
    </div>
  )
}
