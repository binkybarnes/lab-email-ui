import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MemberCard from '../../src/components/MemberCard'

const member = {
  id: 'sarah-chen',
  name: 'Dr. Sarah Chen',
  role: 'PI',
  email: 'schen@ucsd.edu',
  photo: null,
  linkedin: 'https://linkedin.com/in/sarahchen',
  scholar: null,
}

describe('MemberCard', () => {
  it('renders member name and role', () => {
    render(<MemberCard member={member} selected={false} onToggle={() => {}} onEmail={() => {}} anySelected={false} />)
    expect(screen.getByText('Dr. Sarah Chen')).toBeInTheDocument()
    expect(screen.getByText('PI')).toBeInTheDocument()
  })

  it('renders initials avatar when no photo', () => {
    render(<MemberCard member={member} selected={false} onToggle={() => {}} onEmail={() => {}} anySelected={false} />)
    expect(screen.getByText('SC')).toBeInTheDocument()
  })

  it('calls onToggle with member id when checkbox clicked', () => {
    const onToggle = vi.fn()
    render(<MemberCard member={member} selected={false} onToggle={onToggle} onEmail={() => {}} anySelected={false} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith('sarah-chen')
  })

  it('renders Add + button when not selected', () => {
    render(<MemberCard member={member} selected={false} onToggle={() => {}} onEmail={() => {}} anySelected={false} />)
    expect(screen.getByText('Add +')).toBeInTheDocument()
  })

  it('renders Added ✓ button when selected', () => {
    render(<MemberCard member={member} selected={true} onToggle={() => {}} onEmail={() => {}} anySelected={false} />)
    expect(screen.getByText('Added ✓')).toBeInTheDocument()
  })
})
