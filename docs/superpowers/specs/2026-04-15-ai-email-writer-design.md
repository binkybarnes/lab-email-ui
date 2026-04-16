# AI Email Writer — Design Spec
**Date:** 2026-04-15

## Context

The app already supports browsing UCSD research labs and composing cold emails to members. The "AI Write" button exists in EmailModal but is disabled. This feature enables it: an AI-powered email generator that uses the lab's research overview and the user's personal profile to produce a personalized, human-sounding cold email. The key constraint is that the email must not sound AI-generated — this is solved through careful prompt engineering, not complex architecture.

OpenRouter is used as the AI provider (model: `openrouter/elephant-alpha`, free tier). The API key is kept server-side in a Supabase Edge Function to avoid exposing it in the frontend bundle.

---

## Architecture

### New Files

| File | Purpose |
|---|---|
| `supabase/functions/generate-email/index.ts` | Edge function — receives prompt payload from browser, calls OpenRouter with secret key, returns `{ subject, body }` |
| `src/utils/emailPrompt.js` | Builds the structured prompt payload from profile + lab + member + options |
| `src/utils/profile.js` | `getProfile()` / `saveProfile()` — thin localStorage wrapper for user profile |
| `src/components/ProfileModal.jsx` | One-time profile setup form, also editable from header |

### Modified Files

| File | Changes |
|---|---|
| `src/utils/openrouter.js` | `generateEmail(promptPayload)` — calls Supabase edge function, returns `{ subject, body }` |
| `src/components/EmailModal.jsx` | Enable AI Write button, add animated bottom drawer with tone/length/instructions UI, wire up Generate |
| `src/App.jsx` | Add Profile button to header |

---

## Data Flow

```
User clicks "AI Write"
  → check localStorage for profile (profile.js)
  → if missing: open ProfileModal → user fills in → saveProfile()
  → AI drawer animates in (AnimatePresence, already in project)
  → user selects tone, length, optionally adds freeform instructions
  → clicks Generate
  → emailPrompt.js builds payload:
       { lab: { name, overview }, member: { name, role }, profile, options: { tone, length, instructions } }
  → openrouter.js POSTs payload to /functions/v1/generate-email
  → edge function calls openrouter.ai with secret key
  → returns { subject, body }
  → subject and body populate existing draft state in EmailModal
  → user edits freely, sends via existing flow (Gmail compose / admin send)
```

---

## User Profile

Collected once, saved to `localStorage` key `ai_profile`. Editable anytime via Profile button in header.

| Field | Label in form | Used in prompt for |
|---|---|---|
| `name` | Your name | Sign-off, self-introduction |
| `status` | Academic status | e.g. "2nd year undergrad", "incoming PhD student" — sets tone and ask |
| `institution` | Current institution / department | Credibility, context |
| `background` | Research background & interests | Tie sender's work to lab's work |
| `goal` | What you're looking for | e.g. "rotation", "PhD position", "undergrad volunteer" — the email's ask |
| `hook` | Personal hook (optional) | A specific method, project, or detail that makes the email memorable |

---

## EmailModal AI Drawer

Docks below the email editor, separated by a blue top border. Animates in/out with `AnimatePresence`. **Not clunky** — compact rows, no extra chrome.

```
[ ✦ AI Write ]                          [ 🔒 stays on your device ]

Tone:    [Formal ●]  [ Casual ]  [ Enthusiastic ]
Length:  [ Short ]   [Medium ●]  [ Long ]

Extra instructions (optional):
┌─────────────────────────────────────┐
│ mention my western blot experience  │
└─────────────────────────────────────┘

[ ✦ Generate ]          Regenerate anytime for a new version
```

- Tone and length are single-select chip groups (one active at a time)
- Default: Formal, Medium
- Generate button shows a spinner while loading, disabled during request
- On success: fills subject + body in existing draft state, user can edit
- On error: brief inline error message below the button

---

## ProfileModal

Triggered on first AI Write click if no profile exists. Also accessible via "Profile" button in app header.

- Simple stacked form (6 fields, all text inputs / textareas)
- "Your data never leaves this device" notice at the bottom
- Save button writes to localStorage, closes modal
- No Supabase, no server — purely local

---

## Supabase Edge Function (`generate-email`)

Located at `supabase/functions/generate-email/index.ts`.

- Accepts POST with JSON body: `{ lab, member, profile, options }`
- Constructs the final OpenRouter prompt string from the structured payload (all prompt logic lives here — `emailPrompt.js` only assembles the data, never the prompt string)
- Calls `https://openrouter.ai/api/v1/chat/completions` with `OPENROUTER_KEY` secret
- Model: `openrouter/elephant-alpha`
- Returns `{ subject, body }` parsed from model response
- CORS headers set for the Supabase project URL

**OpenRouter key setup:**
```bash
supabase secrets set OPENROUTER_KEY=sk-or-...
```

---

## Prompt Engineering

The prompt is the core of the "doesn't sound AI" goal. Key directives baked in:

**Explicit bans** (injected as system instructions):
- Do not use: "I wanted to reach out", "I hope this email finds you well", "excited to", "delve", "leverage", "passionate about", "keen", "touch base"
- No filler opening sentences
- No generic praise ("Your lab's impressive work...")

**Structure directives:**
- Open with one specific sentence connecting the sender's background to the lab's actual research (from overview)
- State the ask clearly and early (what they're looking for)
- Include the personal hook if provided — make it feel like a real person wrote it
- Sign off with just the sender's name, no "Best regards" boilerplate
- Subject: specific and plain, not clickbaity (e.g. "Rotation inquiry — [Name]")

**Tone mapping:**
- Formal → professional but not stiff, no slang
- Casual → conversational, shorter sentences, first-name basis if appropriate
- Enthusiastic → genuine interest, slightly more energy, still not cringe

**Length mapping:**
- Short → 3 sentences max per paragraph, 2 paragraphs total
- Medium → 3 paragraphs, ~150 words
- Long → 4 paragraphs, ~250 words

---

## Header Change

Add a small "Profile" button (icon + text) to the top-right of the app header in `App.jsx`. Clicking it opens `ProfileModal` in edit mode. If no profile exists yet, it shows the same empty form.

---

## "Data Stays Local" Notice

Appears in two places:
1. Bottom-right of the AI drawer in EmailModal: `🔒 stays on your device`
2. Bottom of ProfileModal above the Save button: `Your profile is saved only on this device. We never store or send your personal information.`

---

## Verification

1. **First use flow:** Click AI Write with no profile → ProfileModal appears → fill in → Save → drawer opens → Generate → subject/body populate
2. **Profile persistence:** Refresh page, click AI Write → drawer opens immediately (no profile form) → generated email still uses saved profile
3. **Regeneration:** Change tone/length/instructions → click Generate again → new email generated, overwrites previous draft
4. **Profile edit:** Click Profile in header → edit fields → Save → next generation uses new values
5. **Error handling:** Disconnect network → click Generate → error message appears in drawer
6. **Existing flow unaffected:** Send via Gmail / admin send still works normally with manually written email (AI drawer is additive, not required)
7. **Key not exposed:** Open browser DevTools → Network tab → confirm calls go to Supabase function URL, not directly to openrouter.ai. Source maps / bundle contains no API key.
