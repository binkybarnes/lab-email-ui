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
  if (!accessToken) return { ok: false, error: 'No access token — sign out and sign back in' }

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
