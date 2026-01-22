import { z } from 'zod'

export const depositSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
})

export const withdrawSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
})

export const jobSchema = z.object({
  agent: z.string().min(1, 'Agent address required'),
  maxInput: z.number().positive('Must be positive'),
  agentFee: z.number().positive('Must be positive'),
  minOutput: z.number().positive('Must be positive'),
  lockPeriod: z.number().min(1).max(365, 'Max 365 days'),
  expiryBlocks: z.number().min(1, 'Must be at least 1 block'),
})

export type DepositFormData = z.infer<typeof depositSchema>
export type WithdrawFormData = z.infer<typeof withdrawSchema>
export type JobFormData = z.infer<typeof jobSchema>
