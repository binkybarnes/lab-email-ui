import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { getProfile, saveProfile } from '../utils/profile'
import { reviewProfile } from '../utils/openrouter'

const REVIEW_KEY = 'profile_review'

function loadReview() {
  try { return JSON.parse(localStorage.getItem(REVIEW_KEY)) } catch { return null }
}

function saveReview(suggestions) {
  localStorage.setItem(REVIEW_KEY, JSON.stringify(suggestions))
}

const INPUT_STYLE = {
  background: '#22262e',
  border: '1px solid #363b47',
  borderRadius: 3,
  color: '#e4e7ed',
  outline: 'none',
  fontFamily: '"IBM Plex Sans", sans-serif',
  fontSize: 13,
  width: '100%',
  padding: '7px 10px',
}

const FIELDS = [
  { key: 'name', label: 'Your full name', placeholder: 'e.g. Alex Kim', type: 'input' },
  { key: 'status', label: 'Academic status', placeholder: 'e.g. 3rd year undergrad, incoming PhD student, postdoc', type: 'input' },
  { key: 'institution', label: 'Institution / department', placeholder: 'e.g. UC San Diego, Biochemistry', type: 'input' },
  { key: 'experience', label: 'Research experience', placeholder: 'What have you actually worked on? Mention techniques, tools, projects. e.g. "Spent a quarter doing calcium imaging analysis in Python"', type: 'textarea', rows: 3 },
  { key: 'whyField', label: 'What got you into this field?', placeholder: '1-2 sentences — a class, paper, or experience that sparked your interest', type: 'textarea', rows: 2 },
  { key: 'goal', label: "What you're looking for", placeholder: 'e.g. rotation, PhD position, undergrad research position, postdoc', type: 'input' },
  { key: 'standout', label: 'Something that makes you stand out (optional)', placeholder: 'A specific skill, result, or project. e.g. "Built a pipeline to automate microscopy image segmentation"', type: 'textarea', rows: 2 },
]

const FIELD_LABELS = {
  experience: 'Research experience',
  whyField: 'What got you into this field',
  standout: 'Standout detail',
  status: 'Academic status',
  institution: 'Institution',
  goal: 'Goal',
}

function autoResize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

