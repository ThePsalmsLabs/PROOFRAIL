'use client'

import Link from 'next/link'
import { Container } from '@/components/layout/Container'
import { JobForm } from '@/components/jobs/JobForm'
import { ArrowLeft } from 'lucide-react'

export default function CreateJobPage() {
  return (
    <Container className="py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/jobs">
          <ArrowLeft className="h-5 w-5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50" />
        </Link>
        <div>
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">
            Create Job
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            Set up an automated DeFi task for an AI agent to execute
          </p>
        </div>
      </div>

      {/* Job Form */}
      <div className="max-w-3xl">
        <JobForm />
      </div>
    </Container>
  )
}
