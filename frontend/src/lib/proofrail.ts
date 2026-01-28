import { Cl, ClarityValue, cvToValue, intCV } from "@stacks/transactions";
import { CONTRACTS, contractId } from "./proofrail-config";
import { callReadOnly } from "./read-only";
import { callContract } from "./wallet";
import { 
  type Job, 
  type VaultBalance,
  type PriceData,
  type TWAPData,
  type BridgeRequest,
  type ChainConfig,
  validateAndTransformJob, 
  validateAndTransformVaultBalance 
} from "./types/contracts";
import { parseClarityError } from "./errors";

export type JsonClarity =
  | null
  | boolean
  | number
  | string
  | bigint
  | JsonClarity[]
  | { [key: string]: JsonClarity };

export const cv = {
  usdcx: () => Cl.contractPrincipal(CONTRACTS.usdcx.address, CONTRACTS.usdcx.name),
  alex: () => Cl.contractPrincipal(CONTRACTS.alex.address, CONTRACTS.alex.name),
  swapHelper: () => Cl.contractPrincipal(CONTRACTS.swap.address, CONTRACTS.swap.name),
  alexStaking: () => Cl.contractPrincipal(CONTRACTS.staking.address, CONTRACTS.staking.name),
};

/**
 * Get vault balance for a user with validation
 */
export async function getVaultBalance(sender: string, user: string): Promise<VaultBalance> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.vault.address,
      contractName: CONTRACTS.vault.name,
      functionName: "get-balance",
      functionArgs: [Cl.principal(user)],
      senderAddress: sender,
    });
    const raw = cvToValue(result);
    return validateAndTransformVaultBalance(raw);
  } catch (error) {
    throw parseClarityError(error, "Failed to get vault balance");
  }
}

/**
 * Get the next job ID (nonce)
 */
export async function getNextJobId(sender: string): Promise<bigint> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.escrow.address,
      contractName: CONTRACTS.escrow.name,
      functionName: "get-next-job-id",
      functionArgs: [],
      senderAddress: sender,
    });
    const value = cvToValue(result);
    return typeof value === 'bigint' ? value : BigInt(value as number);
  } catch (error) {
    throw parseClarityError(error, "Failed to get next job ID");
  }
}

/**
 * Get a job by ID with validation and transformation
 */
export async function getJob(sender: string, jobId: bigint): Promise<Job | null> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.escrow.address,
      contractName: CONTRACTS.escrow.name,
      functionName: "get-job",
      functionArgs: [Cl.uint(jobId)],
      senderAddress: sender,
    });
    const raw = cvToValue(result);
    
    // Handle optional response (returns none if job doesn't exist)
    if (raw === null || (typeof raw === 'object' && !('payer' in raw))) {
      return null;
    }
    
    return validateAndTransformJob(raw, Number(jobId));
  } catch (error) {
    throw parseClarityError(error, `Failed to get job ${jobId}`);
  }
}

export async function getUserStakeInfo(sender: string, user: string): Promise<JsonClarity> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.registry.address,
      contractName: CONTRACTS.registry.name,
      functionName: "get-user-stake-info",
      functionArgs: [Cl.principal(user), cv.alex()],
      senderAddress: sender,
    });
    return cvToValue(result) as JsonClarity;
  } catch (error) {
    throw parseClarityError(error, "Failed to get user stake info");
  }
}

export async function getStakePosition(sender: string, user: string, stakeId: bigint): Promise<JsonClarity> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.registry.address,
      contractName: CONTRACTS.registry.name,
      functionName: "get-stake-position",
      functionArgs: [Cl.principal(user), cv.alex(), Cl.uint(stakeId)],
      senderAddress: sender,
    });
    return cvToValue(result) as JsonClarity;
  } catch (error) {
    throw parseClarityError(error, `Failed to get stake position ${stakeId}`);
  }
}

export async function deposit(amount: bigint) {
  try {
    return await callContract({
      contract: contractId(CONTRACTS.vault),
      functionName: "deposit",
      functionArgs: [cv.usdcx(), Cl.uint(amount)],
    });
  } catch (error) {
    throw parseClarityError(error, "Failed to deposit USDCx");
  }
}

export async function withdraw(amount: bigint) {
  try {
    return await callContract({
      contract: contractId(CONTRACTS.vault),
      functionName: "withdraw",
      functionArgs: [cv.usdcx(), Cl.uint(amount)],
    });
  } catch (error) {
    throw parseClarityError(error, "Failed to withdraw USDCx");
  }
}

export async function createJob(params: {
  agent: string;
  maxInput: bigint;
  agentFee: bigint;
  minAlexOut: bigint;
  lockPeriod: bigint;
  expiryBlocks: bigint;
}) {
  try {
    return await callContract({
      contract: contractId(CONTRACTS.escrow),
      functionName: "create-job",
      functionArgs: [
        cv.usdcx(),
        Cl.principal(params.agent),
        Cl.uint(params.maxInput),
        Cl.uint(params.agentFee),
        Cl.uint(params.minAlexOut),
        Cl.uint(params.lockPeriod),
        Cl.uint(params.expiryBlocks),
      ],
    });
  } catch (error) {
    throw parseClarityError(error, "Failed to create job");
  }
}

