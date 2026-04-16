import { supabase } from '../lib/supabase'

/**
 * Check current usage without consuming a use. Returns { remaining, resetsAt }.
 */
export async function checkUsage() {
  const t0 = performance.now()
  const { data, error } = await supabase.functions.invoke('generate-email', {
    body: { mode: 'check-usage' },
  })
  console.log(`[check-usage] ${Math.round(performance.now() - t0)}ms`)

  if (error) return { remaining: null, limit: null, resetsAt: null }
  return { remaining: data.remaining, limit: data.limit ?? null, resetsAt: data.resets_at || null }
}

/**
 * Review profile quality before generating. Returns { suggestions: [...] }.
 * Each suggestion has { field, issue, suggestion }.
 */
export async function reviewProfile({ profile, lab }) {
  const { data, error } = await supabase.functions.invoke('generate-email', {
    body: { mode: 'review-profile', profile, lab },
  })

  if (error) throw new Error(error.message || 'Failed to review profile')
  // data includes { suggestions: [...], remaining: number, resets_at: string }
  return { ...data, resetsAt: data.resets_at }
}

/**
 * Non-streaming email generation. Returns { subject, body }.
 */
export async function generateEmail({ lab, member, profile, options }) {
  const { data, error } = await supabase.functions.invoke('generate-email', {
    body: { lab, member, profile, options },
  })

  if (error) throw new Error(error.message || 'Failed to generate email')
  if (!data?.subject || !data?.body) throw new Error('Unexpected response from AI')

  return { subject: data.subject, body: data.body }
}

/**
 * Streaming email generation.
 * Calls onSubject/onBody with partial text as tokens arrive.
 * Returns the final { subject, body }.
 *
 * Usage:
 *   await generateEmailStream({
 *     lab, member, profile, options,
 *     onSubject: (partial) => setSubject(partial),
 *     onBody: (partial) => setBody(partial),
 *   })
 */
export async function generateEmailStream({ lab, member, profile, options, onSubject, onBody }) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}functions/v1/generate-email`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ lab, member, profile, options, stream: true }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Failed to generate email')
  }

  // Read usage info from response headers
  const remaining = parseInt(res.headers.get('X-Daily-Remaining') ?? '', 10)
  const resetsAt = res.headers.get('X-Resets-At') || undefined

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let raw = '' // full accumulated JSON string from the model

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
      try {
        const delta = JSON.parse(line.slice(6))
        const token = delta.choices?.[0]?.delta?.content
        if (!token) continue
        raw += token
        parsePartialEmailJSON(raw, onSubject, onBody)
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  // final parse — extract first {...} block to handle markdown fences or preamble text
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match?.[0] ?? raw)
    return { subject: parsed.subject, body: parsed.body, remaining: isNaN(remaining) ? undefined : remaining, resetsAt }
  } catch {
    throw new Error('Failed to parse AI response')
  }
}

/**
 * Incrementally parse streaming JSON like {"subject": "...", "body": "..."}
 * and call onSubject/onBody with the partial string values as they grow.
 */
function parsePartialEmailJSON(raw, onSubject, onBody) {
  // Extract partial value for a given key from incomplete JSON
  const extractPartial = (key) => {
    const marker = `"${key}"`
    const keyIdx = raw.indexOf(marker)
    if (keyIdx === -1) return null

    // find the opening quote of the value: "key": "...
    //                                            ^ colon then quote
    const afterKey = raw.indexOf(':', keyIdx + marker.length)
    if (afterKey === -1) return null
    const openQuote = raw.indexOf('"', afterKey + 1)
    if (openQuote === -1) return null

    // extract everything after the opening quote, handling escapes
    let result = ''
    let i = openQuote + 1
    while (i < raw.length) {
      if (raw[i] === '\\' && i + 1 < raw.length) {
        const next = raw[i + 1]
        if (next === '"') result += '"'
        else if (next === 'n') result += '\n'
        else if (next === 't') result += '\t'
        else if (next === '\\') result += '\\'
        else result += next
        i += 2
      } else if (raw[i] === '"') {
        break // closing quote — value is complete
      } else {
        result += raw[i]
        i++
      }
    }
    return result
  }

  const subject = extractPartial('subject')
  if (subject !== null && onSubject) onSubject(subject)

  const body = extractPartial('body')
  if (body !== null && onBody) onBody(body)
}
