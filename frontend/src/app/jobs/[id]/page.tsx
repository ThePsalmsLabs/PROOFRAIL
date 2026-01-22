'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Container } from '@/components/layout/Container'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import {
  cancelJob,
  claimStake,
  claimAgentFee,
  executeSwapStakeJob,
  getJob,
  getStakePosition,
  getUserStakeInfo,
} from '@/lib/proofrail'
import { getErrorMessage } from '@/lib/errors'
import { useWallet } from '@/components/WalletProvider'
import { formatUSDCx, formatAddress, formatBlockHeight } from '@/lib/utils/format'
import { ArrowLeft, RefreshCw, XCircle, Zap, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function statusFromNumber(status: bigint | number | undefined): 'open' | 'executed' | 'cancelled' | 'expired' {
  const num = typeof status === 'bigint' ? Number(status) : status ?? 0
  switch (num) {
    case 0: return 'open'
    case 1: return 'executed'
    case 2: return 'cancelled'
    case 3: return 'expired'
    default: return 'open'
  }
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const jobId = useMemo(() => BigInt(params.id), [params.id])
  const { address } = useWallet()
  const [job, setJob] = useState<unknown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [swapAmount, setSwapAmount] = useState('100000')
  const [stakeInfo, setStakeInfo] = useState<unknown | null>(null)
  const [stakePositions, setStakePositions] = useState<unknown[]>([])

  async function refresh() {
    if (!address) return
    setError(null)
    try {
      const j = await getJob(address, jobId)
      setJob(j ?? null)

      const info = await getUserStakeInfo(address, address)
      setStakeInfo(info ?? null)

      const infoRec = asRecord(info)
      const positionCount = (infoRec?.['position-count'] as bigint | undefined) ?? 0n
      const max = positionCount > 10n ? 10n : positionCount
      const positions = await Promise.all(
        Array.from({ length: Number(max) }, (_, i) => BigInt(i)).map(async (sid) =>
          getStakePosition(address, address, sid)
        )
      )
      setStakePositions(positions)
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Failed to load job.')
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, jobId])

  const jobRec = asRecord(job)
  const innerJob = jobRec && jobRec['type'] === 'some' ? jobRec['value'] : job
  const innerRec = asRecord(innerJob)
  const status = (innerRec?.['status'] as bigint | undefined) ?? undefined
  const payer = (innerRec?.['payer'] as string | undefined) ?? undefined
  const agent = (innerRec?.['agent'] as string | undefined) ?? undefined
  const maxInput = innerRec?.['max-input-amount'] as bigint | number | undefined
  const agentFee = innerRec?.['agent-fee-amount'] as bigint | number | undefined
  const expiryBlock = innerRec?.['expiry-block'] as bigint | number | undefined
  const protocolUsed = innerRec?.['protocol-used'] as string | undefined
  const outputAmount = innerRec?.['output-amount'] as bigint | number | undefined

  const isPayer = address && payer && address === payer
  const isAgent = address && agent && address === agent

  async function runAction(fn: () => Promise<{ txid: string }>, successMessage: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      toast.success(successMessage, {
        description: `Transaction: ${res.txid.slice(0, 8)}...`,
      })
      await refresh()
    } catch (e: unknown) {
      const message = getErrorMessage(e) || 'Transaction failed.'
      setError(message)
      toast.error('Action failed', { description: message })
    } finally {
      setBusy(false)
    }
  }

  if (!address) {
    return (
      <Container className="py-16">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-neutral-500 dark:text-neutral-400">
              Connect your wallet to view and act on jobs
            </p>
          </CardContent>
        </Card>
      </Container>
    )
  }

  if (error && !job) {
    return (
      <Container className="py-8">
        <Card variant="default" className="border-error-500">
          <CardContent className="pt-6">
            <p className="text-error-600 dark:text-error-400">{error}</p>
          </CardContent>
        </Card>
      </Container>
    )
  }

  if (!job) {
    return (
      <Container className="py-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-neutral-500 dark:text-neutral-400">Job not found</p>
          </CardContent>
        </Card>
      </Container>
    )
  }

  return (
    <Container className="py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/jobs">
          <ArrowLeft className="h-5 w-5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-50" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">
              Job #{jobId.toString()}
            </h1>
            {status !== undefined && <StatusBadge status={statusFromNumber(status)} />}
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            On-chain job details and actions
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={busy}>
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Job Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
            <CardDescription>On-chain job information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Payer</p>
                <p className="font-mono text-sm">{payer ? formatAddress(payer) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Agent</p>
                <p className="font-mono text-sm">{agent ? formatAddress(agent) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Max Input</p>
                <p className="text-sm font-medium">
                  {maxInput ? formatUSDCx(typeof maxInput === 'bigint' ? Number(maxInput) : maxInput) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Agent Fee</p>
                <p className="text-sm font-medium text-success-600 dark:text-success-400">
                  {agentFee ? formatUSDCx(typeof agentFee === 'bigint' ? Number(agentFee) : agentFee) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Expiry Block</p>
                <p className="text-sm font-medium">
                  {expiryBlock ? formatBlockHeight(typeof expiryBlock === 'bigint' ? Number(expiryBlock) : expiryBlock) : '—'}
                </p>
              </div>
              {protocolUsed && (
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Protocol</p>
                  <Badge variant="primary">{protocolUsed}</Badge>
                </div>
              )}
            </div>
            {outputAmount && (
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Output Amount</p>
                <p className="text-lg font-semibold">
                  {formatUSDCx(typeof outputAmount === 'bigint' ? Number(outputAmount) : outputAmount)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Permissioned by payer/agent roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPayer && status === 0n && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => runAction(() => cancelJob(jobId), 'Job cancelled')}
                loading={busy}
                leftIcon={<XCircle className="h-4 w-4" />}
              >
                Cancel Job
              </Button>
            )}

            {isAgent && status === 0n && (
              <div className="space-y-3 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-brand-500" />
                  <p className="text-sm font-medium">Execute Swap + Stake</p>
                </div>
                <Input
                  type="number"
                  label="Swap Amount (micro USDCx)"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  disabled={busy}
                />
                <Button
                  className="w-full"
                  onClick={() =>
                    runAction(
                      () => executeSwapStakeJob({ jobId, swapAmount: BigInt(swapAmount) }),
                      'Job executed successfully'
                    )
                  }
                  loading={busy}
                  disabled={!swapAmount}
                >
                  Execute
                </Button>
              </div>
            )}

            {isAgent && status === 1n && (
              <Button
                className="w-full"
                onClick={() => runAction(() => claimAgentFee(jobId), 'Fee claimed')}
                loading={busy}
                leftIcon={<DollarSign className="h-4 w-4" />}
              >
                Claim Agent Fee
              </Button>
            )}

            {!isPayer && !isAgent && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                You are not the payer or agent for this job
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stake Positions */}
      {stakePositions.length > 0 && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Your Stakes (ALEX)</CardTitle>
            <CardDescription>Registry view for connected wallet (first 10 positions)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stakePositions.map((pos, i) => {
                const posRec = asRecord(pos)
                const claimed = posRec?.['claimed'] === true
                return (
                  <div
                    key={i}
                    className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Stake ID: {i}</span>
                      <Badge variant={claimed ? 'default' : 'success'}>
                        {claimed ? 'Claimed' : 'Active'}
                      </Badge>
                    </div>
                    {!claimed && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => runAction(() => claimStake(BigInt(i)), 'Stake claimed')}
                        loading={busy}
                      >
                        Claim Stake
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </Container>
  )
}
