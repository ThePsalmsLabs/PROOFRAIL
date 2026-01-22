export interface Job {
  id: number
  payer: string
  agent: string
  inputToken: string
  maxInput: number
  agentFee: number
  minOutput?: number
  lockPeriod?: number
  expiryBlock: number
  status: 'open' | 'executed' | 'cancelled' | 'expired'
  createdAt: number
  executedAt?: number
  executor?: string
  feePaid: boolean

  // UX data fields
  outputAmount?: number
  outputToken?: string
  protocolUsed?: string
  actionType?: string
  gasConsumed?: number
}

export interface VaultBalance {
  total: number
  available: number
  locked: number
}

export interface WalletState {
  address: string | null
  isConnected: boolean
}
