import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
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
  const to = member.email || draft.toOverride
  if (!to) return { ok: false, error: 'No email address provided' }

  const result = await sendEmail({
    to,
    subject: draft.subject,
    body: draft.body,
    accessToken,
  })

  const { error: logError } = await supabase.from('email_logs').insert({
    sender_email: senderEmail,
    recipient_email: to,
    recipient_name: member.name,
    subject: draft.subject,
    body: draft.body,
    status: result.ok ? 'sent' : 'failed',
    error: result.ok ? null : result.error,
  })
  if (logError) console.error('[email_logs] insert failed:', logError.message)

  return result
}

function buildDrafts(members) {
  return Object.fromEntries(members.map(m => [m.id, { subject: '', body: '', toOverride: '' }]))
}

function DisclaimerPopup({ onAccept, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="bg-[#1e2128] border border-[#363b47] rounded-lg shadow-2xl p-6 max-w-lg w-full"
      >
        <div className="flex items-center gap-3 mb-4 text-[#eab308]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-lg font-semibold text-primary tracking-wide">Usage Disclaimer</h2>
        </div>

        <div className="space-y-5 text-base text-muted leading-relaxed">
          <ul className="list-disc pl-5 space-y-4">
            <li>
              <strong className="text-primary font-medium">Follow Lab Instructions:</strong> Always check the lab's website or PI's page first. If they have specific rules for applying or aren't taking students, follow those instructions instead.
            </li>
            <li>
              <strong className="text-primary font-medium">Do Not Spam:</strong> Please don't mass-email everyone in a lab. Only contact individuals whose research specifically aligns with yours.
            </li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs text-muted hover:text-secondary transition-colors"
            style={{ border: '1px solid #363b47', borderRadius: '3px', background: 'transparent' }}
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            className="px-5 py-2.5 bg-[#4d6dff] hover:bg-[#3d5df0] text-white text-xs uppercase tracking-wider font-medium rounded transition-colors shadow-[0_0_15px_rgba(77,109,255,0.2)] focus:outline-none focus:ring-2 focus:ring-[#4d6dff] focus:ring-offset-2 focus:ring-offset-[#1e2128]"
          >
            I Understand and Agree
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function EmailModal({ modal, onClose, onNavigate, session, signIn, getAccessToken }) {
  const { open, members, currentIndex } = modal
  const [drafts, setDrafts] = useState({})
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState({}) // memberId -> { ok, error }
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [pendingSendAll, setPendingSendAll] = useState(false)
  const prevMembersRef = useRef(null)

  // Re-initialize drafts only when the member list changes (new modal open)
  useEffect(() => {
    if (!open) return
    if (prevMembersRef.current !== members) {
      prevMembersRef.current = members
      setDrafts(buildDrafts(members))
      setResults({})
      setSending(false)
    }
  }, [open, members])

  function updateDraft(memberId, field, value) {
    setDrafts(prev => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }))
  }

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

  function requireDisclaimerOrSignIn(sendAll) {
    // If not signed in, trigger Google sign-in first
    if (!session) {
      signIn()
      return
    }

    const accepted = localStorage.getItem('disclaimer_accepted')
    if (accepted) {
      sendAll ? doSendAll() : doSend()
    } else {
      setPendingSendAll(sendAll)
      setShowDisclaimer(true)
    }
  }

  function handleDisclaimerAccept() {
    localStorage.setItem('disclaimer_accepted', 'true')
    setShowDisclaimer(false)
    pendingSendAll ? doSendAll() : doSend()
  }

  async function doSend() {
    setSending(true)
    try {
      const token = await getAccessToken()
      const result = await dispatchEmail({ member, draft, accessToken: token, senderEmail: session.user.email })
      setResults(prev => ({ ...prev, [member.id]: result }))
    } catch (e) {
      setResults(prev => ({ ...prev, [member.id]: { ok: false, error: e.message } }))
    }
    setSending(false)
  }

  async function doSendAll() {
    setSending(true)
    try {
      const token = await getAccessToken()
      for (const m of members) {
        if (results[m.id]?.ok) continue
        const d = drafts[m.id] ?? { subject: '', body: '' }
        const result = await dispatchEmail({ member: m, draft: d, accessToken: token, senderEmail: session.user.email })
        setResults(prev => ({ ...prev, [m.id]: result }))
      }
    } catch (e) {
      setResults(prev => ({ ...prev, [member.id]: { ok: false, error: e.message } }))
    }
    setSending(false)
  }

  const sentCount = Object.values(results).filter(r => r.ok).length
  const failedCount = Object.values(results).filter(r => !r.ok).length

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
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
                {currentResult.ok ? 'sent ✓' : 'failed'}
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
          {/* Error banner */}
          {currentResult && !currentResult.ok && (
            <div
              className="text-xs px-3 py-2"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', color: '#f87171' }}
            >
              {/401|unauthorized|invalid.?cred/i.test(currentResult.error)
                ? 'Session expired — sign out and sign back in to refresh your Gmail access.'
                : currentResult.error}
            </div>
          )}
          {/* To */}
          <div>
            <label className="text-xs text-muted block mb-1">To</label>
            {member.email ? (
              <div
                className="px-3 py-1.5 text-xs text-secondary"
                style={{ background: '#22262e', border: '1px solid #363b47', borderRadius: '3px' }}
              >
                {member.email}
              </div>
            ) : (
              <input
                type="email"
                value={draft.toOverride ?? ''}
                onChange={e => updateDraft(member.id, 'toOverride', e.target.value)}
                placeholder={`Enter email for ${member.name}...`}
                style={{ ...INPUT_STYLE, borderColor: '#f87171' }}
                onFocus={e => e.target.style.borderColor = '#4d6dff'}
                onBlur={e => { if (!draft.toOverride) e.target.style.borderColor = '#f87171' }}
              />
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs text-muted block mb-1">Subject</label>
            <input
              type="text"
              value={draft.subject}
              onChange={e => updateDraft(member.id, 'subject', e.target.value)}
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
              onChange={e => updateDraft(member.id, 'body', e.target.value)}
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
                onClick={() => requireDisclaimerOrSignIn(true)}
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
              onClick={() => requireDisclaimerOrSignIn(false)}
              disabled={sending || currentResult?.ok}
              className="text-xs px-4 py-1.5 transition-all duration-150 disabled:opacity-50"
              style={{ background: '#4d6dff', color: '#fff', borderRadius: '3px' }}
              onMouseEnter={e => !sending && !currentResult?.ok && (e.currentTarget.style.background = '#3d5df0')}
              onMouseLeave={e => e.currentTarget.style.background = '#4d6dff'}
            >
              {!session ? 'Sign in to Send' : sending ? 'sending...' : currentResult?.ok ? 'sent ✓' : 'Send'}
            </button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {showDisclaimer && (
          <DisclaimerPopup
            onAccept={handleDisclaimerAccept}
            onCancel={() => setShowDisclaimer(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
