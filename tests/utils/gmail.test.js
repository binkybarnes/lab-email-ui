import { describe, it, expect } from 'vitest'
import { buildGmailUrl } from '../../src/utils/gmail'

describe('buildGmailUrl', () => {
  it('builds a compose URL containing the email address', () => {
    const url = buildGmailUrl({ to: 'test@ucsd.edu' })
    expect(url).toContain('https://mail.google.com/mail/')
    expect(url).toContain('view=cm')
    expect(url).toContain('test%40ucsd.edu')
  })

  it('includes subject when provided', () => {
    const url = buildGmailUrl({ to: 'test@ucsd.edu', subject: 'Hello' })
    expect(url).toContain('Hello')
  })

  it('includes body when provided', () => {
    const url = buildGmailUrl({ to: 'test@ucsd.edu', body: 'Hi there' })
    expect(url).toContain('Hi+there')
  })

  it('works with empty subject and body', () => {
    const url = buildGmailUrl({ to: 'a@b.com', subject: '', body: '' })
    expect(url).toContain('a%40b.com')
  })
})
