import { create } from 'zustand'
import type { Job } from '@/lib/types/contracts'

interface JobsState {
  jobs: Job[]
  loading: boolean
  fetchJobs: () => Promise<void>
  addJob: (job: Job) => void
  updateJob: (id: number, updates: Partial<Job>) => void
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: [],
  loading: false,
  fetchJobs: async () => {
    set({ loading: true })
    // TODO: Implement actual fetch from contract
    // This will be integrated with existing proofrail.ts functions
    setTimeout(() => {
      set({ loading: false })
    }, 1000)
  },
  addJob: (job) => set((state) => ({ jobs: [job, ...state.jobs] })),
  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...updates } : job)),
    })),
}))
