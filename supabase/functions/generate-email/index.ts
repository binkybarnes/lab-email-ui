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
  profile: { name: string; status: string; institution: string; experience: string; whyField: string; goal: string; standout?: string }
  options: { instructions?: string }
}) {
  const systemPrompt = `You are ghostwriting a cold email from a real student to a professor or lab member. The email must read like a human student typed it on their laptop in 10 minutes — not like a language model produced it.

STRUCTURE — follow this order exactly:
1. First sentence: State who you are (name, year, institution) and what you want. Be direct. Example: "I'm Alex, a third-year biochem major at UCSD, and I'm looking for a research position in your lab."
2. Second paragraph (2-3 sentences): Why YOU. What got you into this field? What have you worked on that's relevant? Be specific — name a technique, a class project, a result, a question that keeps you up at night. This is the core of the email.
3. Third paragraph (1-2 sentences): Why THIS LAB specifically. Connect your interests to their research using the lab overview provided. Do NOT just restate their research back to them — explain why it matters to you or how it connects to what you've done.
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
        model: 'google/gemini-2.0-flash-lite-001',
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
