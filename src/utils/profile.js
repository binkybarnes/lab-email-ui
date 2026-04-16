const PROFILE_KEY = 'ai_profile'

export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveProfile(data) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data))
}
