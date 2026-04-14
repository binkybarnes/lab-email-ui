# Gmail OAuth + Supabase Email Sending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "open in Gmail tab" flow with in-app email sending via Gmail API, authenticated per user with Supabase Google OAuth, with all sends logged to Supabase.

**Architecture:** Users sign in with their UCSD Google account via Supabase Auth (Google OAuth provider). The session includes a `provider_token` (Google access token with `gmail.send` scope). The frontend calls the Gmail API directly with that token, then inserts a row into an `email_logs` Supabase table.

**Tech Stack:** React 19, Vite, `@supabase/supabase-js`, Gmail REST API (`users.messages.send`), Vitest + Testing Library

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/supabase.js` | Supabase client singleton |
| Create | `src/hooks/useAuth.js` | Session state, signIn, signOut |
| Create | `src/utils/gmailApi.js` | Build + send MIME email via Gmail API |
| Create | `src/components/LoginScreen.jsx` | Full-page sign-in UI |
| Modify | `src/App.jsx` | Auth gate, pass session props |
| Modify | `src/components/Navbar.jsx` | Show user email + sign out |
| Modify | `src/components/EmailModal.jsx` | Send via API, log to Supabase |
| Delete | `src/utils/gmail.js` | Replaced by gmailApi.js |
| Create | `src/test/gmailApi.test.js` | Unit tests for MIME building |
| Create | `src/test/useAuth.test.js` | Unit tests for auth hook |

---

## Task 1: Supabase Project Setup (Manual)

No code — done in the Supabase dashboard. You'll collect two values needed for Task 3.

- [ ] **Step 1: Create Supabase project**

  Go to https://supabase.com → New project. Name it `lab-emailer`. Pick any region. Save the database password somewhere.

- [ ] **Step 2: Copy project credentials**

  In the Supabase dashboard → Settings → API. Copy:
  - **Project URL** (looks like `https://xxxx.supabase.co`)
  - **anon public key** (long JWT string)

  You'll paste these into `.env.local` in Task 3.

- [ ] **Step 3: Create the email_logs table**

  In Supabase dashboard → SQL Editor → New query. Run:

  ```sql
  create table email_logs (
    id uuid primary key default gen_random_uuid(),
    sent_at timestamptz default now(),
    sender_email text not null,
    recipient_email text not null,
    recipient_name text not null,
    subject text not null,
    body text not null,
    status text not null check (status in ('sent', 'failed')),
    error text
  );

  alter table email_logs enable row level security;

  create policy "Users read own logs"
    on email_logs for select
    using (sender_email = auth.email());

  create policy "Authenticated users insert"
    on email_logs for insert
    with check (auth.role() = 'authenticated');
  ```

  Click Run. Expect: "Success. No rows returned."

- [ ] **Step 4: Enable Google Auth provider**

  Supabase dashboard → Authentication → Providers → Google → Enable.
  Leave Client ID and Client Secret blank for now — you'll fill these in after Task 2.

  In the same panel, note the **Callback URL** (looks like `https://xxxx.supabase.co/auth/v1/callback`). Copy it — you'll need it in Task 2.

---

## Task 2: Google Cloud Setup (Manual)

- [ ] **Step 1: Create a Google Cloud project**

  Go to https://console.cloud.google.com → New Project → name it `lab-emailer`. Select it.

- [ ] **Step 2: Enable the Gmail API**

  APIs & Services → Library → search "Gmail API" → Enable.

- [ ] **Step 3: Configure OAuth consent screen**

  APIs & Services → OAuth consent screen:
  - User type: **External** (or Internal if your Google Workspace admin allows it — Internal is easier for UCSD accounts)
  - App name: `Lab Emailer`
  - User support email: your email
  - Scopes → Add scopes → add `https://www.googleapis.com/auth/gmail.send`
  - Test users: add your @ucsd.edu address (and any others who will test)
  - Save and Continue through all steps.

- [ ] **Step 4: Create OAuth 2.0 credentials**

  APIs & Services → Credentials → Create Credentials → OAuth client ID:
  - Application type: **Web application**
  - Name: `lab-emailer`
  - Authorized JavaScript origins: `http://localhost:5173`
  - Authorized redirect URIs: paste the Supabase Callback URL from Task 1 Step 4
  - Create.

  Copy the **Client ID** and **Client Secret**.

- [ ] **Step 5: Paste credentials into Supabase**

  Back in Supabase → Authentication → Providers → Google. Paste:
  - Client ID
  - Client Secret

  Also add `https://www.googleapis.com/auth/gmail.send` to the **Additional OAuth Scopes** field (if present — otherwise Supabase passes it via the `scopes` option in `signInWithOAuth`). Save.

---

## Task 3: Install Dependency + Env File

