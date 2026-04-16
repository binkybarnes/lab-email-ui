import { supabase } from '../lib/supabase'

export async function generateEmail({ lab, member, profile, options }) {
  const { data, error } = await supabase.functions.invoke('generate-email', {
    body: { lab, member, profile, options },
  })

  if (error) throw new Error(error.message || 'Failed to generate email')
  if (!data?.subject || !data?.body) throw new Error('Unexpected response from AI')

  return { subject: data.subject, body: data.body }
}
