import { useEffect, useState, useRef, useCallback } from 'react'
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
  const bodyRef = useRef(null)
  const isInternalUpdate = useRef(false)

  useEffect(() => {
    if (!open) return
    return () => {
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

  // Sync the contentEditable HTML when the draft body changes externally (e.g. navigation)
  const member = open && members.length > 0 ? members[currentIndex] : null
  const draft = member ? (drafts[member.id] ?? { subject: '', body: '' }) : { subject: '', body: '' }

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
    onUpdateDraft(member.id, 'body', plainText)

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
  }, [member, onUpdateDraft])

  if (!open || members.length === 0) return null

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