export default function ProfileModal({ open, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const saved = getProfile()
    return saved ?? { name: '', status: '', institution: '', experience: '', whyField: '', goal: '', standout: '' }
  })
  const [focusedKey, setFocusedKey] = useState(null)
  const [reviewing, setReviewing] = useState(false)
  const [suggestions, setSuggestions] = useState(() => loadReview())
  const [reviewError, setReviewError] = useState(null)

  if (!open) return null

  function handleSave() {
    saveProfile(form)
    onSave(form)
    onClose()
  }

  const canSave = form.name.trim() && form.status.trim() && form.institution.trim() && form.experience.trim() && form.whyField.trim() && form.goal.trim()

  async function handleReview() {
    setReviewing(true)
    setReviewError(null)
    setSuggestions(null)
    try {
      const result = await reviewProfile({ profile: form })
      const s = result.suggestions || []
      setSuggestions(s)
      saveReview(s)
    } catch (e) {
      setReviewError(e.message || 'Review failed')
    }
    setReviewing(false)
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full flex overflow-hidden"
        style={{
          maxWidth: suggestions && suggestions.length > 0 ? '900px' : '540px',
          transition: 'max-width 0.3s ease',
          background: '#1e2128',
          border: '1px solid #363b47',
          borderRadius: '5px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          maxHeight: '90vh',
        }}
      >
        {/* Left: form */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #363b47' }}>
            <div>
              <span className="text-sm font-medium text-primary">Your Profile</span>
              <p className="text-xs text-muted mt-0.5">Used by the AI to personalize emails. Saved once, editable anytime.</p>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-secondary transition-colors w-6 h-6 flex items-center justify-center text-xs flex-shrink-0"
              style={{ borderRadius: '3px', border: '1px solid #363b47' }}
              onMouseEnter={e => e.currentTarget.style.background = '#272b34'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              ✕
            </button>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto flex-1">
            {FIELDS.map(({ key, label, placeholder, type, rows }) => (
              <div key={key}>
                <label className="text-xs text-muted block mb-1">{label}</label>
                {type === 'textarea' ? (
                  <textarea
                    ref={el => el && autoResize(el)}
                    value={form[key]}
                    onChange={e => {
                      setForm(prev => ({ ...prev, [key]: e.target.value }))
                      autoResize(e.target)
                    }}
                    placeholder={placeholder}
                    style={{
                      ...INPUT_STYLE,
                      resize: 'none',
                      overflow: 'hidden',
                      minHeight: `${rows * 22 + 14}px`,
                      borderColor: focusedKey === key ? '#4d6dff' : '#363b47',
                    }}
                    onFocus={() => setFocusedKey(key)}
                    onBlur={() => setFocusedKey(null)}
                  />
                ) : (
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{
                      ...INPUT_STYLE,
                      borderColor: focusedKey === key ? '#4d6dff' : '#363b47',
                    }}
                    onFocus={() => setFocusedKey(key)}
                    onBlur={() => setFocusedKey(null)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-3" style={{ borderTop: '1px solid #363b47' }}>
            <p className="text-xs mb-3" style={{ color: '#475569' }}>
              🔒 Your profile is saved only on this device. We never store or transmit your personal information.
            </p>
            <div className="flex justify-between items-center">
              <button
                onClick={handleReview}
                disabled={reviewing || !canSave}
                className="text-xs px-3 py-1.5 transition-all disabled:opacity-40 flex items-center gap-1.5"
                style={{ background: 'transparent', border: '1px solid #363b47', borderRadius: '3px', color: '#94a3b8' }}
                onMouseEnter={e => !reviewing && canSave && (e.currentTarget.style.background = '#272b34')}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {reviewing ? (
                  <>
                    <span
                      className="animate-spin"
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        border: '1.5px solid rgba(148,163,184,0.3)',
                        borderTopColor: '#94a3b8',
                        borderRadius: '50%',
                      }}
                    />
                    Checking...
                  </>
                ) : (
                  '✦ Check profile'
                )}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="text-xs px-3 py-1.5 text-muted transition-colors"
                  style={{ border: '1px solid #363b47', borderRadius: '3px', background: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#272b34'; e.currentTarget.style.color = '#e4e7ed' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="text-xs px-4 py-1.5 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#4d6dff', borderRadius: '3px' }}
                  onMouseEnter={e => canSave && (e.currentTarget.style.background = '#3d5df0')}
                  onMouseLeave={e => e.currentTarget.style.background = '#4d6dff'}
                >
                  Save profile
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: AI feedback panel */}
        {suggestions && suggestions.length > 0 && (
          <div
            className="flex flex-col gap-3 px-5 py-4 overflow-y-auto"
            style={{
              width: '320px',
              flexShrink: 0,
              borderLeft: '1px solid #363b47',
              background: 'rgba(234,179,8,0.03)',
            }}
          >
            <span className="text-xs font-medium" style={{ color: '#ca8a04' }}>Profile feedback</span>
            {suggestions.map((s, i) => (
              <div key={i} className="text-sm" style={{ color: '#94a3b8' }}>
                <span className="text-xs font-medium block mb-0.5" style={{ color: '#e4e7ed' }}>{FIELD_LABELS[s.field] || s.field}</span>
                {s.suggestion}
              </div>
            ))}
          </div>
        )}
        {suggestions && suggestions.length === 0 && (
          <div
            className="flex items-center px-5"
            style={{
              width: '240px',
              flexShrink: 0,
              borderLeft: '1px solid #363b47',
              background: 'rgba(74,222,128,0.03)',
            }}
          >
            <span className="text-sm" style={{ color: '#4ade80' }}>
              Profile looks good — you're ready to generate emails.
            </span>
          </div>
        )}
        {reviewError && !suggestions && (
          <div
            className="flex items-center px-5"
            style={{
              width: '240px',
              flexShrink: 0,
              borderLeft: '1px solid #363b47',
            }}
          >
            <span className="text-xs" style={{ color: '#f87171' }}>{reviewError}</span>
          </div>
        )}
      </motion.div>
    </div>
  )
}
