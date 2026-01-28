import { create } from 'zustand'
import type { Job } from '@/lib/types/contracts'
import { getNextJobId, getJob } from '@/lib/proofrail'
import { getErrorMessage } from '@/lib/errors'

interface JobsState {
  jobs: Job[]
  loading: boolean
  error: string | null
  fetchJobs: (sender: string, limit?: number) => Promise<void>
  addJob: (job: Job) => void
  updateJob: (id: number, updates: Partial<Job>) => void
  clearError: () => void
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  loading: false,
  error: null,
  fetchJobs: async (sender: string, limit = 50) => {
    const { setLoading, setError } = get()
    setLoading(true)
    setError(null)
    
    try {
      const nextId = await getNextJobId(sender)
      const nextIdNum = Number(nextId)
      const startId = Math.max(0, nextIdNum - limit)
      
      // Batch fetch jobs in parallel
      const jobPromises: Promise<Job | null>[] = []
      for (let id = startId; id < nextIdNum; id++) {
        jobPromises.push(
          getJob(sender, BigInt(id))
            .catch(() => null) // Silently skip failed fetches (job might not exist)
        )
      }
      
      const jobResults = await Promise.all(jobPromises)
      const validJobs = jobResults.filter((job): job is Job => job !== null)
      
      // Sort by ID descending (most recent first)
      validJobs.sort((a, b) => b.id - a.id)
      
      set({ jobs: validJobs, error: null })
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoading(false)
    }
  },
  addJob: (job) => set((state) => ({ 
    jobs: [job, ...state.jobs.filter(j => j.id !== job.id)],
    error: null 
  })),
  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...updates } : job)),
      error: null,
    })),
  clearError: () => set({ error: null }),
}))
