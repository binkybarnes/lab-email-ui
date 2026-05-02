import { useEffect, useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { sendEmail } from '../utils/gmailApi'
import { supabase } from '../lib/supabase'
import { getProfile } from '../utils/profile'
import { generateEmailStream } from '../utils/openrouter'
import useUsageStore from '../stores/useUsageStore'
import { AiActionButton, UsageIndicator, ExhaustedMessage } from './AiComponents'

const INPUT_STYLE = {
  background: '#22262e',
  border: '1px solid #363b47',
  borderRadius: 3,
  color: '#e4e7ed',
  outline: 'none',
  transition: 'border-color 0.15s',
  fontFamily: '"IBM Plex Sans", sans-serif',
  fontSize: 15,
  width: '100%',
  padding: '7px 10px',
}

const PLACEHOLDER_REGEX = /\[([^\]]+)\]/g

function renderHighlightedBody(text) {
  const parts = []
  let lastIndex = 0
  let match
  const regex = new RegExp(PLACEHOLDER_REGEX.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(`<span class="template-placeholder" data-placeholder="true" style="background:rgba(234,179,8,0.18);color:#facc15;border-radius:2px;padding:0 2px;cursor:pointer;border-bottom:1px dashed rgba(234,179,8,0.5);transition:background 0.15s">${match[0]}</span>`)
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.join('')
}

function getPlainText(el) {
  // Walk the DOM to extract text, converting <br> and block boundaries to newlines
  let text = ''
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'BR') {
        text += '\n'
      } else if (node.tagName === 'DIV' || node.tagName === 'P') {
        if (text.length > 0 && !text.endsWith('\n')) text += '\n'
        text += getPlainText(node)
        if (!text.endsWith('\n')) text += '\n'
      } else {
        text += getPlainText(node)
      }
    }
  }
  return text
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

function openGmailCompose({ to, subject, body }) {
  const params = new URLSearchParams({
    view: 'cm',
    to: to || '',
    su: subject || '',
    body: body || '',
  })
  window.open(`https://mail.google.com/mail/?${params}`, '_blank')
}

const OVERRIDE_KEY = 'member_email_overrides'

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}') } catch { return {} }
}

function saveOverride(memberId, email) {
  const overrides = loadOverrides()
  if (email) overrides[memberId] = email
  else delete overrides[memberId]
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides))
}

function buildDrafts(members) {
  const overrides = loadOverrides()
  return Object.fromEntries(members.map(m => [m.id, { subject: '', body: '', toOverride: overrides[m.id] ?? '' }]))
}

