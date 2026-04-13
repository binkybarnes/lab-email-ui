import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EmailModal from '../../src/components/EmailModal'

const member = {
  id: 'sarah-chen',
  name: 'Dr. Sarah Chen',
  role: 'PI',
  email: 'schen@ucsd.edu',
  photo: null,
  linkedin: null,
  scholar: null,
}

const baseModal = {
  open: true,
  members: [member],
  currentIndex: 0,
  drafts: { 'sarah-chen': { subject: 'Hello', body: 'Hi there' } },
}

describe('EmailModal', () => {
  it('renders recipient name', () => {
    render(
      <EmailModal modal={baseModal} onClose={() => {}} onUpdateDraft={() => {}} onNavigate={() => {}} />
    )
    expect(screen.getByText(/Dr. Sarah Chen/)).toBeInTheDocument()
  })

  it('shows subject and body from draft', () => {
    render(
      <EmailModal modal={baseModal} onClose={() => {}} onUpdateDraft={() => {}} onNavigate={() => {}} />
    )
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hi there')).toBeInTheDocument()
  })

  it('calls onClose when Escape pressed', () => {
    const onClose = vi.fn()
    render(
      <EmailModal modal={baseModal} onClose={onClose} onUpdateDraft={() => {}} onNavigate={() => {}} />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when open is false', () => {
    render(
      <EmailModal modal={{ ...baseModal, open: false }} onClose={() => {}} onUpdateDraft={() => {}} onNavigate={() => {}} />
    )
    expect(screen.queryByText(/Dr. Sarah Chen/)).not.toBeInTheDocument()
  })
})
