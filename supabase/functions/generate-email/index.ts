import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Leaky bucket rate limiter: 1 token drips every 2s, bucket holds 20.
// Stale entries (no activity for 5 min) are cleaned up periodically.
// ---------------------------------------------------------------------------
const buckets = new Map<string, { tokens: number; lastDrip: number }>()
const BUCKET_MAX = 20
const DRIP_INTERVAL = 2_000
const STALE_AFTER = 300_000 // 5 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now()

  // Periodic cleanup: drop IPs with no activity for 5+ minutes
  if (buckets.size > 100) {
    for (const [k, v] of buckets) {
      if (now - v.lastDrip > STALE_AFTER) buckets.delete(k)
    }
  }

  let bucket = buckets.get(ip)
  if (!bucket) {
    buckets.set(ip, { tokens: BUCKET_MAX - 1, lastDrip: now })
    return false
  }
  const elapsed = now - bucket.lastDrip
  const dripped = Math.floor(elapsed / DRIP_INTERVAL)
  if (dripped > 0) {
    bucket.tokens = Math.min(BUCKET_MAX, bucket.tokens + dripped)
    bucket.lastDrip = now
  }
  if (bucket.tokens <= 0) return true
  bucket.tokens--
  return false
}

// ---------------------------------------------------------------------------
// Usage limit — persisted in Supabase `daily_usage` table.
// Uses 5-hour universal windows (0:00, 5:00, 10:00, 15:00, 20:00 UTC).
// Returns { allowed: bool, remaining: number, resetsAt: string }.
// ---------------------------------------------------------------------------
const USAGE_LIMIT = 50
const WINDOW_SECONDS = 18_000 // 5 hours

// Shared Supabase service-role client — reused across requests in the same isolate
let _db: ReturnType<typeof createClient> | null = null
function getDb() {
  if (!_db) {
    _db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  }
  return _db
}

async function checkUsageLimit(ip: string): Promise<{ allowed: boolean; remaining: number; resetsAt: string }> {
  const db = getDb()

  const { data, error } = await db.rpc('increment_daily_usage', {
    p_ip: ip,
    p_limit: USAGE_LIMIT,
  })

  // Compute fallback resets_at in case the RPC doesn't exist yet
  const fallbackResetsAt = new Date(
    Math.ceil(Date.now() / (WINDOW_SECONDS * 1000)) * WINDOW_SECONDS * 1000
  ).toISOString()

  if (error) {
    console.error('[daily_usage] rpc failed:', error.message)
    return { allowed: true, remaining: USAGE_LIMIT, resetsAt: fallbackResetsAt }
  }

  return { allowed: data.allowed, remaining: data.remaining, resetsAt: data.resets_at }
}

// ---------------------------------------------------------------------------
// Admin check — decode JWT and compare email to ADMIN_EMAIL secret.
// supabase.functions.invoke() sends the user's JWT for any signed-in user,
// so we can't just check "token !== anonKey" — that treats every logged-in
// user as admin. Instead we decode the JWT payload and match the email claim.
// ---------------------------------------------------------------------------
function isAdmin(req: Request): boolean {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? ''
  if (!adminEmail) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.email === adminEmail
  } catch {
    return false
  }
}

const FIELD_LIMITS: Record<string, number> = {
  'profile.name': 200,
  'profile.status': 200,
  'profile.institution': 200,
  'profile.experience': 1000,
  'profile.whyField': 500,
  'profile.goal': 200,
  'profile.standout': 600,
  'options.instructions': 500,
  'lab.name': 200,
  'lab.overview': 2000,
  'member.name': 200,
  'member.role': 200,
}

function validateLengths(fields: Record<string, string | undefined>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    const limit = FIELD_LIMITS[key]
    if (limit && typeof value === 'string' && value.length > limit) {
      const label = key.split('.').pop()
      return `${label} is too long (max ${limit} characters)`
    }
  }
  return null
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'X-Daily-Remaining, X-Resets-At',
}

