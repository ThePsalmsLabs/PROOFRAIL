/**
 * Clarity Error Code Mapping
 * Maps contract error codes to user-friendly messages
 */

// Error code ranges by contract
const ERROR_RANGES = {
  AGENT_VAULT: { min: 100, max: 107 },
  JOB_ESCROW: { min: 200, max: 208 },
  JOB_ROUTER: { min: 300, max: 310 },
  ALEX_EXECUTOR: { min: 400, max: 405 },
  STAKE_REGISTRY: { min: 500, max: 507 },
} as const

/**
 * Error code to message mapping
 */
const ERROR_MESSAGES: Record<number, string> = {
  // Agent Vault (100-107)
  100: 'Unauthorized: You do not have permission to perform this action',
  101: 'Insufficient balance: You do not have enough USDCx in your vault',
  102: 'Invalid amount: The amount must be greater than zero',
  103: 'Transfer failed: The token transfer could not be completed',
  104: 'Already unlocked: This job lock has already been unlocked',
  105: 'Job lock not found: No lock exists for this job',
  106: 'Lock already exists: A lock for this job already exists',
  107: 'Amount mismatch: The amount does not match the expected value',

  // Job Escrow (200-208)
  200: 'Unauthorized: You do not have permission to perform this action',
  201: 'Job not found: The specified job does not exist',
  202: 'Invalid status: The job is not in the correct status for this operation',
  203: 'Not agent: Only the assigned agent can perform this action',
  204: 'Not payer: Only the job payer can perform this action',
  205: 'Fee already paid: The agent fee has already been claimed',
  206: 'Invalid parameters: One or more parameters are invalid',
  207: 'Expired: This job has expired and can no longer be executed',
  208: 'Token mismatch: The token does not match the job requirements',

  // Job Router (300-310)
  300: 'Job not found: The specified job does not exist',
  301: 'Invalid status: The job is not in the correct status for execution',
  302: 'Not agent: Only the assigned agent can execute this job',
  306: 'Expired: This job has expired and can no longer be executed',
  309: 'Execution failed: The job execution could not be completed',
  310: 'Executor mismatch: The executor contract does not match the job configuration',

  // ALEX Executor (400-405)
  400: 'Decode failed: Could not decode executor parameters',
  401: 'Swap failed: The token swap could not be completed',
  402: 'Stake failed: The staking operation could not be completed',
  403: 'Insufficient output: The swap output is below the minimum required',
  404: 'Invalid parameters: One or more executor parameters are invalid',
  405: 'Job not found: The specified job does not exist',

  // Stake Registry (500-507)
  500: 'Unauthorized: You do not have permission to perform this action',
  501: 'Invalid amount: The amount must be greater than zero',
  502: 'Invalid parameters: One or more parameters are invalid',
  503: 'Not found: The specified stake position does not exist',
  504: 'Locked: The stake is still locked and cannot be claimed',
  505: 'Already claimed: This stake has already been claimed',
  506: 'Not owner: You are not the owner of this stake position',
  507: 'Insufficient balance: Not enough tokens available for this operation',
}

/**
 * Custom error class for ProofRail errors
 */
export class ProofRailError extends Error {
  constructor(
    message: string,
    public code?: number,
    public contractName?: string,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'ProofRailError'
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProofRailError)
    }
  }
}

/**
 * Extracts error code from Clarity error response
 */
function extractErrorCode(error: unknown): number | null {
  if (typeof error === 'string') {
    // Try to extract error code from string like "err u200" or "(err u200)"
    const match = error.match(/\(?err\s+u?(\d+)\)?/i)
    if (match) {
      return parseInt(match[1], 10)
    }
  }

  if (error instanceof Error) {
    // Try to extract from error message
    const match = error.message.match(/\(?err\s+u?(\d+)\)?/i)
    if (match) {
      return parseInt(match[1], 10)
    }
  }

  // Check if error is an object with error code
  if (error && typeof error === 'object') {
    const errObj = error as Record<string, unknown>
    if (typeof errObj.value === 'number') {
      return errObj.value
    }
    if (typeof errObj.code === 'number') {
      return errObj.code
    }
  }

  return null
}

/**
 * Determines which contract an error code belongs to
 */
function getContractName(errorCode: number): string | undefined {
  if (errorCode >= ERROR_RANGES.AGENT_VAULT.min && errorCode <= ERROR_RANGES.AGENT_VAULT.max) {
    return 'agent-vault'
  }
  if (errorCode >= ERROR_RANGES.JOB_ESCROW.min && errorCode <= ERROR_RANGES.JOB_ESCROW.max) {
    return 'job-escrow'
  }
  if (errorCode >= ERROR_RANGES.JOB_ROUTER.min && errorCode <= ERROR_RANGES.JOB_ROUTER.max) {
    return 'job-router'
  }
  if (errorCode >= ERROR_RANGES.ALEX_EXECUTOR.min && errorCode <= ERROR_RANGES.ALEX_EXECUTOR.max) {
    return 'alex-executor'
  }
  if (errorCode >= ERROR_RANGES.STAKE_REGISTRY.min && errorCode <= ERROR_RANGES.STAKE_REGISTRY.max) {
    return 'stake-registry'
  }
  return undefined
}

/**
 * Parses a Clarity error and returns a user-friendly ProofRailError
 */
export function parseClarityError(error: unknown, context?: string): ProofRailError {
  const errorCode = extractErrorCode(error)
  
  if (errorCode !== null && ERROR_MESSAGES[errorCode]) {
    const contractName = getContractName(errorCode)
    const message = ERROR_MESSAGES[errorCode]
    const fullMessage = context ? `${context}: ${message}` : message
    
    return new ProofRailError(fullMessage, errorCode, contractName, error)
  }

  // Fallback to generic error handling
  return new ProofRailError(
    getErrorMessage(error),
    errorCode ?? undefined,
    undefined,
    error
  )
}

/**
 * Gets a user-friendly error message from any error
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ProofRailError) {
    return err.message
  }

  if (err instanceof Error) {
    return err.message
  }

  if (typeof err === 'string') {
    return err
  }

  try {
    return JSON.stringify(err)
  } catch {
    return 'An unknown error occurred'
  }
}

/**
 * Checks if an error is a specific Clarity error code
 */
export function isClarityError(error: unknown, code: number): boolean {
  const errorCode = extractErrorCode(error)
  return errorCode === code
}

/**
 * Checks if an error is a network/connection error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('failed to fetch')
    )
  }
  return false
}

/**
 * Checks if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true
  }

  // Some Clarity errors might be retryable (e.g., temporary failures)
  if (error instanceof ProofRailError) {
    // Network-related contract errors might be retryable
    return error.code === 103 || error.code === 309 // Transfer failed, Execution failed
  }  return false
}
