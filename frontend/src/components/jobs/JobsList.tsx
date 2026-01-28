'use client'

import { useEffect } from 'react'
import { useJobsStore } from '@/lib/stores/jobs'
import { JobCard } from './JobCard'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { useWallet } from '@/components/WalletProvider'
import { Wallet } from 'lucide-react'

export function JobsList({ limit = 50 }: { limit?: number }) {
  const { address } = useWallet()
  const { jobs, loading, error, fetchJobs } = useJobsStore()

  useEffect(() => {
    if (!address) return
    fetchJobs(address, limit)
  }, [address, limit, fetchJobs])

  if (!address) {
    return (
      <EmptyState
        icon={<Wallet className="h-12 w-12" />}
        title="Connect Wallet"
        description="Connect your wallet to view jobs"
      />
    )
  }

  if (loading) {
    return <LoadingState message="Loading jobs..." />
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => fetchJobs(address, limit)} />
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={<Wallet className="h-12 w-12" />}
        title="No jobs found"
        description="Create your first job to get started"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}
