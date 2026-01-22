'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatUSDCx, formatAddress, formatBlockHeight } from '@/lib/utils/format'
import { ExternalLink, DollarSign, User, Clock } from 'lucide-react'
import type { Job } from '@/lib/types/contracts'

interface JobCardProps {
  job: Job
}

function DetailItem({ 
  icon, 
  label, 
  value,
  valueClassName 
}: { 
  icon: React.ReactNode
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-sm font-medium ${valueClassName || 'text-neutral-900 dark:text-neutral-50'}`}>
        {value}
      </p>
    </div>
  )
}

export function JobCard({ job }: JobCardProps) {
  const isActive = job.status === 'open'
  const isExecuted = job.status === 'executed'

  return (
    <Card 
      variant="default" 
      hoverable={isActive}
      className="group transition-all"
    >
      <CardContent className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-50">
                Job #{job.id}
              </h3>
              <StatusBadge status={job.status} />
            </div>
            {job.protocolUsed && (
              <Badge variant="primary" size="sm" className="mt-1">
                {job.protocolUsed}
              </Badge>
            )}
          </div>
          
          <Link href={`/jobs/${job.id}`}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-2 gap-4 py-4 border-y border-neutral-200 dark:border-neutral-800">
          <DetailItem
            icon={<DollarSign className="h-4 w-4" />}
            label="Max Input"
            value={formatUSDCx(job.maxInput)}
          />
          <DetailItem
            icon={<DollarSign className="h-4 w-4" />}
            label="Agent Fee"
            value={formatUSDCx(job.agentFee)}
            valueClassName="text-success-600 dark:text-success-400"
          />
          <DetailItem
            icon={<User className="h-4 w-4" />}
            label="Agent"
            value={formatAddress(job.agent)}
          />
          <DetailItem
            icon={<Clock className="h-4 w-4" />}
            label="Expires"
            value={`Block ${formatBlockHeight(job.expiryBlock)}`}
          />
        </div>

        {/* Executor Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {job.executor && (
              <Badge variant="primary" size="sm">
                {job.executor}
              </Badge>
            )}
          </div>
          
          {isExecuted && job.executedAt && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Executed at block {formatBlockHeight(job.executedAt)}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        {isActive && (
          <div className="flex gap-2 pt-2">
            <Link href={`/jobs/${job.id}`} className="flex-1">
              <Button variant="primary" size="sm" className="w-full">
                View Details
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
