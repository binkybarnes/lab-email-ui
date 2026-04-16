import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Leaky bucket rate limiter: 1 token drips every 2s, bucket holds 20.
// Normal usage (even rapid bursts of 10-15 emails) is fine.
// Sustained scripted spam (>20 in quick succession with no pause) gets blocked.
const buckets = new Map<string, { tokens: number; lastDrip: number }>()
const BUCKET_MAX = 20
const DRIP_INTERVAL = 2_000 // 1 token every 2 seconds

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  let bucket = buckets.get(ip)
  if (!bucket) {
    buckets.set(ip, { tokens: BUCKET_MAX - 1, lastDrip: now })
    return false
  }
  // drip tokens back in
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function buildPrompt({ lab, member, profile, options }: {
  lab: { name: string; overview: string }
  member: { name: string; role: string }
  profile: { name: string; status: string; institution: string; background: string; goal: string; hook?: string }
  options: { tone: string; length: string; instructions?: string }
}) {
  const lengthGuide: Record<string, string> = {
    Short: '~75 words total',
    Medium: '~150 words total',
    Long: '~250 words total',
  }

  const toneGuide: Record<string, string> = {
    Formal: 'professional but not stiff — clear and direct, no slang',
    Casual: 'conversational, shorter sentences, natural phrasing',
    Enthusiastic: 'genuine interest and energy, still grounded — not cringe or over-the-top',
  }

  const systemPrompt = `You are writing a cold email from a student or researcher to a PI or lab member.

RULES — follow exactly:
- Do NOT use any of these phrases: "I wanted to reach out", "I hope this email finds you well", "I am excited to", "I am writing to", "delve", "leverage", "passionate about", "keen", "touch base", "Best regards", "Warm regards", "I look forward to hearing from you", "synergy", "innovative"
- Do NOT open with a filler or pleasantry sentence
- Do NOT include generic praise like "Your lab does impressive work" or "I have long admired your research"
- Open with ONE specific sentence that connects the sender's background to the lab's actual research (use the lab overview provided)
- State the ask clearly within the first two sentences
- Include the personal hook if provided — it should feel natural, not forced
- Sign off with ONLY the sender's first name on its own line — nothing else (no "Best", no "Sincerely")
- Subject line: plain and specific, e.g. "Rotation inquiry — Alex Kim" or "PhD position inquiry — Alex Kim"

Tone: ${options.tone} — ${toneGuide[options.tone] ?? 'professional and direct'}
Length: ${lengthGuide[options.length] ?? '~150 words total'}

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
- Research background: ${profile.background}
- Looking for: ${profile.goal}${profile.hook ? `\n- Personal hook: ${profile.hook}` : ''}
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

  const openrouterKey = Deno.env.get('OPENROUTER_KEY')
  if (!openrouterKey) {
    return new Response(JSON.stringify({ error: 'OPENROUTER_KEY not configured' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let payload: { lab: any; member: any; profile: any; options: any; stream?: boolean }
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { lab, member, profile, options, stream = false } = payload
  if (!lab || !member || !profile || !options) {
    return new Response(JSON.stringify({ error: 'Missing required fields: lab, member, profile, options' }), {
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
        model: 'openrouter/elephant-alpha',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
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

  return new Response(JSON.stringify({ subject: parsed.subject, body: parsed.body }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
