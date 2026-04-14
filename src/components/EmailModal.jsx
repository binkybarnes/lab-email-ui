import { useEffect, useState } from 'react'
import { sendEmail } from '../utils/gmailApi'
import { supabase } from '../lib/supabase'

const INPUT_STYLE = {
  background: '#22262e',
  border: '1px solid #363b47',
  borderRadius: 3,
  color: '#e4e7ed',
  outline: 'none',
  transition: 'border-color 0.15s',
  fontFamily: '"IBM Plex Sans", sans-serif',
  fontSize: 13,
  width: '100%',
  padding: '7px 10px',
}

async function dispatchEmail({ member, draft, accessToken, senderEmail }) {
  const result = await sendEmail({
    to: member.email,
    subject: draft.subject,
    body: draft.body,
    accessToken,
  })

  const { error: logError } = await supabase.from('email_logs').insert({
    sender_email: senderEmail,
    recipient_email: member.email,
    recipient_name: member.name,
    subject: draft.subject,
    body: draft.body,
    status: result.ok ? 'sent' : 'failed',
    error: result.ok ? null : result.error,
  })
  if (logError) console.error('[email_logs] insert failed:', logError.message)

  return result
}

export default function EmailModal({ modal, onClose, onUpdateDraft, onNavigate, accessToken, senderEmail }) {
  const { open, members, currentIndex, drafts } = modal
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState({}) // memberId -> { ok, error }

  useEffect(() => {
    if (!open) {
      setResults({})
      setSending(false)
    }
  }, [open])

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
  const currentResult = results[member.id]

  async function handleSend() {
    setSending(true)
    const result = await dispatchEmail({ member, draft, accessToken, senderEmail })
    setResults(prev => ({ ...prev, [member.id]: result }))
    setSending(false)
  }

  async function handleSendAll() {
    setSending(true)
    for (const m of members) {
      if (results[m.id]?.ok) continue
      const d = drafts[m.id] ?? { subject: '', body: '' }
      const result = await dispatchEmail({ member: m, draft: d, accessToken, senderEmail })
      setResults(prev => ({ ...prev, [m.id]: result }))
    }
    setSending(false)
  }

  const sentCount = Object.values(results).filter(r => r.ok).length
  const failedCount = Object.values(results).filter(r => !r.ok).length

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
                  className="text-xs text-secondary hover:text-primary disabled:opacity-30 transition-colors"
                >
                  ← prev
                </button>
                <span className="text-xs text-muted">
                  {currentIndex + 1} / {members.length}
                </span>
                <button
                  onClick={() => onNavigate(1)}
                  disabled={currentIndex === members.length - 1}
                  className="text-xs text-secondary hover:text-primary disabled:opacity-30 transition-colors"
                >
                  next →
                </button>
              </>
            )}
            <span className="text-xs font-medium text-primary">{member.name}</span>
            {currentResult && (
              <span
                className="text-xs px-1.5 py-0.5"
                style={{
                  borderRadius: '3px',
                  background: currentResult.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: currentResult.ok ? '#4ade80' : '#f87171',
                }}
              >
                {currentResult.ok ? 'sent' : 'failed'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-secondary transition-colors w-6 h-6 flex items-center justify-center text-xs"
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
            <label className="text-xs text-muted block mb-1">To</label>
            <div
              className="px-3 py-1.5 text-xs text-secondary"
              style={{ background: '#22262e', border: '1px solid #363b47', borderRadius: '3px' }}
            >
              {member.email}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs text-muted block mb-1">Subject</label>
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
            <label className="text-xs text-muted block mb-1">Body</label>
            <textarea
              value={draft.body}
              onChange={e => onUpdateDraft(member.id, 'body', e.target.value)}
              placeholder="Write your email..."
              rows={10}
              style={{ ...INPUT_STYLE, resize: 'none', fontSize: 12 }}
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
          <div className="flex items-center gap-3">
            <button
              disabled
              title="Coming soon"
              className="text-xs px-3 py-1 text-muted cursor-not-allowed opacity-40"
              style={{ border: '1px solid #363b47', background: 'transparent', borderRadius: '3px' }}
            >
              ✦ AI Writer
            </button>
            {isMulti && (sentCount > 0 || failedCount > 0) && (
              <span className="text-xs text-muted">
                {sentCount > 0 && <span style={{ color: '#4ade80' }}>{sentCount} sent</span>}
                {sentCount > 0 && failedCount > 0 && ' · '}
                {failedCount > 0 && <span style={{ color: '#f87171' }}>{failedCount} failed</span>}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isMulti && (
              <button
                onClick={handleSendAll}
                disabled={sending}
                className="text-xs px-3 py-1.5 transition-colors text-secondary disabled:opacity-50"
                style={{ border: '1px solid #363b47', background: 'transparent', borderRadius: '3px' }}
                onMouseEnter={e => !sending && (e.currentTarget.style.background = '#272b34')}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {sending ? 'sending...' : `send all (${members.length})`}
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={sending || currentResult?.ok}
              className="text-xs px-4 py-1.5 transition-all duration-150 disabled:opacity-50"
              style={{ background: '#4d6dff', color: '#fff', borderRadius: '3px' }}
              onMouseEnter={e => !sending && !currentResult?.ok && (e.currentTarget.style.background = '#3d5df0')}
              onMouseLeave={e => e.currentTarget.style.background = '#4d6dff'}
            >
              {sending ? 'sending...' : currentResult?.ok ? 'sent ✓' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
