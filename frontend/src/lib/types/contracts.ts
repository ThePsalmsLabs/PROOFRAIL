import { z } from 'zod'

// ============================================================================
// Raw Clarity Response Types (matching contract structure exactly)
// ============================================================================

/**
 * Raw job data as returned from Clarity contract
 * Matches the structure in job-escrow.clar
 */
export const RawJobSchema = z.object({
  payer: z.string(),
  agent: z.string(),
  'input-token': z.string(),
  'max-input-amount': z.union([z.bigint(), z.number()]).transform(val => BigInt(val)),
  'agent-fee-amount': z.union([z.bigint(), z.number()]).transform(val => BigInt(val)),
  'executor-contract': z.string(),
  'executor-params': z.string(), // hex-encoded buffer
  'expiry-block': z.union([z.bigint(), z.number()]).transform(val => BigInt(val)),
  status: z.union([z.bigint(), z.number()]).transform(val => Number(val)),
  'created-at-block': z.union([z.bigint(), z.number()]).transform(val => BigInt(val)),
  'executed-at-block': z.union([z.bigint(), z.number(), z.null()]).optional().transform(val => val ? BigInt(val) : undefined),
  'receipt-hash': z.string().optional(),
  'output-amount': z.union([z.bigint(), z.number(), z.null()]).optional().transform(val => val ? BigInt(val) : undefined),
  'output-token': z.string().optional(),
  'protocol-used': z.string().optional(),
  'action-type': z.string().optional(),
  'gas-consumed': z.union([z.bigint(), z.number(), z.null()]).optional().transform(val => val ? BigInt(val) : undefined),
  'fee-paid': z.boolean(),
  'min-alex-out': z.union([z.bigint(), z.number()]).transform(val => BigInt(val)),
  'lock-period': z.union([z.bigint(), z.number()]).transform(val => BigInt(val)),
})

export type RawJob = z.infer<typeof RawJobSchema>

/**
 * Vault balance as returned from Clarity contract
 * Matches the structure in agent-vault.clar
 */
export const RawVaultBalanceSchema = z.object({
  total: z.union([z.bigint(), z.number()]).transform(val => BigInt(val)),
  available: z.union([z.bigint(), z.number()]).transform(val => BigInt(val)),
  locked: z.union([z.bigint(), z.number()]).transform(val => BigInt(val)),
})

export type RawVaultBalance = z.infer<typeof RawVaultBalanceSchema>

// ============================================================================
// Transformed UI Types (user-friendly)
// ============================================================================

/**
 * Job status enum matching contract constants
 */
export enum JobStatus {
  OPEN = 0,
  EXECUTED = 1,
  CANCELLED = 2,
  EXPIRED = 3,
}

/**
 * Transformed job type for UI consumption
 */
export interface Job {
  id: number
  payer: string
  agent: string
  inputToken: string
  maxInput: bigint
  agentFee: bigint
  executorContract: string
  executorParams: string
  expiryBlock: bigint
  status: JobStatus
  statusLabel: 'open' | 'executed' | 'cancelled' | 'expired'
  createdAt: bigint
  executedAt?: bigint
  receiptHash?: string
  outputAmount?: bigint
  outputToken?: string
  protocolUsed?: string
  actionType?: string
  gasConsumed?: bigint
  feePaid: boolean
  // Legacy fields
  minAlexOut: bigint
  lockPeriod: bigint
}

/**
 * Transformed vault balance for UI consumption
 */
export interface VaultBalance {
  total: bigint
  available: bigint
  locked: bigint
}

/**
 * Wallet connection state
 */
export interface WalletState {
  address: string | null
  isConnected: boolean
}

// ============================================================================
// Type Guards and Validators
// ============================================================================

/**
 * Validates and transforms raw job data from contract
 */
export function validateAndTransformJob(raw: unknown, jobId: number): Job {
  const parsed = RawJobSchema.parse(raw)
  
  return {
    id: jobId,
    payer: parsed.payer,
    agent: parsed.agent,
    inputToken: parsed['input-token'],
    maxInput: parsed['max-input-amount'],
    agentFee: parsed['agent-fee-amount'],
    executorContract: parsed['executor-contract'],
    executorParams: parsed['executor-params'],
    expiryBlock: parsed['expiry-block'],
    status: parsed.status as JobStatus,
    statusLabel: getStatusLabel(parsed.status),
    createdAt: parsed['created-at-block'],
    executedAt: parsed['executed-at-block'],
    receiptHash: parsed['receipt-hash'],
    outputAmount: parsed['output-amount'],
    outputToken: parsed['output-token'],
    protocolUsed: parsed['protocol-used'],
    actionType: parsed['action-type'],
    gasConsumed: parsed['gas-consumed'],
    feePaid: parsed['fee-paid'],
    minAlexOut: parsed['min-alex-out'],
    lockPeriod: parsed['lock-period'],
  }
}

/**
 * Validates and transforms raw vault balance from contract
 */
export function validateAndTransformVaultBalance(raw: unknown): VaultBalance {
  return RawVaultBalanceSchema.parse(raw)
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: number): 'open' | 'executed' | 'cancelled' | 'expired' {
  switch (status) {
    case JobStatus.OPEN:
      return 'open'
    case JobStatus.EXECUTED:
      return 'executed'
    case JobStatus.CANCELLED:
      return 'cancelled'
    case JobStatus.EXPIRED:
      return 'expired'
    default:
      return 'open'
  }
}
