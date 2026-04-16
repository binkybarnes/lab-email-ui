import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateEmail } from '../utils/openrouter'

// Mock supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import { supabase } from '../lib/supabase'

const validPayload = {
  lab: {
    name: 'Smith Computational Biology Lab',
    overview: 'Develops ML methods for single-cell RNA sequencing analysis.',
  },
  member: {
    name: 'Dr. Jane Smith',
    role: 'Principal Investigator',
  },
  profile: {
    name: 'Alex Chen',
    status: 'Undergraduate senior',
    institution: 'UC Berkeley',
    background: 'CS major with ML and bioinformatics coursework.',
    goal: 'Summer research internship',
    hook: 'Read your 2024 Nature Methods paper on scRNA-seq batch correction.',
  },
  options: {
    tone: 'Formal',
    length: 'Medium',
  },
}

describe('generateEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns subject and body on success', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        subject: 'Rotation inquiry — Alex Chen',
        body: 'Dear Dr. Smith, I am a CS senior at UC Berkeley...',
      },
      error: null,
    })

    const result = await generateEmail(validPayload)

    expect(supabase.functions.invoke).toHaveBeenCalledWith('generate-email', {
      body: validPayload,
    })
    expect(result).toEqual({
      subject: 'Rotation inquiry — Alex Chen',
      body: 'Dear Dr. Smith, I am a CS senior at UC Berkeley...',
    })
  })

  it('throws when supabase returns an error', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge function timeout' },
    })

    await expect(generateEmail(validPayload)).rejects.toThrow('Edge function timeout')
  })

  it('throws when response is missing subject', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { body: 'Some body text' },
      error: null,
    })

    await expect(generateEmail(validPayload)).rejects.toThrow('Unexpected response from AI')
  })

  it('throws when response is missing body', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { subject: 'Some subject' },
      error: null,
    })

    await expect(generateEmail(validPayload)).rejects.toThrow('Unexpected response from AI')
  })

  it('throws when response data is null', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: null,
    })

    await expect(generateEmail(validPayload)).rejects.toThrow('Unexpected response from AI')
  })

  it('throws with fallback message when error has no message', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {},
    })

    await expect(generateEmail(validPayload)).rejects.toThrow('Failed to generate email')
  })

  it('passes all payload fields to the edge function', async () => {
    const customPayload = {
      ...validPayload,
      options: { tone: 'Casual', length: 'Short', instructions: 'Mention campus visit' },
    }

    supabase.functions.invoke.mockResolvedValue({
      data: { subject: 'Quick question', body: 'Hey Prof...' },
      error: null,
    })

    await generateEmail(customPayload)

    expect(supabase.functions.invoke).toHaveBeenCalledWith('generate-email', {
      body: customPayload,
    })
  })
})
