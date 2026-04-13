/**
 * Builds a Gmail compose URL pre-filled with recipient, subject, and body.
 * @param {{ to: string, subject?: string, body?: string }} params
 * @returns {string}
 */
export function buildGmailUrl({ to, subject = '', body = '' }) {
  const params = new URLSearchParams({ view: 'cm', to, su: subject, body })
  return `https://mail.google.com/mail/?${params.toString()}`
}
