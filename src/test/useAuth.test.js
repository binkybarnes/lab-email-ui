import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { mockUnsubscribe, mockGetSession, mockOnAuthStateChange, mockSignInWithOAuth, mockSignOut } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
  mockSignOut: vi.fn(),
  mockUnsubscribe: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
    },
  },
}))

import { useAuth } from '../hooks/useAuth'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: null } })
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } })
})

describe('useAuth', () => {
  it('starts with loading:true and session:null', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    expect(result.current.session).toBe(null)
  })

  it('sets loading:false after session resolves', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    expect(result.current.loading).toBe(false)
  })

  it('updates session when onAuthStateChange fires', async () => {
    const fakeSession = { user: { email: 'a@ucsd.edu' }, provider_token: 'tok' }
    let callback
    mockOnAuthStateChange.mockImplementation((cb) => {
      callback = cb
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })

    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    act(() => callback('SIGNED_IN', fakeSession))

    expect(result.current.session).toEqual(fakeSession)
  })

  it('signIn calls supabase signInWithOAuth with google provider and gmail.send scope', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    act(() => result.current.signIn())

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        scopes: 'https://www.googleapis.com/auth/gmail.send',
      }),
    })
  })

  it('signOut calls supabase signOut', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    act(() => result.current.signOut())

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useAuth())
    await act(async () => {})
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
