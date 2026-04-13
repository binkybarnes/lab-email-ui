import { useEffect } from 'react'
import { buildGmailUrl } from '../utils/gmail'

const INPUT_STYLE = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  color: '#0f172a',
  outline: 'none',
  transition: 'border-color 0.15s',
  fontFamily: '"DM Sans", sans-serif',
  fontSize: 14,
  width: '100%',
  padding: '8px 12px',
}

export default function EmailModal({ modal, onClose, onUpdateDraft, onNavigate }) {
  const { open, members, currentIndex, drafts } = modal

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || members.length === 0) return null

  const member = members[currentIndex]
  const draft = drafts[member.id] ?? { subject: '', body: '' }
  const isMulti = members.length > 1

  function openInGmail() {
    window.open(buildGmailUrl({ to: member.email, subject: draft.subject, body: draft.body }), '_blank')
  }

  function sendAll() {
    members.forEach(m => {
      const d = drafts[m.id] ?? { subject: '', body: '' }
      window.open(buildGmailUrl({ to: m.email, subject: d.subject, body: d.body }), '_blank')
    })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
          maxHeight: '88vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {isMulti && (
              <>
                <button
                  onClick={() => onNavigate(-1)}
                  disabled={currentIndex === 0}
                  className="text-sm font-mono text-secondary hover:text-primary disabled:opacity-30 transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-xs font-mono text-muted">
                  {currentIndex + 1} / {members.length}
                </span>
                <button
                  onClick={() => onNavigate(1)}
                  disabled={currentIndex === members.length - 1}
                  className="text-sm font-mono text-secondary hover:text-primary disabled:opacity-30 transition-colors"
                >
                  Next →
                </button>
              </>
            )}
            <span className="text-sm font-medium text-primary">{member.name}</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-secondary transition-colors w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto flex-1">
          {/* To */}
          <div>
            <label className="text-xs font-mono text-muted block mb-1.5">To</label>
            <div
              className="px-3 py-2 rounded-lg text-sm font-mono text-secondary"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
            >
              {member.email}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-mono text-muted block mb-1.5">Subject</label>
            <input
              type="text"
              value={draft.subject}
              onChange={e => onUpdateDraft(member.id, 'subject', e.target.value)}
              placeholder="Subject line..."
              style={INPUT_STYLE}
              onFocus={e => e.target.style.borderColor = '#93c5fd'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {/* Body */}
          <div className="flex flex-col flex-1">
            <label className="text-xs font-mono text-muted block mb-1.5">Body</label>
            <textarea
              value={draft.body}
              onChange={e => onUpdateDraft(member.id, 'body', e.target.value)}
              placeholder="Write your email..."
              rows={10}
              style={{ ...INPUT_STYLE, resize: 'none', fontFamily: '"DM Mono", monospace', fontSize: 13 }}
              onFocus={e => e.target.style.borderColor = '#93c5fd'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid #f1f5f9' }}
        >
          <button
            disabled
            title="Coming soon"
            className="text-xs font-mono px-3 py-1.5 rounded-md text-muted cursor-not-allowed"
            style={{ border: '1px solid #e2e8f0', background: '#f8fafc', opacity: 0.5 }}
          >
            ✦ AI Writer
          </button>
          <div className="flex items-center gap-2">
            {isMulti && (
              <button
                onClick={sendAll}
                className="text-xs font-mono px-3 py-2 rounded-lg transition-colors text-secondary"
                style={{ border: '1px solid #e2e8f0' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Send All ({members.length})
              </button>
            )}
            <button
              onClick={openInGmail}
              className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150"
              style={{ background: '#1d4ed8', color: '#fff' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1e40af'}
              onMouseLeave={e => e.currentTarget.style.background = '#1d4ed8'}
            >
              Open in Gmail →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