function DisclaimerPopup({ onAccept, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
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
              <strong className="text-primary font-medium">Outdated Information:</strong> Make sure to check if the person you're emailing is still at the lab.
            </li>
            <li>
              <strong className="text-primary font-medium">Follow Lab Instructions:</strong> Always check the lab's website first. If they have specific rules for applying or aren't taking students, follow those instructions instead.
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

function AiDrawer({ onGenerate, onNeedProfile, isAdmin }) {
  const remaining = useUsageStore(s => s.remaining)
  const setRemaining = useUsageStore(s => s.setRemaining)
  const setResetsAt = useUsageStore(s => s.setResetsAt)
  const [instructions, setInstructions] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  async function handleGenerate() {
    const profile = getProfile()
    if (!profile) {
      onNeedProfile()
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const result = await onGenerate({
        profile,
        options: { instructions: instructions.trim() || undefined },
      })
      if (result?.error) setError(result.error)
      if (result?.remaining !== undefined) setRemaining(result.remaining)
      if (result?.resetsAt) setResetsAt(result.resetsAt)
    } catch (e) {
      setError(e.message || 'Something went wrong')
    }
    setGenerating(false)
  }

  const exhausted = !isAdmin && remaining === 0

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      style={{ overflow: 'hidden', borderTop: '2px solid #4d6dff' }}
    >
      <div className="px-5 py-3 flex flex-col gap-3" style={{ background: 'rgba(77,109,255,0.04)' }}>
        {/* Drawer header row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: '#4d6dff' }}>✦ AI Write</span>
          <span className="text-xs" style={{ color: '#334155' }}>🔒 stays on your device</span>
        </div>

        {/* Instructions */}
        <div>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Extra instructions (optional) — e.g. mention my Python skills, I met them at a conference..."
            rows={2}
            maxLength={500}
            style={{
              ...INPUT_STYLE,
              fontSize: 12,
              resize: 'none',
              color: '#94a3b8',
            }}
            onFocus={e => e.target.style.borderColor = '#4d6dff'}
            onBlur={e => e.target.style.borderColor = '#363b47'}
          />
          {instructions.length > 400 && (
            <div className="text-right mt-0.5">
              <span className="text-[10px]" style={{ color: instructions.length >= 500 ? '#f87171' : '#64748b' }}>
                {instructions.length} / 500
              </span>
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between gap-3">
          <AiActionButton
            onClick={handleGenerate}
            disabled={exhausted}
            loading={generating}
            loadingText="Generating..."
          >
            ✦ Generate
          </AiActionButton>
          {exhausted ? (
            <ExhaustedMessage isAdmin={isAdmin} />
          ) : error ? (
            <span className="text-xs" style={{ color: '#f87171' }}>{error}</span>
          ) : (
            <UsageIndicator isAdmin={isAdmin} />
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function EmailModal({ modal, onClose, onNavigate, session, getAccessToken, emailResults, setEmailResults, onOpenProfile }) {
  const { open, members, currentIndex } = modal
  const [drafts, setDrafts] = useState({})
  const [sending, setSending] = useState(false)
  const results = emailResults
  const setResults = setEmailResults
  const bodyRef = useRef(null)
  const isInternalUpdate = useRef(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [showAiDrawer, setShowAiDrawer] = useState(false)
  const prevMembersRef = useRef(null)

  const canSendDirect = !!session

  useEffect(() => {
    if (!open) return
    if (prevMembersRef.current !== members) {
      prevMembersRef.current = members
      setDrafts(buildDrafts(members))
      setSending(false)
    }
  }, [open, members])

  function updateDraft(memberId, field, value) {
    if (field === 'toOverride') saveOverride(memberId, value)
    setDrafts(prev => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }))
  }

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && e.ctrlKey) requireDisclaimer()
      const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'
      if (!inInput && e.key === 'ArrowLeft') onNavigate(-1)
      if (!inInput && e.key === 'ArrowRight') onNavigate(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, drafts, currentIndex, members, results, sending])

  // Sync the contentEditable HTML when the draft body changes externally (e.g. navigation)
  const member = open && members.length > 0 ? members[currentIndex] : null
  const draft = member ? (drafts[member.id] ?? { subject: '', body: '', toOverride: '' }) : { subject: '', body: '', toOverride: '' }

  useEffect(() => {
    if (!bodyRef.current || !open || isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    const html = renderHighlightedBody(draft.body).replace(/\n/g, '<br>')
    bodyRef.current.innerHTML = html
  }, [member?.id, open]) // only re-render HTML on member change or modal open

  // Handle clicking on a placeholder to select it
  const handleBodyClick = useCallback((e) => {
    const placeholder = e.target.closest('[data-placeholder]')
    if (placeholder) {
      const range = document.createRange()
      range.selectNodeContents(placeholder)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [])

  // Handle edits in the contentEditable div
  const handleBodyInput = useCallback(() => {
    if (!bodyRef.current || !member) return
    const plainText = getPlainText(bodyRef.current).replace(/\n$/, '')
    isInternalUpdate.current = true
    updateDraft(member.id, 'body', plainText)

    // Re-render with highlights, preserving caret position
    const sel = window.getSelection()
    if (!sel.rangeCount) return

    // Save caret as a character offset
    const range = sel.getRangeAt(0)
    const preRange = document.createRange()
    preRange.selectNodeContents(bodyRef.current)
    preRange.setEnd(range.startContainer, range.startOffset)
    const caretOffset = preRange.toString().length

    // Re-render
    const html = renderHighlightedBody(plainText).replace(/\n/g, '<br>')
    bodyRef.current.innerHTML = html

    // Restore caret
    restoreCaretPosition(bodyRef.current, caretOffset)
  }, [member])

  if (!open || members.length === 0) return null

  const isMulti = members.length > 1
  const currentResult = results[member.id]

  function requireDisclaimer() {
    const accepted = localStorage.getItem('disclaimer_accepted')
    if (accepted) {
      executeSend()
    } else {
      setShowDisclaimer(true)
    }
  }

  function handleDisclaimerAccept() {
    localStorage.setItem('disclaimer_accepted', 'true')
    setShowDisclaimer(false)
    executeSend()
  }

  function executeSend() {
    if (canSendDirect) {
      doApiSend()
    } else {
      doComposeSend()
    }
  }

  async function doApiSend() {
    setSending(true)
    try {
      const token = await getAccessToken()
      const result = await dispatchEmail({ member, draft, accessToken: token, senderEmail: session.user.email })
      setResults(prev => ({ ...prev, [member.id]: result }))
    } catch (e) {
      setResults(prev => ({ ...prev, [member.id]: { ok: false, error: e.message } }))
    }
    setSending(false)
    autoAdvance()
  }

  function doComposeSend() {
    const to = member.email || draft.toOverride
    openGmailCompose({ to, subject: draft.subject, body: draft.body })
    setResults(prev => ({ ...prev, [member.id]: { ok: true, composed: true } }))
    autoAdvance()
  }

  function autoAdvance() {
    if (!isMulti) return
    for (let i = currentIndex + 1; i < members.length; i++) {
      if (!results[members[i].id]?.ok) {
        onNavigate(i - currentIndex)
        return
      }
    }
    for (let i = 0; i < currentIndex; i++) {
      if (!results[members[i].id]?.ok) {
        onNavigate(i - currentIndex)
        return
      }
    }
  }

  function handleAiWrite() {
    const profile = getProfile()
    if (!profile) {
      onOpenProfile()
      return
    }
    setShowAiDrawer(prev => !prev)
  }

  async function handleGenerate({ profile, options }) {
    try {
      const result = await generateEmailStream({
        lab: { name: member.labName ?? '', overview: member.labOverview ?? '' },
        member: { name: member.name, role: member.role ?? '' },
        profile,
        options,
        onSubject: (partial) => updateDraft(member.id, 'subject', partial),
        onBody: (partial) => updateDraft(member.id, 'body', partial),
      })
      return { remaining: result.remaining, resetsAt: result.resetsAt }
    } catch (e) {
      return { error: e.message || 'Generation failed' }
    }
  }

  const sentCount = Object.values(results).filter(r => r.ok).length

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full flex flex-col overflow-hidden"
        style={{
          background: '#1e2128',
          border: '1px solid #363b47',
          borderRadius: '5px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          maxHeight: '90vh',
          maxWidth: '800px',
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
                {currentResult.ok
                  ? currentResult.composed ? 'opened' : 'sent'
                  : 'failed'}
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
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs text-muted">To</label>
              {!member.email && !!loadOverrides()[member.id] && (
                <span
                  className="text-[10px] px-1 py-px leading-tight"
                  style={{ background: 'rgba(234,179,8,0.12)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.25)', borderRadius: '2px' }}
                  title="Email entered manually by you — not from scraped data"
                >
                  user-entered
                </span>
              )}
            </div>
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
                style={{ ...INPUT_STYLE, borderColor: draft.toOverride ? '#363b47' : '#f87171' }}
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

          {/* Body – contentEditable with highlighted placeholders */}
          <div className="flex flex-col flex-1">

            <label className="text-xs text-muted block mb-1">
              Body
              <span className="ml-2 text-[10px]" style={{ color: '#eab308', opacity: 0.7 }}>
                click highlighted fields to edit
              </span>
            </label>
            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              onClick={handleBodyClick}
              onInput={handleBodyInput}
              className="flex-1"
              style={{
                ...INPUT_STYLE,
                fontSize: 12,
                minHeight: 220,
                maxHeight: 400,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                lineHeight: 1.6,
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#4d6dff'}
              onBlur={e => e.currentTarget.style.borderColor = '#363b47'}
            />
          </div>
        </div>

        {/* AI Drawer */}
        <AnimatePresence>
          {showAiDrawer && (
            <AiDrawer
              onGenerate={handleGenerate}
              onNeedProfile={onOpenProfile}
              isAdmin={canSendDirect}
            />
          )}
        </AnimatePresence>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid #363b47' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={handleAiWrite}
              className="text-xs px-3 py-1 transition-all"
              style={{
                border: `1px solid ${showAiDrawer ? '#4d6dff' : '#363b47'}`,
                background: showAiDrawer ? 'rgba(77,109,255,0.1)' : 'transparent',
                color: showAiDrawer ? '#7b9fff' : '#64748b',
                borderRadius: '3px',
              }}
              onMouseEnter={e => { if (!showAiDrawer) { e.currentTarget.style.borderColor = '#4d6dff'; e.currentTarget.style.color = '#7b9fff' } }}
              onMouseLeave={e => { if (!showAiDrawer) { e.currentTarget.style.borderColor = '#363b47'; e.currentTarget.style.color = '#64748b' } }}
            >
              ✦ AI Write
            </button>
            {isMulti && sentCount > 0 && (
              <span className="text-xs" style={{ color: '#4ade80' }}>
                {sentCount}/{members.length} {canSendDirect ? 'sent' : 'opened'}
              </span>
            )}
          </div>

          <button
            onClick={() => requireDisclaimer()}
            disabled={sending}
            className="text-xs px-4 py-1.5 transition-all duration-150 disabled:opacity-50 flex items-center gap-2"
            style={{ background: '#4d6dff', color: '#fff', borderRadius: '3px' }}
            onMouseEnter={e => !sending && (e.currentTarget.style.background = '#3d5df0')}
            onMouseLeave={e => e.currentTarget.style.background = '#4d6dff'}
            title="Ctrl+Enter"
          >
            {sending ? 'sending...' : currentResult?.ok ? (canSendDirect ? 'Resend' : 'Open again') : canSendDirect ? 'Send' : 'Open in Gmail'}
            {!sending && (
              <span style={{ opacity: 0.55, fontSize: 10 }}>ctrl + enter</span>
            )}
          </button>
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

/** Restore caret to a given character offset inside a contentEditable element */
function restoreCaretPosition(el, targetOffset) {
  const sel = window.getSelection()
  const range = document.createRange()
  let currentOffset = 0
  let found = false

  function walk(node) {
    if (found) return
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length
      if (currentOffset + len >= targetOffset) {
        range.setStart(node, targetOffset - currentOffset)
        range.collapse(true)
        found = true
        return
      }
      currentOffset += len
    } else {
      for (const child of node.childNodes) {
        walk(child)
        if (found) return
      }
    }
  }

  walk(el)
  if (found) {
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    // If offset exceeds content, place at end
    range.selectNodeContents(el)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }
}

