'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useWallet } from '@/components/WalletProvider'
import { useVaultStore } from '@/lib/stores/vault'
import { Wallet, TrendingUp, Lock, Unlock } from 'lucide-react'
import { formatUSDCx, formatAddress } from '@/lib/utils/format'

function StatCard({ 
  label, 
  value, 
  icon 
}: { 
  label: string
  value: string
  icon: React.ReactNode 
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
      <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
        <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 truncate">{value}</p>
      </div>
    </div>
  )
}

export function WalletInfo() {
  const { address } = useWallet()
  const { balance } = useVaultStore()

  if (!address) return null

  return (
    <Card variant="elevated">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand-500" />
            Wallet Overview
          </CardTitle>
          <Badge variant="success" dot>Connected</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            label="Total" 
            value={formatUSDCx(balance.total)} 
            icon={<TrendingUp className="h-5 w-5" />} 
          />
          <StatCard 
            label="Available" 
            value={formatUSDCx(balance.available)} 
            icon={<Unlock className="h-5 w-5" />} 
          />
          <StatCard 
            label="Locked" 
            value={formatUSDCx(balance.locked)} 
            icon={<Lock className="h-5 w-5" />} 
          />
        </div>

        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            Address: <code className="font-mono text-neutral-700 dark:text-neutral-300">{formatAddress(address)}</code>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
