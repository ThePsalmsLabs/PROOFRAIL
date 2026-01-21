import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const payer = accounts.get("wallet_1")!;
const agent = accounts.get("wallet_2")!;

const USDCX = Cl.contractPrincipal(deployer, "mock-usdcx");
const ALEX = Cl.contractPrincipal(deployer, "mock-alex");
const SWAP = Cl.contractPrincipal(deployer, "mock-swap-helper");
const STAKING = Cl.contractPrincipal(deployer, "mock-alex-staking-v2");

const ESCROW = Cl.contractPrincipal(deployer, "job-escrow");
const ROUTER = Cl.contractPrincipal(deployer, "job-router");

function configureSystem() {
  expect(simnet.callPublicFn("agent-vault", "set-usdcx-token", [USDCX], deployer).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn("agent-vault", "set-job-escrow-contract", [ESCROW], deployer).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn("agent-vault", "set-job-router-contract", [ROUTER], deployer).result).toBeOk(Cl.bool(true));

  expect(simnet.callPublicFn("job-escrow", "set-job-router-contract", [ROUTER], deployer).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn("stake-registry", "set-job-router-contract", [ROUTER], deployer).result).toBeOk(Cl.bool(true));
}

function mint(contract: string, recipient: string, amount: bigint) {
  expect(
    simnet.callPublicFn(contract, "mint", [Cl.uint(amount), Cl.principal(recipient)], deployer).result
  ).toBeOk(Cl.bool(true));
}

describe("integration", () => {
  it("deposit -> create-job -> execute -> claim-fee -> claim-stake", () => {
    configureSystem();

    // Fund payer and swap liquidity.
    mint("mock-usdcx", payer, 26_000_000n);
    mint("mock-alex", `${deployer}.mock-swap-helper`, 100_000_000n);

    // Deposit USDCx into vault.
    expect(simnet.callPublicFn("agent-vault", "deposit", [USDCX, Cl.uint(26_000_000n)], payer).result).toBeOk(
      Cl.uint(26_000_000n)
    );

    // Create job.
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(25_000_000n), Cl.uint(1_000_000n), Cl.uint(20_000_000n), Cl.uint(1n), Cl.uint(100n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    // Execute job by agent.
    const exec = simnet.callPublicFn(
      "job-router",
      "execute-swap-stake-job",
      [Cl.uint(0n), USDCX, ALEX, SWAP, STAKING, Cl.uint(100_000_000n), Cl.uint(25_000_000n)],
      agent
    );
    expect((exec.result as any).type).toEqual((Cl.ok(Cl.bool(true)) as any).type);

    // Claim fee by agent.
    const claimFee = simnet.callPublicFn("job-escrow", "claim-fee", [Cl.uint(0n), USDCX], agent);
    expect(claimFee.result).toBeOk(Cl.uint(1_000_000n));

    // Agent received USDCx fee.
    const agentBal = simnet.callReadOnlyFn("mock-usdcx", "get-balance", [Cl.principal(agent)], agent);
    expect(agentBal.result).toBeOk(Cl.uint(1_000_000n));

    // Mine beyond unlock-block (~525 blocks for lock-period 1) and claim stake.
    for (let i = 0; i < 530; i++) simnet.mineBlock([]);

    const claimStake = simnet.callPublicFn("stake-registry", "claim-stake", [ALEX, STAKING, Cl.uint(0n)], payer);
    expect(claimStake.result).toBeOk(Cl.uint(25_000_000n));

    const payerAlex = simnet.callReadOnlyFn("mock-alex", "get-balance", [Cl.principal(payer)], payer);
    expect(payerAlex.result).toBeOk(Cl.uint(25_000_000n));
  });
});

