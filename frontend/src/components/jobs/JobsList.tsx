'use client'

import { useEffect, useState } from 'react'
import { useJobsStore } from '@/lib/stores/jobs'
import { JobCard } from './JobCard'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { getNextJobId, getJob } from '@/lib/proofrail'
import { useWallet } from '@/components/WalletProvider'
import { getErrorMessage } from '@/lib/errors'
import { Wallet } from 'lucide-react'
import type { Job } from '@/lib/types/contracts'

export function JobsList({ limit = 50 }: { limit?: number }) {
  const { address } = useWallet()
  const { jobs, loading } = useJobsStore()
  const [localJobs, setLocalJobs] = useState<Job[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) {
      setLocalJobs([])
      return
    }

    async function loadJobs() {
      if (!address) return
      setLocalLoading(true)
      setError(null)
      try {
        const nextId = await getNextJobId(address)
        const nextIdNum = Number(nextId)
        const startId = Math.max(0, nextIdNum - limit)
        
        const jobPromises = []
        for (let id = startId; id < nextIdNum; id++) {
          jobPromises.push(
            getJob(address, BigInt(id))
              .then(job => {
                if (!job || typeof job !== 'object' || Array.isArray(job)) return null
                return { ...(job as Record<string, unknown>), id } as Record<string, unknown> & { id: number }
              })
              .catch(() => null)
          )
        }
        
        const jobResults = await Promise.all(jobPromises)
        const validJobs: Job[] = jobResults
          .filter((job): job is NonNullable<typeof job> => job !== null)
          .map(job => {
            // Transform contract data to Job type
            const statusNum = typeof job.status === 'number' ? job.status : typeof job.status === 'bigint' ? Number(job.status) : 0
            return {
              id: job.id,
              payer: typeof job.payer === 'string' ? job.payer : '',
              agent: typeof job.agent === 'string' ? job.agent : '',
              inputToken: typeof job['input-token'] === 'string' ? job['input-token'] : '',
              maxInput: typeof job['max-input-amount'] === 'bigint' ? Number(job['max-input-amount']) : typeof job['max-input-amount'] === 'number' ? job['max-input-amount'] : 0,
              agentFee: typeof job['agent-fee-amount'] === 'bigint' ? Number(job['agent-fee-amount']) : typeof job['agent-fee-amount'] === 'number' ? job['agent-fee-amount'] : 0,
              expiryBlock: typeof job['expiry-block'] === 'bigint' ? Number(job['expiry-block']) : typeof job['expiry-block'] === 'number' ? job['expiry-block'] : 0,
              status: (statusNum === 0 ? 'open' : statusNum === 1 ? 'executed' : statusNum === 2 ? 'cancelled' : 'expired') as 'open' | 'executed' | 'cancelled' | 'expired',
              createdAt: typeof job['created-at-block'] === 'bigint' ? Number(job['created-at-block']) : typeof job['created-at-block'] === 'number' ? job['created-at-block'] : 0,
              executedAt: job['executed-at-block'] && typeof job['executed-at-block'] === 'bigint' ? Number(job['executed-at-block']) : job['executed-at-block'] && typeof job['executed-at-block'] === 'number' ? job['executed-at-block'] : undefined,
              executor: typeof job['executor-contract'] === 'string' ? job['executor-contract'] : undefined,
              feePaid: typeof job['fee-paid'] === 'boolean' ? job['fee-paid'] : false,
              outputAmount: job['output-amount'] && typeof job['output-amount'] === 'bigint' ? Number(job['output-amount']) : job['output-amount'] && typeof job['output-amount'] === 'number' ? job['output-amount'] : undefined,
              outputToken: typeof job['output-token'] === 'string' ? job['output-token'] : undefined,
              protocolUsed: typeof job['protocol-used'] === 'string' ? job['protocol-used'] : undefined,
              actionType: typeof job['action-type'] === 'string' ? job['action-type'] : undefined,
              gasConsumed: job['gas-consumed'] && typeof job['gas-consumed'] === 'bigint' ? Number(job['gas-consumed']) : job['gas-consumed'] && typeof job['gas-consumed'] === 'number' ? job['gas-consumed'] : undefined,
            }
          })
          .reverse() // Most recent first
        
        setLocalJobs(validJobs)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setLocalLoading(false)
      }
    }

    loadJobs()
  }, [address, limit])

  if (!address) {
    return (
      <EmptyState
        icon={<Wallet className="h-12 w-12" />}
        title="Connect Wallet"
        description="Connect your wallet to view jobs"
      />
    )
  }

  const displayJobs = localJobs.length > 0 ? localJobs : jobs
  const isLoading = localLoading || loading

  if (isLoading) {
    return <LoadingState message="Loading jobs..." />
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />
  }

  if (displayJobs.length === 0) {
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
      {displayJobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}
