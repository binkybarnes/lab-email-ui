import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMimeMessage, toBase64Url, sendEmail } from '../utils/gmailApi'

describe('buildMimeMessage', () => {
  it('includes all required headers', () => {
    const mime = buildMimeMessage({ to: 'a@ucsd.edu', subject: 'Hello', body: 'Hi' })
    expect(mime).toContain('To: a@ucsd.edu')
    expect(mime).toContain('Subject: Hello')
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8')
  })

  it('separates headers from body with blank line', () => {
    const mime = buildMimeMessage({ to: 'a@ucsd.edu', subject: 'S', body: 'B' })
    const parts = mime.split('\r\n\r\n')
    expect(parts.length).toBe(2)
    expect(parts[1]).toBe('B')
  })
})

describe('toBase64Url', () => {
  it('produces no +, /, or = characters', () => {
    const result = toBase64Url('Hello World')
    expect(result).not.toMatch(/[+/=]/)
  })

  it('is reversible via standard base64 decode', () => {
    const input = 'Test string with content'
    const encoded = toBase64Url(input)
    const standard = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = standard + '='.repeat((4 - standard.length % 4) % 4)
    const decoded = atob(padded)
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0))
    expect(new TextDecoder().decode(bytes)).toBe(input)
  })
})

describe('sendEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns ok:true on successful API call', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn(),
    }))

    const result = await sendEmail({
      to: 'a@ucsd.edu',
      subject: 'Test',
      body: 'Hello',
      accessToken: 'fake-token',
    })

    expect(result).toEqual({ ok: true })
  })

  it('calls Gmail API with correct URL and Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() })
    vi.stubGlobal('fetch', mockFetch)

    await sendEmail({ to: 'a@ucsd.edu', subject: 'S', body: 'B', accessToken: 'my-token' })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      }),
    )
  })

  it('returns ok:false with error message on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: { message: 'Invalid credentials' } }),
    }))

    const result = await sendEmail({ to: 'a@ucsd.edu', subject: 'S', body: 'B', accessToken: 'bad' })

    expect(result).toEqual({ ok: false, error: 'Invalid credentials' })
  })

  it('returns ok:false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')))

    const result = await sendEmail({ to: 'a@ucsd.edu', subject: 'S', body: 'B', accessToken: 'tok' })

    expect(result).toEqual({ ok: false, error: 'Network down' })
  })
})
