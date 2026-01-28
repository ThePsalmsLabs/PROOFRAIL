'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { createJob } from '@/lib/proofrail'
import { getErrorMessage } from '@/lib/errors'
import { useWallet } from '@/components/WalletProvider'
import { Zap, DollarSign, User, Settings } from 'lucide-react'
import { toast } from 'sonner'

export function JobForm() {
  const router = useRouter()
  const { address } = useWallet()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    agent: '',
    maxInput: '',
    agentFee: '',
    minAlexOut: '',
    lockPeriod: '32',
    expiryBlocks: '500',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.agent.trim()) {
      newErrors.agent = 'Agent address is required'
    } else if (!formData.agent.startsWith('ST') && !formData.agent.startsWith('SP')) {
      newErrors.agent = 'Invalid Stacks address format'
    }
    
    const maxInput = parseFloat(formData.maxInput)
    if (!formData.maxInput || isNaN(maxInput) || maxInput <= 0) {
      newErrors.maxInput = 'Must be a positive number'
    }
    
    const agentFee = parseFloat(formData.agentFee)
    if (!formData.agentFee || isNaN(agentFee) || agentFee <= 0) {
      newErrors.agentFee = 'Must be a positive number'
    }
    
    const minAlexOut = parseFloat(formData.minAlexOut)
    if (!formData.minAlexOut || isNaN(minAlexOut) || minAlexOut <= 0) {
      newErrors.minAlexOut = 'Must be a positive number'
    }
    
    const lockPeriod = parseInt(formData.lockPeriod)
    if (!formData.lockPeriod || isNaN(lockPeriod) || lockPeriod < 1 || lockPeriod > 365) {
      newErrors.lockPeriod = 'Must be between 1 and 365 days'
    }
    
    const expiryBlocks = parseInt(formData.expiryBlocks)
    if (!formData.expiryBlocks || isNaN(expiryBlocks) || expiryBlocks < 1) {
      newErrors.expiryBlocks = 'Must be at least 1 block'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    if (!validate()) {
      toast.error('Please fix the errors in the form')
      return
    }

    setLoading(true)

    try {
      const result = await createJob({
        agent: formData.agent.trim(),
        maxInput: BigInt(Math.floor(parseFloat(formData.maxInput) * 1_000_000)),
        agentFee: BigInt(Math.floor(parseFloat(formData.agentFee) * 1_000_000)),
        minAlexOut: BigInt(Math.floor(parseFloat(formData.minAlexOut) * 1_000_000)),
        lockPeriod: BigInt(parseInt(formData.lockPeriod)),
        expiryBlocks: BigInt(parseInt(formData.expiryBlocks)),
      })
      
      toast.success('Job created successfully', {
        description: `Transaction: ${result.txid.slice(0, 8)}...`,
      })
      
      router.push('/jobs')
    } catch (err) {
      const message = getErrorMessage(err)
      toast.error('Failed to create job', {
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }

  if (!address) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-neutral-500 dark:text-neutral-400">
            Connect your wallet to create a job
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-brand-500" />
          Create New Job
        </CardTitle>
        <CardDescription>
          Set up an automated DeFi task for an AI agent to execute
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Agent Configuration */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">
                Agent Configuration
              </h3>
            </div>

            <Input
              label="Agent Address"
              placeholder="ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
              value={formData.agent}
              onChange={(e) => {
                setFormData({ ...formData, agent: e.target.value })
                setErrors({ ...errors, agent: '' })
              }}
              error={errors.agent}
              helperText="Stacks principal address of the authorized agent"
            />
          </section>

          {/* Budget Configuration */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">
                Budget Configuration
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="number"
                label="Max Input (USDCx)"
                placeholder="25.00"
                value={formData.maxInput}
                onChange={(e) => {
                  setFormData({ ...formData, maxInput: e.target.value })
                  setErrors({ ...errors, maxInput: '' })
                }}
                error={errors.maxInput}
                helperText="Maximum USDCx to spend"
                step="0.01"
                min="0"
              />

              <Input
                type="number"
                label="Agent Fee (USDCx)"
                placeholder="1.00"
                value={formData.agentFee}
                onChange={(e) => {
                  setFormData({ ...formData, agentFee: e.target.value })
                  setErrors({ ...errors, agentFee: '' })
                }}
                error={errors.agentFee}
                helperText="Fee paid to agent on success"
                step="0.01"
                min="0"
              />
            </div>
          </section>

          {/* Execution Parameters */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">
                Execution Parameters
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                type="number"
                label="Min Output (ALEX)"
                placeholder="1000"
                value={formData.minAlexOut}
                onChange={(e) => {
                  setFormData({ ...formData, minAlexOut: e.target.value })
                  setErrors({ ...errors, minAlexOut: '' })
                }}
                error={errors.minAlexOut}
                helperText="Minimum ALEX tokens"
                min="0"
              />

              <Input
                type="number"
                label="Lock Period (days)"
                placeholder="32"
                value={formData.lockPeriod}
                onChange={(e) => {
                  setFormData({ ...formData, lockPeriod: e.target.value })
                  setErrors({ ...errors, lockPeriod: '' })
                }}
                error={errors.lockPeriod}
                helperText="Staking lock duration"
                min="1"
                max="365"
              />

              <Input
                type="number"
                label="Expires In (blocks)"
                placeholder="500"
                value={formData.expiryBlocks}
                onChange={(e) => {
                  setFormData({ ...formData, expiryBlocks: e.target.value })
                  setErrors({ ...errors, expiryBlocks: '' })
                }}
                error={errors.expiryBlocks}
                helperText="≈ 500 blocks = 83 hrs"
                min="1"
              />
            </div>
          </section>

          {/* Executor Info */}
          <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Executor Module
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                ALEX Swap + Stake Executor
              </p>
            </div>
            <Badge variant="primary">ALEX</Badge>
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={loading}
            size="lg"
          >
            Create Job
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
