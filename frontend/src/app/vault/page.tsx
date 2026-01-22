'use client'

import { useEffect } from 'react'
import { Container } from '@/components/layout/Container'
import { WalletInfo } from '@/components/wallet/WalletInfo'
import { VaultBalance } from '@/components/vault/VaultBalance'
import { DepositForm } from '@/components/vault/DepositForm'
import { WithdrawForm } from '@/components/vault/WithdrawForm'
import { useWallet } from '@/components/WalletProvider'
import { useVaultStore } from '@/lib/stores/vault'
import { getVaultBalance } from '@/lib/proofrail'
import { getErrorMessage } from '@/lib/errors'
import { EmptyState } from '@/components/shared/EmptyState'
import { Wallet } from 'lucide-react'

export default function VaultPage() {
  const { address } = useWallet()
  const { balance, loading, setBalance, setLoading } = useVaultStore()

  useEffect(() => {
    if (!address) {
      setBalance({ total: 0, available: 0, locked: 0 })
      return
    }

    async function loadBalance() {
      if (!address) return
      setLoading(true)
      try {
        const result = await getVaultBalance(address, address)
        if (result && typeof result === 'object' && !Array.isArray(result) && 'total' in result) {
          const total = typeof result.total === 'bigint' ? Number(result.total) : typeof result.total === 'number' ? result.total : 0
          const available = typeof result.available === 'bigint' ? Number(result.available) : typeof result.available === 'number' ? result.available : 0
          const locked = typeof result.locked === 'bigint' ? Number(result.locked) : typeof result.locked === 'number' ? result.locked : 0
          setBalance({ total, available, locked })
        }
      } catch (err) {
        console.error('Failed to load vault balance:', getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }

    loadBalance()
  }, [address, setBalance, setLoading])

  if (!address) {
    return (
      <Container className="py-16">
        <EmptyState
          icon={<Wallet className="h-16 w-16" />}
          title="Connect Your Wallet"
          description="Connect your Stacks wallet to access your agent vault"
        />
      </Container>
    )
  }

  return (
    <Container className="py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">
          Agent Vault
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Manage your USDCx budget for AI agent executions
        </p>
      </div>

      {/* Wallet Info */}
      <WalletInfo />

      {/* Vault Balance */}
      <VaultBalance loading={loading} />

      {/* Deposit and Withdraw Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DepositForm />
        <WithdrawForm />
      </div>
    </Container>
  )
}
