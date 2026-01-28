'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { withdraw } from '@/lib/proofrail'
import { getErrorMessage } from '@/lib/errors'
import { useWallet } from '@/components/WalletProvider'
import { useVaultStore } from '@/lib/stores/vault'
import { ArrowUp, DollarSign, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'

export function WithdrawForm() {
  const { address } = useWallet()
  const { balance, refetch } = useVaultStore()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableAmount = Number(balance.available) / 1_000_000 // Convert from micro to USDCx

  const handleMax = () => {
    setAmount(availableAmount.toFixed(2))
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

    if (numAmount > availableAmount) {
      setError(`Insufficient balance. Available: ${availableAmount.toFixed(2)} USDCx`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Convert to micro units
      const microAmount = BigInt(Math.floor(numAmount * 1_000_000))
      const result = await withdraw(microAmount)
      
      toast.success(`Withdrew ${amount} USDCx`, {
        description: `Transaction: ${result.txid.slice(0, 8)}...`,
      })
      
      setAmount('')
      if (address) {
        await refetch(address, address)
      }
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      toast.error('Withdrawal failed', {
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
            Connect your wallet to withdraw
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUp className="h-5 w-5 text-brand-500" />
          Withdraw USDCx
        </CardTitle>
        <CardDescription>
          Withdraw available funds from your vault
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">Available</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-50">
                {availableAmount.toFixed(2)} USDCx
              </span>
            </div>
          </div>

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
            rightIcon={
              <button
                type="button"
                onClick={handleMax}
                className="text-brand-500 hover:text-brand-600"
                disabled={loading || availableAmount === 0}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            }
            step="0.01"
            min="0"
            max={availableAmount}
            disabled={loading}
          />

          <Button
            type="submit"
            className="w-full"
            loading={loading}
            disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableAmount}
          >
            Withdraw
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
