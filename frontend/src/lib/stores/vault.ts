import { create } from 'zustand'
import type { VaultBalance } from '@/lib/types/contracts'

interface VaultState {
  balance: VaultBalance
  loading: boolean
  setBalance: (balance: VaultBalance) => void
  setLoading: (loading: boolean) => void
  refetch: () => Promise<void>
}

export const useVaultStore = create<VaultState>((set, get) => ({
  balance: {
    total: 0,
    available: 0,
    locked: 0,
  },
  loading: false,
  setBalance: (balance) => set({ balance }),
  setLoading: (loading) => set({ loading }),
  refetch: async () => {
    // TODO: Implement actual fetch from contract
    // This will be integrated with existing proofrail.ts functions
    console.log('Refetching vault balance...')
  },
}))
