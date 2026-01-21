import type { ContractIdString } from "@stacks/transactions";

export const STACKS_NETWORK = "testnet" as const;
export const STACKS_API_BASE = "https://api.testnet.hiro.so";

// Deployer address used in the Clarinet testnet deployment plans in this repo.
export const DEPLOYER_ADDRESS = "STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ";

export const CONTRACTS = {
  vault: { address: DEPLOYER_ADDRESS, name: "agent-vault" },
  escrow: { address: DEPLOYER_ADDRESS, name: "job-escrow" },
  router: { address: DEPLOYER_ADDRESS, name: "job-router" },
  registry: { address: DEPLOYER_ADDRESS, name: "stake-registry" },

  // Testnet demo assets (mock contracts deployed by the plan)
  usdcx: { address: DEPLOYER_ADDRESS, name: "mock-usdcx" },
  alex: { address: DEPLOYER_ADDRESS, name: "mock-alex" },
  swap: { address: DEPLOYER_ADDRESS, name: "mock-swap-helper" },
  staking: { address: DEPLOYER_ADDRESS, name: "mock-alex-staking-v2" },

  factor: BigInt(100000000), // swap-helper factor used in tests
} as const;

export function contractId(contract: { address: string; name: string }): ContractIdString {
  return `${contract.address}.${contract.name}` as ContractIdString;
}