- [ ] **Step 1: Install @supabase/supabase-js**

  ```bash
  npm install @supabase/supabase-js
  ```

  Expected: package added to `dependencies` in `package.json`.

- [ ] **Step 2: Create .env.local**

  Create the file `/.env.local` (in the project root, next to `package.json`):

  ```
  VITE_SUPABASE_URL=https://your-project-id.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key-here
  ```

  Replace both values with what you copied in Task 1 Step 2.

- [ ] **Step 3: Verify .env.local is gitignored**

  ```bash
  cat .gitignore
  ```

  If `.env.local` is not listed, add it:

  ```bash
  echo ".env.local" >> .gitignore
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add package.json package-lock.json .gitignore
  git commit -m "feat: install @supabase/supabase-js"
  ```

---

## Task 4: Supabase Client Singleton

**Files:**
- Create: `src/lib/supabase.js`

- [ ] **Step 1: Create the file**

  `src/lib/supabase.js`:

  ```js
  import { createClient } from '@supabase/supabase-js'

  export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  )
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/lib/supabase.js
  git commit -m "feat: add Supabase client singleton"
  ```

---

## Task 5: Gmail API Utility + Tests

**Files:**
- Create: `src/utils/gmailApi.js`
- Create: `src/test/gmailApi.test.js`

- [ ] **Step 1: Write failing tests**

  `src/test/gmailApi.test.js`:

  ```js
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
  ```

- [ ] **Step 2: Run tests — verify they fail**

  ```bash
  npm test -- src/test/gmailApi.test.js
  ```

  Expected: FAIL — "Cannot find module '../utils/gmailApi'"

- [ ] **Step 3: Create gmailApi.js**

  `src/utils/gmailApi.js`:

  ```js
  /**
   * Builds an RFC 2822 MIME email string.
   * @param {{ to: string, subject: string, body: string }} params
   * @returns {string}
   */
  export function buildMimeMessage({ to, subject, body }) {
    return [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
    ].join('\r\n')
  }

  /**
   * Base64url-encodes a string (handles Unicode via TextEncoder).
   * @param {string} str
   * @returns {string}
   */
  export function toBase64Url(str) {
    const bytes = new TextEncoder().encode(str)
    const binString = Array.from(bytes, byte => String.fromCodePoint(byte)).join('')
    return btoa(binString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  /**
   * Sends an email via Gmail API.
   * @param {{ to: string, subject: string, body: string, accessToken: string }} params
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  export async function sendEmail({ to, subject, body, accessToken }) {
    const raw = toBase64Url(buildMimeMessage({ to, subject, body }))

    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      })

      if (!res.ok) {
        const err = await res.json()
        return { ok: false, error: err.error?.message ?? `HTTP ${res.status}` }
      }

      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }
  ```

- [ ] **Step 4: Run tests — verify they pass**

  ```bash
  npm test -- src/test/gmailApi.test.js
  ```

  Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/utils/gmailApi.js src/test/gmailApi.test.js
  git commit -m "feat: add Gmail API utility with MIME encoding"
  ```

---

## Task 6: useAuth Hook + Tests

**Files:**
- Create: `src/hooks/useAuth.js`
- Create: `src/test/useAuth.test.js`

- [ ] **Step 1: Write failing tests**

  `src/test/useAuth.test.js`:

  ```js
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { renderHook, act } from '@testing-library/react'

  const mockUnsubscribe = vi.fn()
  const mockGetSession = vi.fn()
  const mockOnAuthStateChange = vi.fn()
  const mockSignInWithOAuth = vi.fn()
  const mockSignOut = vi.fn()

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
  ```

- [ ] **Step 2: Run tests — verify they fail**

  ```bash
  npm test -- src/test/useAuth.test.js
  ```

  Expected: FAIL — "Cannot find module '../hooks/useAuth'"

- [ ] **Step 3: Create useAuth.js**

  `src/hooks/useAuth.js`:

  ```js
  import { useState, useEffect } from 'react'
  import { supabase } from '../lib/supabase'

  export function useAuth() {
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setLoading(false)
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
      })

      return () => subscription.unsubscribe()
    }, [])

    function signIn() {
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/gmail.send',
          redirectTo: window.location.origin,
        },
      })
    }

    function signOut() {
      supabase.auth.signOut()
    }

    return { session, loading, signIn, signOut }
  }
  ```

- [ ] **Step 4: Run tests — verify they pass**

  ```bash
  npm test -- src/test/useAuth.test.js
  ```

  Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/hooks/useAuth.js src/test/useAuth.test.js
  git commit -m "feat: add useAuth hook with Google OAuth via Supabase"
  ```

---

## Task 7: LoginScreen Component

**Files:**
- Create: `src/components/LoginScreen.jsx`

