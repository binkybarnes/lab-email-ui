const PROFILE_KEY = 'ai_profile'

export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const profile = JSON.parse(raw)
    // Migrate old field names
    if (profile.background && !profile.experience) {
      profile.experience = profile.background
      delete profile.background
    }
    if (profile.hook && !profile.standout) {
      profile.standout = profile.hook
      delete profile.hook
    }
    if (!profile.whyField) {
      profile.whyField = ''
    }
    return profile
  } catch {
    return null
  }
}

export function saveProfile(data) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data))
}
