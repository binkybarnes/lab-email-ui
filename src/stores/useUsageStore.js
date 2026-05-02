import { create } from 'zustand'
import { checkUsage } from '../utils/openrouter'

const useUsageStore = create((set) => ({
  remaining: null,
  limit: null,
  resetsAt: null,
  setRemaining: (remaining) => set({ remaining }),
  setResetsAt: (resetsAt) => set({ resetsAt }),
  fetch: async () => {
    const { remaining, limit, resetsAt } = await checkUsage()
    if (remaining !== null) set({ remaining })
    if (limit !== null) set({ limit })
    if (resetsAt) set({ resetsAt })
  },
}))

export default useUsageStore
