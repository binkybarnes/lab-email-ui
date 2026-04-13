import { useEffect } from 'react'
import { buildGmailUrl } from '../utils/gmail'

const INPUT_STYLE = {
  background: '#22262e',
  border: '1px solid #363b47',
  borderRadius: 3,
  color: '#e4e7ed',
  outline: 'none',
  transition: 'border-color 0.15s',
  fontFamily: '"IBM Plex Serif", serif',
  fontSize: 13,
  width: '100%',
  padding: '7px 10px',
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
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl flex flex-col overflow-hidden"
        style={{
          background: '#1e2128',
          border: '1px solid #363b47',
          borderRadius: '5px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          maxHeight: '88vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid #363b47' }}
        >
          <div className="flex items-center gap-3">
            {isMulti && (
              <>
                <button
                  onClick={() => onNavigate(-1)}
                  disabled={currentIndex === 0}
                  className="text-xs font-mono text-secondary hover:text-primary disabled:opacity-30 transition-colors"
                >
                  ← prev
                </button>
                <span className="text-xs font-mono text-muted">
                  {currentIndex + 1} / {members.length}
                </span>
                <button
                  onClick={() => onNavigate(1)}
                  disabled={currentIndex === members.length - 1}
                  className="text-xs font-mono text-secondary hover:text-primary disabled:opacity-30 transition-colors"
                >
                  next →
                </button>
              </>
            )}
            <span className="text-xs font-medium text-primary font-mono">{member.name}</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-secondary transition-colors w-6 h-6 flex items-center justify-center text-xs font-mono"
            style={{ borderRadius: '3px', border: '1px solid #363b47' }}
            onMouseEnter={e => e.currentTarget.style.background = '#272b34'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto flex-1">
          {/* To */}
          <div>
            <label className="text-xs font-mono text-muted block mb-1">To</label>
            <div
              className="px-3 py-1.5 text-xs font-mono text-secondary"
              style={{ background: '#22262e', border: '1px solid #363b47', borderRadius: '3px' }}
            >
              {member.email}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-mono text-muted block mb-1">Subject</label>
            <input
              type="text"
              value={draft.subject}
              onChange={e => onUpdateDraft(member.id, 'subject', e.target.value)}
              placeholder="Subject line..."
              style={INPUT_STYLE}
              onFocus={e => e.target.style.borderColor = '#4d6dff'}
              onBlur={e => e.target.style.borderColor = '#363b47'}
            />
          </div>

          {/* Body */}
          <div className="flex flex-col flex-1">
            <label className="text-xs font-mono text-muted block mb-1">Body</label>
            <textarea
              value={draft.body}
              onChange={e => onUpdateDraft(member.id, 'body', e.target.value)}
              placeholder="Write your email..."
              rows={10}
              style={{ ...INPUT_STYLE, resize: 'none', fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }}
              onFocus={e => e.target.style.borderColor = '#4d6dff'}
              onBlur={e => e.target.style.borderColor = '#363b47'}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid #363b47' }}
        >
          <button
            disabled
            title="Coming soon"
            className="text-xs font-mono px-3 py-1 text-muted cursor-not-allowed opacity-40"
            style={{ border: '1px solid #363b47', background: 'transparent', borderRadius: '3px' }}
          >
            ✦ AI Writer
          </button>
          <div className="flex items-center gap-2">
            {isMulti && (
              <button
                onClick={sendAll}
                className="text-xs font-mono px-3 py-1.5 transition-colors text-secondary"
                style={{ border: '1px solid #363b47', background: 'transparent', borderRadius: '3px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#272b34'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                send all ({members.length})
              </button>
            )}
            <button
              onClick={openInGmail}
              className="text-xs font-mono px-4 py-1.5 transition-all duration-150"
              style={{ background: '#4d6dff', color: '#fff', borderRadius: '3px' }}
              onMouseEnter={e => e.currentTarget.style.background = '#3d5df0'}
              onMouseLeave={e => e.currentTarget.style.background = '#4d6dff'}
            >
              open in Gmail →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
