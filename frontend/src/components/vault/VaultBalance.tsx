'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useVaultStore } from '@/lib/stores/vault'
import { Wallet, TrendingUp } from 'lucide-react'
import { formatUSDCx, formatPercentage } from '@/lib/utils/format'
import { Skeleton } from '@/components/ui/Skeleton'

interface VaultBalanceProps {
  loading?: boolean
}

export function VaultBalance({ loading }: VaultBalanceProps) {
  const { balance } = useVaultStore()
  
  const totalNum = Number(balance.total)
  const lockedNum = Number(balance.locked)
  
  const utilization = totalNum > 0 
    ? (lockedNum / totalNum) * 100 
    : 0

  if (loading) {
    return (
      <Card variant="glow" padding="lg">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-48 mb-4" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="glow" padding="lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-brand-500" />
            Vault Balance
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">
              {formatUSDCx(balance.total)}
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Total</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Available: {formatUSDCx(balance.available)}
            </span>
          </div>
        </div>

        {balance.total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">Utilization</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-50">
                {formatPercentage(utilization)}
              </span>
            </div>
            <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>Locked: {formatUSDCx(balance.locked)}</span>
              <span>Available: {formatUSDCx(balance.available)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
