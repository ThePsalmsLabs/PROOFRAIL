'use client'

import Link from 'next/link'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/Button'
import { JobsList } from '@/components/jobs/JobsList'
import { Plus } from 'lucide-react'

export default function JobsPage() {
  return (
    <Container className="py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">
            Jobs
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            View and manage your DeFi execution jobs
          </p>
        </div>
        <Link href="/jobs/create">
          <Button size="lg" leftIcon={<Plus className="h-5 w-5" />}>
            Create Job
          </Button>
        </Link>
      </div>

      {/* Jobs List */}
      <JobsList limit={50} />
    </Container>
  )
}
