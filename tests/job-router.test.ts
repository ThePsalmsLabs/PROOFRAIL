import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const payer = accounts.get("wallet_1")!;
const agent = accounts.get("wallet_2")!;
const other = accounts.get("wallet_3")!;

const USDCX = Cl.contractPrincipal(deployer, "mock-usdcx");
const ALEX = Cl.contractPrincipal(deployer, "mock-alex");
const SWAP = Cl.contractPrincipal(deployer, "mock-swap-helper");
const STAKING = Cl.contractPrincipal(deployer, "mock-alex-staking-v2");

const VAULT = Cl.contractPrincipal(deployer, "agent-vault");
const ESCROW = Cl.contractPrincipal(deployer, "job-escrow");
const ROUTER = Cl.contractPrincipal(deployer, "job-router");
const REGISTRY = Cl.contractPrincipal(deployer, "stake-registry");

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

function depositUsdcx(amount: bigint) {
  expect(
    simnet.callPublicFn("agent-vault", "deposit", [USDCX, Cl.uint(amount)], payer).result
  ).toBeOk(Cl.uint(amount));
}

function createJob(params?: Partial<{ max: bigint; fee: bigint; minOut: bigint; lock: bigint; expiry: bigint }>) {
  const max = params?.max ?? 25_000_000n;
  const fee = params?.fee ?? 1_000_000n;
  const minOut = params?.minOut ?? 20_000_000n;
  const lock = params?.lock ?? 1n;
  const expiry = params?.expiry ?? 100n;

  const res = simnet.callPublicFn(
    "job-escrow",
    "create-job",
    [USDCX, Cl.principal(agent), Cl.uint(max), Cl.uint(fee), Cl.uint(minOut), Cl.uint(lock), Cl.uint(expiry)],
    payer
  );
  expect(res.result).toBeOk(Cl.uint(0n));
  return { max, fee, minOut, lock, expiry };
}

function mintAlexLiquidity(amount: bigint) {
  // Fund the swap helper so it can pay out ALEX to the router.
  mint("mock-alex", `${deployer}.mock-swap-helper`, amount);
}

