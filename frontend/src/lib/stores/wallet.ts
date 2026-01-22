import { create } from 'zustand'

interface WalletState {
  address: string | null
  isConnected: boolean
  setWallet: (data: { address: string; isConnected: boolean }) => void
  disconnect: () => void
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  isConnected: false,
  setWallet: (data) => set(data),
  disconnect: () => set({ address: null, isConnected: false }),
}))
