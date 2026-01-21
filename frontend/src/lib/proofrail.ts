import { Cl, ClarityValue, cvToValue } from "@stacks/transactions";
import { CONTRACTS, contractId } from "./proofrail-config";
import { callReadOnly } from "./read-only";
import { callContract } from "./wallet";

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

export async function getVaultBalance(sender: string, user: string) {
  const result = await callReadOnly({
    contractAddress: CONTRACTS.vault.address,
    contractName: CONTRACTS.vault.name,
    functionName: "get-balance",
    functionArgs: [Cl.principal(user)],
    senderAddress: sender,
  });
  // Returns (response {total, available, locked} uint)
  return cvToValue(result) as JsonClarity;
}

export async function getNextJobId(sender: string) {
  const result = await callReadOnly({
    contractAddress: CONTRACTS.escrow.address,
    contractName: CONTRACTS.escrow.name,
    functionName: "get-next-job-id",
    functionArgs: [],
    senderAddress: sender,
  });
  return cvToValue(result) as bigint;
}

export async function getJob(sender: string, jobId: bigint) {
  const result = await callReadOnly({
    contractAddress: CONTRACTS.escrow.address,
    contractName: CONTRACTS.escrow.name,
    functionName: "get-job",
    functionArgs: [Cl.uint(jobId)],
    senderAddress: sender,
  });
  return cvToValue(result) as JsonClarity; // (optional { ... })
}

export async function getUserStakeInfo(sender: string, user: string) {
  const result = await callReadOnly({
    contractAddress: CONTRACTS.registry.address,
    contractName: CONTRACTS.registry.name,
    functionName: "get-user-stake-info",
    functionArgs: [Cl.principal(user), cv.alex()],
    senderAddress: sender,
  });
  return cvToValue(result) as JsonClarity;
}

export async function getStakePosition(sender: string, user: string, stakeId: bigint) {
  const result = await callReadOnly({
    contractAddress: CONTRACTS.registry.address,
    contractName: CONTRACTS.registry.name,
    functionName: "get-stake-position",
    functionArgs: [Cl.principal(user), cv.alex(), Cl.uint(stakeId)],
    senderAddress: sender,
  });
  return cvToValue(result) as JsonClarity;
}

export async function deposit(amount: bigint) {
  return callContract({
    contract: contractId(CONTRACTS.vault),
    functionName: "deposit",
    functionArgs: [cv.usdcx(), Cl.uint(amount)],
  });
}

export async function withdraw(amount: bigint) {
  return callContract({
    contract: contractId(CONTRACTS.vault),
    functionName: "withdraw",
    functionArgs: [cv.usdcx(), Cl.uint(amount)],
  });
}

export async function createJob(params: {
  agent: string;
  maxInput: bigint;
  agentFee: bigint;
  minAlexOut: bigint;
  lockPeriod: bigint;
  expiryBlocks: bigint;
}) {
  return callContract({
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
}

export async function cancelJob(jobId: bigint) {
  return callContract({
    contract: contractId(CONTRACTS.escrow),
    functionName: "cancel-job",
    functionArgs: [Cl.uint(jobId)],
  });
}

export async function claimAgentFee(jobId: bigint) {
  return callContract({
    contract: contractId(CONTRACTS.escrow),
    functionName: "claim-agent-fee",
    functionArgs: [Cl.uint(jobId), cv.usdcx()],
  });
}

export async function executeSwapStakeJob(params: { jobId: bigint; swapAmount: bigint }) {
  return callContract({
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
}

export async function claimStake(stakeId: bigint) {
  return callContract({
    contract: contractId(CONTRACTS.registry),
    functionName: "claim-stake",
    functionArgs: [cv.alex(), cv.alexStaking(), Cl.uint(stakeId)],
  });
}

export function clarityToJson(value: ClarityValue) {
  return cvToValue(value, true) as JsonClarity;
}

