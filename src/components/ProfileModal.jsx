import { useState } from 'react'
import { motion } from 'motion/react'
import { getProfile, saveProfile } from '../utils/profile'

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

export default function ProfileModal({ open, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const saved = getProfile()
    return saved ?? { name: '', status: '', institution: '', experience: '', whyField: '', goal: '', standout: '' }
  })
  const [focusedKey, setFocusedKey] = useState(null)

  if (!open) return null

  function handleSave() {
    saveProfile(form)
    onSave(form)
    onClose()
  }

  const canSave = form.name.trim() && form.status.trim() && form.institution.trim() && form.experience.trim() && form.whyField.trim() && form.goal.trim()

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
        className="w-full max-w-lg flex flex-col overflow-hidden"
        style={{
          background: '#1e2128',
          border: '1px solid #363b47',
          borderRadius: '5px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          maxHeight: '90vh',
        }}
      >
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
                  value={form[key]}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  rows={rows}
                  style={{
                    ...INPUT_STYLE,
                    resize: 'vertical',
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
          <div className="flex justify-end gap-2">
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
      </motion.div>
    </div>
  )
}