describe("job-router", () => {
  it("executes swap+stake end-to-end and marks job executed", () => {
    configureSystem();
    mint("mock-usdcx", payer, 26_000_000n);
    depositUsdcx(26_000_000n);
    createJob();
    mintAlexLiquidity(100_000_000n);

    const exec = simnet.callPublicFn(
      "job-router",
      "execute-swap-stake-job",
      [Cl.uint(0n), USDCX, ALEX, SWAP, STAKING, Cl.uint(100_000_000n), Cl.uint(25_000_000n)],
      agent
    );
    expect((exec.result as any).type).toEqual((Cl.ok(Cl.bool(true)) as any).type);

    const job = simnet.callReadOnlyFn("job-escrow", "get-job", [Cl.uint(0n)], payer);
    const fields = (job.result as any).value.value as Record<string, any>;
    expect(fields["status"]).toEqual(Cl.uint(1n));
    expect(fields["receipt-hash"]).not.toEqual(Cl.none());

    const stakeInfo = simnet.callReadOnlyFn(
      "stake-registry",
      "get-user-stake-info",
      [Cl.principal(payer), Cl.principal(`${deployer}.mock-alex`)],
      payer
    );
    expect(stakeInfo.result).toEqual(
      Cl.tuple({ "total-staked": Cl.uint(25_000_000n), "position-count": Cl.uint(1n) })
    );

    const stakingBal = simnet.callReadOnlyFn("mock-alex", "get-balance", [Cl.contractPrincipal(deployer, "mock-alex-staking-v2")], payer);
    expect(stakingBal.result).toBeOk(Cl.uint(25_000_000n));

    const vaultBal = simnet.callReadOnlyFn("agent-vault", "get-balance", [Cl.principal(payer)], payer);
    expect(vaultBal.result).toEqual(
      Cl.tuple({ total: Cl.uint(1_000_000n), available: Cl.uint(0n), locked: Cl.uint(1_000_000n) })
    );
  });

  it("only the designated agent can execute", () => {
    configureSystem();
    mint("mock-usdcx", payer, 26_000_000n);
    depositUsdcx(26_000_000n);
    createJob();
    mintAlexLiquidity(100_000_000n);

    const exec = simnet.callPublicFn(
      "job-router",
      "execute-swap-stake-job",
      [Cl.uint(0n), USDCX, ALEX, SWAP, STAKING, Cl.uint(100_000_000n), Cl.uint(25_000_000n)],
      other
    );
    expect(exec.result).toBeErr(Cl.uint(302n));
  });

  it("cannot execute after expiry", () => {
    configureSystem();
    mint("mock-usdcx", payer, 26_000_000n);
    depositUsdcx(26_000_000n);
    createJob({ expiry: 1n });
    mintAlexLiquidity(100_000_000n);

    // Move time forward enough to expire.
    for (let i = 0; i < 3; i++) simnet.mineBlock([]);

    const exec = simnet.callPublicFn(
      "job-router",
      "execute-swap-stake-job",
      [Cl.uint(0n), USDCX, ALEX, SWAP, STAKING, Cl.uint(100_000_000n), Cl.uint(25_000_000n)],
      agent
    );
    expect(exec.result).toBeErr(Cl.uint(306n));
  });

  it("cannot execute a cancelled job", () => {
    configureSystem();
    mint("mock-usdcx", payer, 26_000_000n);
    depositUsdcx(26_000_000n);
    createJob();
    mintAlexLiquidity(100_000_000n);

    expect(simnet.callPublicFn("job-escrow", "cancel-job", [Cl.uint(0n)], payer).result).toBeOk(Cl.bool(true));

    const exec = simnet.callPublicFn(
      "job-router",
      "execute-swap-stake-job",
      [Cl.uint(0n), USDCX, ALEX, SWAP, STAKING, Cl.uint(100_000_000n), Cl.uint(25_000_000n)],
      agent
    );
    expect(exec.result).toBeErr(Cl.uint(301n));
  });

  it("cannot execute with swap-amount > max-input", () => {
    configureSystem();
    mint("mock-usdcx", payer, 26_000_000n);
    depositUsdcx(26_000_000n);
    createJob({ max: 25_000_000n });
    mintAlexLiquidity(100_000_000n);

    const exec = simnet.callPublicFn(
      "job-router",
      "execute-swap-stake-job",
      [Cl.uint(0n), USDCX, ALEX, SWAP, STAKING, Cl.uint(100_000_000n), Cl.uint(30_000_000n)],
      agent
    );
    expect(exec.result).toBeErr(Cl.uint(307n));
  });

  it("swap slippage failure reverts and does not mark job executed", () => {
    configureSystem();
    mint("mock-usdcx", payer, 26_000_000n);
    depositUsdcx(26_000_000n);
    // Require more ALEX than dy will produce.
    createJob({ minOut: 30_000_001n });
    mintAlexLiquidity(100_000_000n);

    const exec = simnet.callPublicFn(
      "job-router",
      "execute-swap-stake-job",
      [Cl.uint(0n), USDCX, ALEX, SWAP, STAKING, Cl.uint(100_000_000n), Cl.uint(25_000_000n)],
      agent
    );
    expect(exec.result).toBeErr(Cl.uint(304n));

    const job = simnet.callReadOnlyFn("job-escrow", "get-job", [Cl.uint(0n)], payer);
    const fields = (job.result as any).value.value as Record<string, any>;
    expect(fields["status"]).toEqual(Cl.uint(0n));
    expect(fields["receipt-hash"]).toEqual(Cl.none());

    // Vault state should be unchanged (atomic rollback).
    const vaultBal = simnet.callReadOnlyFn("agent-vault", "get-balance", [Cl.principal(payer)], payer);
    expect(vaultBal.result).toEqual(
      Cl.tuple({ total: Cl.uint(26_000_000n), available: Cl.uint(0n), locked: Cl.uint(26_000_000n) })
    );
  });

  it("receipt hash is deterministic and matches router helper", () => {
    configureSystem();
    mint("mock-usdcx", payer, 26_000_000n);
    depositUsdcx(26_000_000n);
    createJob();
    mintAlexLiquidity(100_000_000n);

    const exec = simnet.callPublicFn(
      "job-router",
      "execute-swap-stake-job",
      [Cl.uint(0n), USDCX, ALEX, SWAP, STAKING, Cl.uint(100_000_000n), Cl.uint(25_000_000n)],
      agent
    );
    expect((exec.result as any).type).toEqual((Cl.ok(Cl.bool(true)) as any).type);

    const receipt = (exec.result as any).value;
    const r = receipt.value as Record<string, any>;

    const computed = simnet.callReadOnlyFn(
      "job-router",
      "calculate-receipt-hash",
      [
        r["job-id"],
        r["payer"],
        r["agent"],
        r["usdcx-spent"],
        r["alex-received"],
        r["alex-staked"],
        r["lock-period"],
        r["executed-block"],
        r["stake-id"],
      ],
      agent
    );

    const job = simnet.callReadOnlyFn("job-escrow", "get-job", [Cl.uint(0n)], payer);
    const fields = (job.result as any).value.value as Record<string, any>;
    expect(fields["receipt-hash"]).toEqual(Cl.some(computed.result));
  });

  it("job is marked executed only on success (no partial state)", () => {
    configureSystem();
    mint("mock-usdcx", payer, 26_000_000n);
    depositUsdcx(26_000_000n);
    createJob({ minOut: 30_000_001n });
    mintAlexLiquidity(100_000_000n);

    const exec = simnet.callPublicFn(
      "job-router",
      "execute-swap-stake-job",
      [Cl.uint(0n), USDCX, ALEX, SWAP, STAKING, Cl.uint(100_000_000n), Cl.uint(25_000_000n)],
      agent
    );
    expect(exec.result).toBeErr(Cl.uint(304n));

    const registryInfo = simnet.callReadOnlyFn(
      "stake-registry",
      "get-user-stake-info",
      [Cl.principal(payer), Cl.principal(`${deployer}.mock-alex`)],
      payer
    );
    expect(registryInfo.result).toEqual(
      Cl.tuple({ "total-staked": Cl.uint(0n), "position-count": Cl.uint(0n) })
    );
  });
});