- [ ] **Step 1: Create the component**

  `src/components/LoginScreen.jsx`:

  ```jsx
  export default function LoginScreen({ onSignIn }) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: '#13151a' }}
      >
        <div
          className="flex flex-col items-center gap-6 p-10"
          style={{
            border: '1px solid #363b47',
            borderRadius: '5px',
            background: '#1e2128',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          <span className="text-xs text-muted tracking-widest uppercase">Lab Emailer</span>
          <h1 className="text-lg font-semibold text-primary font-serif">UCSD Lab Browser</h1>
          <button
            onClick={onSignIn}
            className="text-xs px-5 py-2 transition-all"
            style={{ background: '#4d6dff', color: '#fff', borderRadius: '3px' }}
            onMouseEnter={e => e.currentTarget.style.background = '#3d5df0'}
            onMouseLeave={e => e.currentTarget.style.background = '#4d6dff'}
          >
            Sign in with Google
          </button>
          <p className="text-xs text-muted">Use your @ucsd.edu account</p>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/LoginScreen.jsx
  git commit -m "feat: add LoginScreen component"
  ```

---

## Task 8: App.jsx Auth Gate

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update App.jsx**

  Replace the full contents of `src/App.jsx` with:

  ```jsx
  import { useState } from 'react'
  import { AnimatePresence } from 'motion/react'
  import { useAppState } from './hooks/useAppState'
  import { useAuth } from './hooks/useAuth'
  import Navbar from './components/Navbar'
  import Sidebar from './components/Sidebar'
  import LabBrowser from './components/LabBrowser'
  import CheckoutSidebar from './components/CheckoutSidebar'
  import EmailModal from './components/EmailModal'
  import LoginScreen from './components/LoginScreen'

  export default function App() {
    const { session, loading, signIn, signOut } = useAuth()

    const {
      data,
      visibleLabs,
      visibleLabIds,
      selectedMemberIds,
      selectedMembers,
      roleFilter,
      setRoleFilter,
      emailModal,
      toggleLab,
      toggleVisibleLabs,
      toggleMember,
      toggleLabMembers,
      applyRoleSelection,
      clearSelection,
      openEmailModal,
      closeEmailModal,
      updateDraft,
      navigateModal,
    } = useAppState()

    const [isCheckoutOpen, setIsCheckoutOpen] = useState(true)
    const showCheckout = selectedMembers.length > 0
    const rightOffset = showCheckout ? (isCheckoutOpen ? '18.2rem' : '3.7rem') : '0'

    if (loading) return null

    if (!session) return <LoginScreen onSignIn={signIn} />

    return (
      <div className="relative min-h-screen grid-bg">
        <Navbar
          selectedCount={selectedMembers.length}
          rightOffset={rightOffset}
          user={session.user}
          onSignOut={signOut}
        />
        <Sidebar
          data={data}
          visibleLabIds={visibleLabIds}
          onToggleLab={toggleLab}
          onToggleVisibleLabs={toggleVisibleLabs}
        />
        <LabBrowser
          data={data}
          visibleLabs={visibleLabs}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          selectedMemberIds={selectedMemberIds}
          onToggleMember={toggleMember}
          onToggleLabMembers={toggleLabMembers}
          onEmail={openEmailModal}
          onApplyRoleSelection={applyRoleSelection}
          rightOffset={rightOffset}
        />
        <AnimatePresence>
          {showCheckout && (
            <CheckoutSidebar
              key="checkout"
              selectedMembers={selectedMembers}
              onRemove={toggleMember}
              onEmail={openEmailModal}
              onEmailAll={openEmailModal}
              isOpen={isCheckoutOpen}
              setIsOpen={setIsCheckoutOpen}
            />
          )}
        </AnimatePresence>
        <EmailModal
          modal={emailModal}
          onClose={closeEmailModal}
          onUpdateDraft={updateDraft}
          onNavigate={navigateModal}
          accessToken={session.provider_token}
          senderEmail={session.user.email}
        />
      </div>
    )
  }
  ```

- [ ] **Step 2: Start dev server and verify login screen appears**

  ```bash
  npm run dev
  ```

  Open http://localhost:5173. You should see the login screen (dark background, "Sign in with Google" button). The app behind it should not render.

- [ ] **Step 3: Commit**

  ```bash
  git add src/App.jsx
  git commit -m "feat: add auth gate to App — show LoginScreen if no session"
  ```

---

## Task 9: Navbar User Display + Sign Out

**Files:**
- Modify: `src/components/Navbar.jsx`

