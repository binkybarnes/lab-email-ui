# Gmail OAuth + Supabase Email Sending

**Date:** 2026-04-13  
**Status:** Approved

## Summary

Replace the current "open in Gmail tab" flow with actual in-app email sending via Gmail API. Users authenticate with their UCSD Google accounts via Supabase Auth (Google OAuth). Emails are sent directly from the browser using the Gmail API with the OAuth `provider_token`. All sent emails are logged to a Supabase table.

## Architecture

The app remains a pure frontend (React + Vite). No custom backend is added.

Three additions:
1. **Supabase project** — hosts Google OAuth via Supabase Auth + `email_logs` table
2. **`@supabase/supabase-js`** — client library, initialized once in `src/lib/supabase.js`
3. **Google Cloud project** — Gmail API enabled, OAuth 2.0 credentials configured with `gmail.send` scope

**Auth flow:**
- User clicks "Sign in with Google" → Supabase OAuth redirect → Google login → redirect back with session
- Supabase stores session including `provider_token` (Google access token with `gmail.send` scope)
- `provider_token` is used to call Gmail API directly from the browser

**Send flow:**
- User composes email in `EmailModal` → clicks "Send"
- Frontend calls Gmail API with `provider_token`
- On success or failure, inserts a row into `email_logs`
- UI shows sending / success / error state inline

**Auth gate:**
- A `useAuth` hook wraps Supabase's session listener, exposes `{ user, session, signIn, signOut }`
- `App.jsx` shows `LoginScreen` if no session, otherwise renders existing UI

## Data Model

**Table: `email_logs`**

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | auto-generated |
| `sent_at` | `timestamptz` | default `now()` |
| `sender_email` | `text` | logged-in user's @ucsd.edu address |
| `recipient_email` | `text` | member's email |
| `recipient_name` | `text` | member's display name |
| `subject` | `text` | |
| `body` | `text` | |
| `status` | `text` | `'sent'` or `'failed'` |
| `error` | `text` | null on success, error message on failure |

**Row-level security (RLS):**
- Read: `sender_email = auth.email()` — users see only their own logs
- Insert: any authenticated user

Labs data stays as static `labs.json` (no Supabase migration).

## Frontend Changes

**New files:**
- `src/lib/supabase.js` — Supabase client singleton (reads env vars)
- `src/hooks/useAuth.js` — session state + `signIn()` / `signOut()`
- `src/utils/gmailApi.js` — calls Gmail API `users.messages.send` with `provider_token`; returns `{ ok, error }`
- `src/components/LoginScreen.jsx` — full-page sign-in UI matching dark theme

**Modified files:**
- `src/App.jsx` — auth gate: renders `LoginScreen` if no session
- `src/components/EmailModal.jsx` — "open in Gmail →" → "Send" button; shows sending/success/error inline; calls `gmailApi.sendEmail()` then logs to Supabase
- `src/components/Navbar.jsx` — shows signed-in user's email + sign out button

**Deleted files:**
- `src/utils/gmail.js` — replaced by `gmailApi.js`

No changes to: `useAppState.js`, `LabBrowser`, `CheckoutSidebar`, `Sidebar`, `MemberCard`, `LabSection`.

## Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

These are set in `.env.local` (gitignored). The Gmail API is called with the OAuth `provider_token` from the Supabase session — no separate API key needed on the frontend.

## External Setup (done once, manually)

1. **Google Cloud Console** — create project, enable Gmail API, create OAuth 2.0 credentials (Web application), add `http://localhost:5173` as authorized origin and Supabase callback URL as redirect URI, add `gmail.send` to OAuth scopes
2. **Supabase Dashboard** — create project, enable Google Auth provider (paste Google client ID + secret), add `gmail.send` to additional OAuth scopes, create `email_logs` table with RLS as described above

## Scope

- Single-email send supported via the existing per-member modal flow
- "Send all" sends each member's email sequentially and logs each one individually; the UI shows aggregate success/failure count when done
- No AI Writer feature (already disabled in current UI, stays disabled)
- No dashboard for email logs in this iteration — data is captured for future use

## Known Limitations

- **`provider_token` expiry:** Google access tokens expire after 1 hour. Supabase auto-refreshes its own session token, but does not automatically refresh the `provider_token`. If a user stays on the page for over an hour without re-authing, sends will fail with a 401. The fix is to prompt them to sign out and sign back in. This is acceptable for v1.