function buildPrompt({ lab, member, profile, options }: {
  lab: { name: string; overview: string }
  member: { name: string; role: string }
  profile: { name: string; status: string; institution: string; experience: string; whyField: string; goal: string; standout?: string }
  options: { instructions?: string }
}) {
  const systemPrompt = `You are ghostwriting a cold email from a real student to a professor or lab member. The email must read like a human student typed it on their laptop in 10 minutes — not like a language model produced it.

STRUCTURE — follow this order exactly:
1. First sentence: State who you are (name, year, institution) and what you want. Be direct. Example: "I'm Alex, a third-year biochem major at UCSD, and I'm looking for a research position in your lab."
2. Second paragraph (2-3 sentences): Why YOU. What got you into this field? What have you worked on that's relevant? Be specific — name a technique, a class project, a result, a question that keeps you up at night. This is the core of the email.
3. Third paragraph (1-2 sentences): Why THIS LAB specifically. Connect your interests to their research using the lab overview provided. Do NOT just restate their research back to them — explain why it matters to you or how it connects to what you've done. IMPORTANT: If the sender's background does NOT directly relate to the lab's research area, do NOT fake a connection. Instead, be honest — say what you can bring from your actual background (e.g. data skills, programming, analysis) and express genuine curiosity to learn the lab's domain. Honesty is always better than a forced connection a professor will see through.
4. One closing sentence: Something like "Would it be possible to chat about opportunities in your lab?" or "I'd love to learn more about whether there might be a fit." Keep it simple.
5. Sign off: First name only on its own line. No "Best", no "Sincerely", no "Regards".

HARD RULES:
- NEVER use any of these words or phrases: "I hope this email finds you well", "I wanted to reach out", "I am excited to", "I am writing to express", "delve", "delving", "leverage", "keen", "keen interest", "passionate about", "touch base", "Best regards", "Warm regards", "Sincerely", "I look forward to hearing from you", "synergy", "innovative", "groundbreaking", "cutting-edge", "pioneering", "impactful", "captivated", "fascinated by your work", "deeply interested", "thrilled", "esteemed", "renowned", "prestigious", "humbly", "I would be honored", "invaluable opportunity", "unique opportunity", "enrich my understanding", "broaden my horizons", "align with my goals", "resonate with me", "I am confident that", "I believe I would be a great fit", "multifaceted", "holistic", "spearhead", "utilize"
- NEVER open with flattery about the professor or their lab
- NEVER use filler sentences that say nothing (e.g. "I've always been interested in science")
- NEVER volunteer information the student didn't provide — do not invent skills, courses, or experiences
- NEVER use exclamation marks more than once in the entire email
- Keep total length between 75-120 words. This is strict. Professors do not read long emails from strangers.
- Use plain, direct language. Short sentences. No compound-complex sentences.
- The email should sound like it was written by a specific human, not a template filled in with variables.

TONE: Write like a confident but respectful student. Not groveling, not arrogant. Think: "I'm genuinely interested and I have relevant experience" energy.

Subject line: Plain and specific. Format: "[Goal] inquiry — [Sender first and last name]"
Examples: "Research position inquiry — Alex Kim", "Rotation inquiry — Jordan Lee"

Return your response as valid JSON in exactly this format:
{"subject": "...", "body": "..."}`

  const userPrompt = `Write a cold email.

Lab: ${lab.name}
Lab research: ${lab.overview}

Recipient: ${member.name}${member.role ? `, ${member.role}` : ''}

About the sender:
- Name: ${profile.name}
- Academic status: ${profile.status}
- Institution: ${profile.institution}
- Research experience: ${profile.experience}
- What got them into this field: ${profile.whyField}
- Looking for: ${profile.goal}${profile.standout ? `\n- Standout detail: ${profile.standout}` : ''}
${options.instructions ? `\nAdditional instructions: ${options.instructions}` : ''}`

  return { systemPrompt, userPrompt }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Slow down and try again shortly.' }), {
      status: 429,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const admin = isAdmin(req)

  let payload: { lab?: any; member?: any; profile?: any; options?: any; stream?: boolean; mode?: string }
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Check usage mode — returns current remaining without consuming a use
  if (payload.mode === 'check-usage') {
    const t0 = performance.now()
    if (admin) {
      console.log(`[check-usage] admin shortcut ${Math.round(performance.now() - t0)}ms`)
      return new Response(JSON.stringify({ remaining: USAGE_LIMIT, limit: USAGE_LIMIT, resets_at: '' }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    const db = getDb()
    const windowStart = new Date(Math.floor(Date.now() / (WINDOW_SECONDS * 1000)) * WINDOW_SECONDS * 1000).toISOString()
    const windowEnd = new Date(Math.ceil(Date.now() / (WINDOW_SECONDS * 1000)) * WINDOW_SECONDS * 1000).toISOString()

    const { data, error } = await db
      .from('daily_usage')
      .select('count')
      .eq('ip', ip)
      .eq('window_start', windowStart)
      .maybeSingle()

    const count = error || !data ? 0 : data.count
    const remaining = Math.max(0, USAGE_LIMIT - count)
    console.log(`[check-usage] db query ${Math.round(performance.now() - t0)}ms, count=${count}`)
    return new Response(JSON.stringify({ remaining, limit: USAGE_LIMIT, resets_at: windowEnd }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Usage limit — skipped for admin (authenticated) users
  let dailyRemaining = USAGE_LIMIT
  let resetsAt = ''
  if (!admin) {
    const usage = await checkUsageLimit(ip)
    dailyRemaining = usage.remaining
    resetsAt = usage.resetsAt
    if (!usage.allowed) {
      return new Response(JSON.stringify({ error: 'Usage limit reached. Try again later!', remaining: 0, resets_at: resetsAt }), {
        status: 429,
        headers: { ...CORS, 'Content-Type': 'application/json', 'X-Daily-Remaining': '0', 'X-Resets-At': resetsAt },
      })
    }
  }

  const openrouterKey = Deno.env.get('OPENROUTER_KEY')
  if (!openrouterKey) {
    return new Response(JSON.stringify({ error: 'OPENROUTER_KEY not configured' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Profile review mode — returns feedback on profile quality before generating
  if (payload.mode === 'review-profile') {
    const { profile, lab } = payload
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Missing profile' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const lengthErr = validateLengths({
      'profile.name': profile.name,
      'profile.status': profile.status,
      'profile.institution': profile.institution,
      'profile.experience': profile.experience,
      'profile.whyField': profile.whyField,
      'profile.goal': profile.goal,
      'profile.standout': profile.standout,
      'lab.overview': lab?.overview,
    })
    if (lengthErr) {
      return new Response(JSON.stringify({ error: lengthErr }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const reviewPrompt = `You are checking whether a student's cold email profile gives an AI enough concrete material to write a convincing email. Your job is NOT to make the profile perfect — only to catch fields that are so vague the AI has nothing to work with.

Only flag a field if it FAILS this test:

- "Research experience": Fails if it has zero specifics — no tools, projects, techniques, or results. Just "I've done research" or "I'm interested in biology." PASSES if it names anything concrete.
- "What got them into this field": Fails if it's completely generic with zero personal context ("I've always loved science"). PASSES if it includes any specific reason, interest, or experience.
- "Standout detail": Fails if it's vague ("I'm a hard worker") or just repeats the experience field. PASSES if it names a specific project, skill, or result.

Do NOT flag:
- The "Goal" field — "undergrad volunteer", "rotation", "research position" are all valid. It's a position type, not a cover letter.
- Fields that are good but could theoretically be more specific.
- Whether the student's background matches the lab — the email generator handles that.
- Anything where you're thinking "could be stronger" rather than "missing info."

When in doubt, don't flag it.

${lab ? `Lab context (for reference only): ${lab.overview}` : ''}

Return your response as valid JSON: {"suggestions": [{"field": "experience", "issue": "...", "suggestion": "..."}, ...]}
If nothing clearly fails the tests above, return {"suggestions": []}.`

    const reviewUserPrompt = `Student profile:
- Name: ${profile.name}
- Academic status: ${profile.status}
- Institution: ${profile.institution}
- Research experience: ${profile.experience}
- What got them into this field: ${profile.whyField}
- Goal: ${profile.goal}${profile.standout ? `\n- Standout detail: ${profile.standout}` : ''}`

    try {
      const reviewRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://lab-emailer.app',
          'X-Title': 'Lab Emailer',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite-001',
          messages: [
            { role: 'system', content: reviewPrompt },
            { role: 'user', content: reviewUserPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 512,
        }),
      })

      if (!reviewRes.ok) {
        const errText = await reviewRes.text()
        return new Response(JSON.stringify({ error: `Review failed: ${errText}` }), {
          status: 502,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const reviewData = await reviewRes.json()
      const content = reviewData?.choices?.[0]?.message?.content
      const parsed = typeof content === 'string' ? JSON.parse(content) : content

      return new Response(JSON.stringify({ ...parsed, remaining: dailyRemaining, resets_at: resetsAt }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json', 'X-Daily-Remaining': String(dailyRemaining), 'X-Resets-At': resetsAt },
      })
    } catch (e: any) {
      return new Response(JSON.stringify({ error: `Review failed: ${e.message}` }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  }

  const { lab, member, profile, options, stream = false } = payload
  if (!lab || !member || !profile || !options) {
    return new Response(JSON.stringify({ error: 'Missing required fields: lab, member, profile, options' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const lengthErr = validateLengths({
    'profile.name': profile.name,
    'profile.status': profile.status,
    'profile.institution': profile.institution,
    'profile.experience': profile.experience,
    'profile.whyField': profile.whyField,
    'profile.goal': profile.goal,
    'profile.standout': profile.standout,
    'options.instructions': options.instructions,
    'lab.name': lab.name,
    'lab.overview': lab.overview,
    'member.name': member.name,
    'member.role': member.role,
  })
  if (lengthErr) {
    return new Response(JSON.stringify({ error: lengthErr }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { systemPrompt, userPrompt } = buildPrompt({ lab, member, profile, options })

  let orResponse: Response
  try {
    orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lab-emailer.app',
        'X-Title': 'Lab Emailer',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-lite-001',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 512,
        stream,
      }),
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: `OpenRouter request failed: ${e.message}` }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (!orResponse.ok) {
    const errText = await orResponse.text()
    return new Response(JSON.stringify({ error: `OpenRouter error: ${errText}` }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Streaming: pipe SSE chunks directly to the client
  if (stream) {
    return new Response(orResponse.body, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Daily-Remaining': String(dailyRemaining),
        'X-Resets-At': resetsAt,
      },
    })
  }

  // Non-streaming: parse and validate
  const orData = await orResponse.json()
  const content = orData?.choices?.[0]?.message?.content

  let parsed: { subject: string; body: string }
  try {
    parsed = typeof content === 'string' ? JSON.parse(content) : content
    if (!parsed.subject || !parsed.body) throw new Error('Missing subject or body in response')
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: content }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ subject: parsed.subject, body: parsed.body, remaining: dailyRemaining, resets_at: resetsAt }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json', 'X-Daily-Remaining': String(dailyRemaining), 'X-Resets-At': resetsAt },
  })
})