export async function cancelJob(jobId: bigint) {
  try {
    return await callContract({
      contract: contractId(CONTRACTS.escrow),
      functionName: "cancel-job",
      functionArgs: [Cl.uint(jobId)],
    });
  } catch (error) {
    throw parseClarityError(error, `Failed to cancel job ${jobId}`);
  }
}

export async function claimAgentFee(jobId: bigint) {
  try {
    return await callContract({
      contract: contractId(CONTRACTS.escrow),
      functionName: "claim-fee",
      functionArgs: [Cl.uint(jobId), cv.usdcx()],
    });
  } catch (error) {
    throw parseClarityError(error, `Failed to claim agent fee for job ${jobId}`);
  }
}

export async function executeSwapStakeJob(params: { jobId: bigint; swapAmount: bigint }) {
  try {
    return await callContract({
      contract: contractId(CONTRACTS.router),
      functionName: "execute-swap-stake-job",
      functionArgs: [
        Cl.uint(params.jobId),
        cv.usdcx(),
        cv.alex(),
        cv.swapHelper(),
        cv.alexStaking(),
        Cl.uint(CONTRACTS.factor),
        Cl.uint(params.swapAmount),
      ],
    });
  } catch (error) {
    throw parseClarityError(error, `Failed to execute job ${params.jobId}`);
  }
}

export async function claimStake(stakeId: bigint) {
  try {
    return await callContract({
      contract: contractId(CONTRACTS.registry),
      functionName: "claim-stake",
      functionArgs: [cv.alex(), cv.alexStaking(), Cl.uint(stakeId)],
    });
  } catch (error) {
    throw parseClarityError(error, `Failed to claim stake ${stakeId}`);
  }
}

export function clarityToJson(value: ClarityValue) {
  return cvToValue(value, true) as JsonClarity;
}

// ============================================================================
// Price Oracle Functions (Pyth Network)
// ============================================================================

/**
 * Get current price for a token pair
 */
export async function getCurrentPrice(
  sender: string,
  baseToken: string,
  quoteToken: string,
  price: bigint,
  confidenceInterval: bigint,
  publishTime: number,
  expo: number
): Promise<PriceData> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.pythOracle.address,
      contractName: CONTRACTS.pythOracle.name,
      functionName: "get-current-price",
      functionArgs: [
        Cl.principal(baseToken),
        Cl.principal(quoteToken),
        Cl.uint(price),
        Cl.uint(confidenceInterval),
        Cl.uint(publishTime),
        intCV(expo),
      ],
      senderAddress: sender,
    });
    const raw = cvToValue(result);
    return {
      price: typeof raw.price === 'bigint' ? raw.price : BigInt(raw.price as number),
      confidenceInterval: typeof raw['confidence-interval'] === 'bigint' 
        ? raw['confidence-interval'] 
        : BigInt(raw['confidence-interval'] as number),
      publishBlock: typeof raw['publish-block'] === 'bigint' 
        ? Number(raw['publish-block']) 
        : Number(raw['publish-block']),
      expo: typeof raw.expo === 'number' ? raw.expo : Number(raw.expo),
    };
  } catch (error) {
    throw parseClarityError(error, `Failed to get price for ${baseToken}/${quoteToken}`);
  }
}

/**
 * Validate price for execution
 */
export async function validatePriceForExecution(
  sender: string,
  baseToken: string,
  quoteToken: string,
  minPrice: bigint,
  maxPrice: bigint,
  price: bigint,
  confidenceInterval: bigint,
  publishTime: number,
  expo: number
): Promise<{ price: bigint; confidence: bigint; validatedAtBlock: number }> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.pythOracle.address,
      contractName: CONTRACTS.pythOracle.name,
      functionName: "validate-price-for-execution",
      functionArgs: [
        Cl.principal(baseToken),
        Cl.principal(quoteToken),
        Cl.uint(minPrice),
        Cl.uint(maxPrice),
        Cl.uint(price),
        Cl.uint(confidenceInterval),
        Cl.uint(publishTime),
        intCV(expo),
      ],
      senderAddress: sender,
    });
    const raw = cvToValue(result);
    return {
      price: typeof raw.price === 'bigint' ? raw.price : BigInt(raw.price as number),
      confidence: typeof raw.confidence === 'bigint' ? raw.confidence : BigInt(raw.confidence as number),
      validatedAtBlock: typeof raw['validated-at-block'] === 'bigint' 
        ? Number(raw['validated-at-block']) 
        : Number(raw['validated-at-block']),
    };
  } catch (error) {
    throw parseClarityError(error, `Failed to validate price for ${baseToken}/${quoteToken}`);
  }
}

/**
 * Get TWAP for a token pair
 */