- [ ] **Step 1: Update Navbar.jsx**

  Replace the full contents of `src/components/Navbar.jsx` with:

  ```jsx
  export default function Navbar({ selectedCount = 0, rightOffset = '0', user = null, onSignOut }) {
    return (
      <header
        className="fixed top-0 left-0 z-50 flex items-center justify-between px-6 h-14 transition-all duration-300"
        style={{
          right: rightOffset,
          background: 'rgba(30, 33, 40, 0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #363b47',
        }}
      >
        <div className="flex items-baseline gap-3">
          <span className="text-primary font-semibold text-2xl tracking-tight font-serif">
            UCSD Lab Browser
          </span>
        </div>

        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <div
              role="status"
              aria-live="polite"
              className="text-xs px-2.5 py-0.5 rounded"
              style={{
                background: 'rgba(77,109,255,0.15)',
                color: '#7b9fff',
                border: '1px solid rgba(77,109,255,0.3)',
              }}
            >
              {selectedCount} selected
            </div>
          )}

          {user && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{user.email}</span>
              <button
                onClick={onSignOut}
                className="text-xs px-2.5 py-1 text-muted transition-colors"
                style={{ border: '1px solid #363b47', borderRadius: '3px', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#272b34'; e.currentTarget.style.color = '#e4e7ed' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '' }}
              >
                sign out
              </button>
            </div>
          )}
        </div>
      </header>
    )
  }
  ```

- [ ] **Step 2: Verify in browser**

  After signing in (Task 10 will make sign-in work end-to-end, but if you want to verify the layout now, temporarily hardcode `user={{ email: 'test@ucsd.edu' }}` in App.jsx, then revert).

  The navbar should show the user's email on the right with a "sign out" button.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/Navbar.jsx
  git commit -m "feat: show signed-in user and sign out button in Navbar"
  ```

---

## Task 10: EmailModal — Real Send + Supabase Logging

**Files:**
- Modify: `src/components/EmailModal.jsx`
- Delete: `src/utils/gmail.js`

- [ ] **Step 1: Replace EmailModal.jsx**

  Replace the full contents of `src/components/EmailModal.jsx` with:

  ```jsx
  import { useEffect, useState } from 'react'
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

  async function dispatchEmail({ member, draft, accessToken, senderEmail }) {
    const result = await sendEmail({
      to: member.email,
      subject: draft.subject,
      body: draft.body,
      accessToken,
    })

    await supabase.from('email_logs').insert({
      sender_email: senderEmail,
      recipient_email: member.email,
      recipient_name: member.name,
      subject: draft.subject,
      body: draft.body,
      status: result.ok ? 'sent' : 'failed',
      error: result.ok ? null : result.error,
    })

    return result
  }

  export default function EmailModal({ modal, onClose, onUpdateDraft, onNavigate, accessToken, senderEmail }) {
    const { open, members, currentIndex, drafts } = modal
    const [sending, setSending] = useState(false)
    const [results, setResults] = useState({}) // memberId -> { ok, error }

    useEffect(() => {
      if (!open) {
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

    if (!open || members.length === 0) return null

    const member = members[currentIndex]
    const draft = drafts[member.id] ?? { subject: '', body: '' }
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

            {/* Body */}
            <div className="flex flex-col flex-1">
              <label className="text-xs text-muted block mb-1">Body</label>
              <textarea
                value={draft.body}
                onChange={e => onUpdateDraft(member.id, 'body', e.target.value)}
                placeholder="Write your email..."
                rows={10}
                style={{ ...INPUT_STYLE, resize: 'none', fontSize: 12 }}
                onFocus={e => e.target.style.borderColor = '#4d6dff'}
                onBlur={e => e.target.style.borderColor = '#363b47'}
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
  ```

- [ ] **Step 2: Delete the old gmail.js utility**

  ```bash
  git rm src/utils/gmail.js
  ```

- [ ] **Step 3: Run all tests**

  ```bash
  npm test
  ```

  Expected: all tests PASS (gmailApi + useAuth + placeholder).

- [ ] **Step 4: Test the full flow in browser**

  With `npm run dev` running:
  1. Go to http://localhost:5173 — login screen appears
  2. Click "Sign in with Google" — redirects to Google OAuth (you need Task 1 + 2 complete for this to work)
  3. Sign in with your @ucsd.edu account
  4. App loads with your email in the Navbar
  5. Select a member, open email modal, compose, click "Send"
  6. Button changes to "sent ✓", green "sent" badge appears next to member name
  7. Check Supabase dashboard → Table Editor → email_logs — row should appear

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/EmailModal.jsx
  git commit -m "feat: send emails via Gmail API and log to Supabase"
  ```

---

## Task 11: Full Test Run + Final Commit

- [ ] **Step 1: Run all tests**

  ```bash
  npm test
  ```

  Expected: all tests PASS with no warnings.

- [ ] **Step 2: Run lint**

  ```bash
  npm run lint
  ```

  Fix any errors. Re-run until clean.

- [ ] **Step 3: Final commit**

  ```bash
  git add -A
  git commit -m "feat: Gmail OAuth + Supabase email logging complete"
  ```
