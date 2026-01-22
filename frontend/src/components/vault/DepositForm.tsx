'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { deposit } from '@/lib/proofrail'
import { getErrorMessage } from '@/lib/errors'
import { useWallet } from '@/components/WalletProvider'
import { useVaultStore } from '@/lib/stores/vault'
import { ArrowDown, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

const QUICK_AMOUNTS = [10, 50, 100, 500]

export function DepositForm() {
  const { address } = useWallet()
  const { refetch } = useVaultStore()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString())
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Convert to micro units (1 USDCx = 1,000,000 micro)
      const microAmount = BigInt(Math.floor(numAmount * 1_000_000))
      const result = await deposit(microAmount)
      
      toast.success(`Deposited ${amount} USDCx`, {
        description: `Transaction: ${result.txid.slice(0, 8)}...`,
      })
      
      setAmount('')
      await refetch()
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      toast.error('Deposit failed', {
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
            Connect your wallet to deposit
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDown className="h-5 w-5 text-brand-500" />
          Deposit USDCx
        </CardTitle>
        <CardDescription>
          Add funds to your vault to create and execute jobs
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="number"
            label="Amount (USDCx)"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setError(null)
            }}
            error={error || undefined}
            leftIcon={<DollarSign className="h-4 w-4" />}
            step="0.01"
            min="0"
            disabled={loading}
          />

          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((value) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAmount(value)}
                disabled={loading}
              >
                {value} USDCx
              </Button>
            ))}
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={loading}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            Deposit
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