export async function getTWAP(
  sender: string,
  baseToken: string,
  quoteToken: string
): Promise<TWAPData> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.pythOracle.address,
      contractName: CONTRACTS.pythOracle.name,
      functionName: "get-twap",
      functionArgs: [Cl.principal(baseToken), Cl.principal(quoteToken)],
      senderAddress: sender,
    });
    const raw = cvToValue(result);
    return {
      twap: typeof raw.twap === 'bigint' ? raw.twap : BigInt(raw.twap as number),
      lastUpdate: typeof raw['last-update'] === 'bigint' 
        ? raw['last-update'] 
        : BigInt(raw['last-update'] as number),
      samples: typeof raw.samples === 'bigint' ? raw.samples : BigInt(raw.samples as number),
    };
  } catch (error) {
    throw parseClarityError(error, `Failed to get TWAP for ${baseToken}/${quoteToken}`);
  }
}

// ============================================================================
// Bridge Functions (Circle xReserve / CCTP)
// ============================================================================

/**
 * Initiate a bridge request
 */
export async function initiateBridgeRequest(
  sourceChain: number,
  amount: bigint,
  destination: string
) {
  try {
    return await callContract({
      contract: contractId(CONTRACTS.bridgeAdapter),
      functionName: "initiate-bridge-request",
      functionArgs: [
        Cl.uint(sourceChain),
        Cl.uint(amount),
        Cl.principal(destination),
      ],
    });
  } catch (error) {
    throw parseClarityError(error, "Failed to initiate bridge request");
  }
}

/**
 * Bridge and auto-deposit to vault
 */
export async function bridgeAndDeposit(
  sourceChain: number,
  amount: bigint
) {
  try {
    return await callContract({
      contract: contractId(CONTRACTS.bridgeAdapter),
      functionName: "bridge-and-deposit",
      functionArgs: [
        Cl.uint(sourceChain),
        Cl.uint(amount),
        cv.usdcx(),
      ],
    });
  } catch (error) {
    throw parseClarityError(error, "Failed to bridge and deposit");
  }
}

/**
 * Get bridge request details
 */
export async function getBridgeRequest(
  sender: string,
  requestId: bigint
): Promise<BridgeRequest | null> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.bridgeAdapter.address,
      contractName: CONTRACTS.bridgeAdapter.name,
      functionName: "get-bridge-request",
      functionArgs: [Cl.uint(requestId)],
      senderAddress: sender,
    });
    const raw = cvToValue(result);
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    return {
      id: Number(requestId),
      user: raw.user as string,
      sourceChain: typeof raw['source-chain'] === 'bigint' 
        ? Number(raw['source-chain']) 
        : Number(raw['source-chain']),
      destination: raw.destination as string,
      amount: typeof raw.amount === 'bigint' ? raw.amount : BigInt(raw.amount as number),
      status: typeof raw.status === 'bigint' ? Number(raw.status) : Number(raw.status),
      createdAtBlock: typeof raw['created-at-block'] === 'bigint' 
        ? raw['created-at-block'] 
        : BigInt(raw['created-at-block'] as number),
      completedAtBlock: raw['completed-at-block'] 
        ? (typeof raw['completed-at-block'] === 'bigint' 
          ? raw['completed-at-block'] 
          : BigInt(raw['completed-at-block'] as number))
        : undefined,
      sourceTxHash: raw['source-tx-hash'] as string | undefined,
    };
  } catch (error) {
    throw parseClarityError(error, `Failed to get bridge request ${requestId}`);
  }
}

/**
 * Calculate bridge fee
 */
export async function calculateBridgeFee(
  sender: string,
  amount: bigint
): Promise<bigint> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.bridgeAdapter.address,
      contractName: CONTRACTS.bridgeAdapter.name,
      functionName: "calculate-bridge-fee",
      functionArgs: [Cl.uint(amount)],
      senderAddress: sender,
    });
    const value = cvToValue(result);
    return typeof value === 'bigint' ? value : BigInt(value as number);
  } catch (error) {
    throw parseClarityError(error, "Failed to calculate bridge fee");
  }
}

/**
 * Get supported chains for bridging
 */
export async function getSupportedChains(sender: string): Promise<ChainConfig[]> {
  try {
    const result = await callReadOnly({
      contractAddress: CONTRACTS.bridgeAdapter.address,
      contractName: CONTRACTS.bridgeAdapter.name,
      functionName: "get-supported-chains",
      functionArgs: [],
      senderAddress: sender,
    });
    const chains = cvToValue(result) as Array<{ domain: bigint | number; name: string }>;
    return chains.map(chain => ({
      domain: typeof chain.domain === 'bigint' ? Number(chain.domain) : chain.domain,
      name: chain.name,
      enabled: true,
      minAmount: BigInt(100000),
      maxAmount: BigInt(1000000000000),
    }));
  } catch (error) {
    throw parseClarityError(error, "Failed to get supported chains");
  }
}

