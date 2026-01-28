import { create } from 'zustand'
import type { VaultBalance } from '@/lib/types/contracts'
import { getVaultBalance } from '@/lib/proofrail'
import { getErrorMessage } from '@/lib/errors'

interface VaultState {
  balance: VaultBalance
  loading: boolean
  error: string | null
  setBalance: (balance: VaultBalance) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  refetch: (sender: string, user: string) => Promise<void>
}

export const useVaultStore = create<VaultState>((set, get) => ({
  balance: {
    total: BigInt(0),
    available: BigInt(0),
    locked: BigInt(0),
  },
  loading: false,
  error: null,
  setBalance: (balance) => set({ balance, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  refetch: async (sender: string, user: string) => {
    const { setLoading, setBalance, setError } = get()
    setLoading(true)
    setError(null)
    
    try {
      const balance = await getVaultBalance(sender, user)
      setBalance(balance)
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      console.error('Failed to fetch vault balance:', err)
    } finally {
      setLoading(false)
    }
  },
}))
