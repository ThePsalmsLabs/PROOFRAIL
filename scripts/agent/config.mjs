export const NETWORK = "testnet";
export const HIRO_API = "https://api.testnet.hiro.so";

// Deployer used for the Clarinet testnet deployment in this repo.
export const DEPLOYER = "STC5KHM41H6WHAST7MWWDD807YSPRQKJ68T330BQ";

export const CONTRACTS = {
  vault: { address: DEPLOYER, name: "agent-vault" },
  escrow: { address: DEPLOYER, name: "job-escrow" },
  router: { address: DEPLOYER, name: "job-router" },
  registry: { address: DEPLOYER, name: "stake-registry" },

  // Testnet demo assets (mock contracts deployed by the plan)
  usdcx: { address: DEPLOYER, name: "mock-usdcx" },
  alex: { address: DEPLOYER, name: "mock-alex" },
  swap: { address: DEPLOYER, name: "mock-swap-helper" },
  staking: { address: DEPLOYER, name: "mock-alex-staking-v2" },
};

export const SWAP_FACTOR = 100000000n;

export function contractId({ address, name }) {
  return `${address}.${name}`;
}

