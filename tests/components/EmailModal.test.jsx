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
}

describe('EmailModal', () => {
  it('renders recipient name', () => {
    render(
      <EmailModal modal={baseModal} onClose={() => {}} onNavigate={() => {}} />
    )
    expect(screen.getByText(/Dr. Sarah Chen/)).toBeInTheDocument()
  })

  it('shows empty subject and body inputs on open', () => {
    render(
      <EmailModal modal={baseModal} onClose={() => {}} onNavigate={() => {}} />
    )
    expect(screen.getByPlaceholderText('Subject line...')).toHaveValue('')
    expect(screen.getByPlaceholderText('Write your email...')).toHaveValue('')
  })

  it('calls onClose when Escape pressed', () => {
    const onClose = vi.fn()
    render(
      <EmailModal modal={baseModal} onClose={onClose} onNavigate={() => {}} />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when open is false', () => {
    render(
      <EmailModal modal={{ ...baseModal, open: false }} onClose={() => {}} onNavigate={() => {}} />
    )
    expect(screen.queryByText(/Dr. Sarah Chen/)).not.toBeInTheDocument()
  })
})
