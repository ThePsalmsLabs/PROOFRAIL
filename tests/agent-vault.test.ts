import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const payer = accounts.get("wallet_1")!;
const agent = accounts.get("wallet_2")!;

const USDCX = Cl.contractPrincipal(deployer, "mock-usdcx");
const VAULT = Cl.contractPrincipal(deployer, "agent-vault");
const ESCROW = Cl.contractPrincipal(deployer, "job-escrow");
const ROUTER = Cl.contractPrincipal(deployer, "job-router");

function configureVault() {
  expect(
    simnet.callPublicFn(
      "agent-vault",
      "set-usdcx-token",
      [USDCX],
      deployer
    ).result
  ).toBeOk(Cl.bool(true));

  expect(
    simnet.callPublicFn(
      "agent-vault",
      "set-job-escrow-contract",
      [ESCROW],
      deployer
    ).result
  ).toBeOk(Cl.bool(true));

  expect(
    simnet.callPublicFn(
      "agent-vault",
      "set-job-router-contract",
      [ROUTER],
      deployer
    ).result
  ).toBeOk(Cl.bool(true));
}

function setVaultEscrow(principal: string) {
  expect(
    simnet.callPublicFn(
      "agent-vault",
      "set-job-escrow-contract",
      [Cl.principal(principal)],
      deployer
    ).result
  ).toBeOk(Cl.bool(true));
}

function setVaultRouter(principal: string) {
  expect(
    simnet.callPublicFn(
      "agent-vault",
      "set-job-router-contract",
      [Cl.principal(principal)],
      deployer
    ).result
  ).toBeOk(Cl.bool(true));
}

function mintUsdcx(recipient: string, amount: bigint) {
  expect(
    simnet.callPublicFn(
      "mock-usdcx",
      "mint",
      [Cl.uint(amount), Cl.principal(recipient)],
      deployer
    ).result
  ).toBeOk(Cl.bool(true));
}

describe("agent-vault", () => {
  it("only the owner can update config", () => {
    const res = simnet.callPublicFn(
      "agent-vault",
      "set-usdcx-token",
      [USDCX],
      payer
    );
    expect(res.result).toBeErr(Cl.uint(100n));
  });

  it("deposit updates balances and transfers USDCx into vault", () => {
    configureVault();
    mintUsdcx(payer, 100_000_000n);

    const deposit = simnet.callPublicFn(
      "agent-vault",
      "deposit",
      [USDCX, Cl.uint(25_000_000n)],
      payer
    );
    expect(deposit.result).toBeOk(Cl.uint(25_000_000n));

    const bal = simnet.callReadOnlyFn(
      "agent-vault",
      "get-balance",
      [Cl.principal(payer)],
      payer
    );
    expect(bal.result).toEqual(
      Cl.tuple({
        total: Cl.uint(25_000_000n),
        available: Cl.uint(25_000_000n),
        locked: Cl.uint(0n),
      })
    );

    const vaultTokenBal = simnet.callReadOnlyFn(
      "mock-usdcx",
      "get-balance",
      [VAULT],
      payer
    );
    expect(vaultTokenBal.result).toBeOk(Cl.uint(25_000_000n));
  });

  it("deposit fails on zero amount", () => {
    configureVault();
    const res = simnet.callPublicFn(
      "agent-vault",
      "deposit",
      [USDCX, Cl.uint(0n)],
      payer
    );
    expect(res.result).toBeErr(Cl.uint(102n));
  });

  it("withdraw transfers from vault and decrements available", () => {
    configureVault();
    mintUsdcx(payer, 100_000_000n);

    expect(
      simnet.callPublicFn(
        "agent-vault",
        "deposit",
        [USDCX, Cl.uint(50_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(50_000_000n));

    const w = simnet.callPublicFn(
      "agent-vault",
      "withdraw",
      [USDCX, Cl.uint(10_000_000n)],
      payer
    );
    expect(w.result).toBeOk(Cl.uint(10_000_000n));

    const bal = simnet.callReadOnlyFn(
      "agent-vault",
      "get-balance",
      [Cl.principal(payer)],
      payer
    );
    expect(bal.result).toEqual(
      Cl.tuple({
        total: Cl.uint(40_000_000n),
        available: Cl.uint(40_000_000n),
        locked: Cl.uint(0n),
      })
    );
  });

  it("withdraw fails on zero amount", () => {
    configureVault();
    const w = simnet.callPublicFn(
      "agent-vault",
      "withdraw",
      [USDCX, Cl.uint(0n)],
      payer
    );
    expect(w.result).toBeErr(Cl.uint(102n));
  });

  it("lock-for-job is escrow-only and creates a job lock record", () => {
    configureVault();
    mintUsdcx(payer, 100_000_000n);

    expect(
      simnet.callPublicFn(
        "agent-vault",
        "deposit",
        [USDCX, Cl.uint(50_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(50_000_000n));

    // Direct call should fail when escrow is set to the escrow contract.
    const unauthorized = simnet.callPublicFn(
      "agent-vault",
      "lock-for-job",
      [Cl.principal(payer), Cl.uint(0n), Cl.uint(10_000_000n)],
      payer
    );
    expect(unauthorized.result).toBeErr(Cl.uint(100n));

    // Allow this test to call lock directly by setting escrow to payer.
    setVaultEscrow(payer);
    const ok = simnet.callPublicFn(
      "agent-vault",
      "lock-for-job",
      [Cl.principal(payer), Cl.uint(0n), Cl.uint(10_000_000n)],
      payer
    );
    expect(ok.result).toBeOk(Cl.uint(10_000_000n));

    const bal = simnet.callReadOnlyFn(
      "agent-vault",
      "get-balance",
      [Cl.principal(payer)],
      payer
    );
    expect(bal.result).toEqual(
      Cl.tuple({
        total: Cl.uint(50_000_000n),
        available: Cl.uint(40_000_000n),
        locked: Cl.uint(10_000_000n),
      })
    );

    const lock = simnet.callReadOnlyFn(
      "agent-vault",
      "get-job-lock",
      [Cl.principal(payer), Cl.uint(0n)],
      payer
    );
    expect(lock.result).toEqual(
      Cl.some(
        Cl.tuple({
          initial: Cl.uint(10_000_000n),
          remaining: Cl.uint(10_000_000n),
          unlocked: Cl.bool(false),
        })
      )
    );
  });

  it("unlock-from-job cannot be called twice and amount must match initial lock", () => {
    configureVault();
    mintUsdcx(payer, 100_000_000n);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "deposit",
        [USDCX, Cl.uint(20_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(20_000_000n));

    setVaultEscrow(payer);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "lock-for-job",
        [Cl.principal(payer), Cl.uint(0n), Cl.uint(10_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(10_000_000n));

    // Wrong amount should fail.
    const bad = simnet.callPublicFn(
      "agent-vault",
      "unlock-from-job",
      [Cl.principal(payer), Cl.uint(0n), Cl.uint(9_000_000n)],
      payer
    );
    expect(bad.result).toBeErr(Cl.uint(107n));

    // Correct unlock works once.
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "unlock-from-job",
        [Cl.principal(payer), Cl.uint(0n), Cl.uint(10_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(10_000_000n));

    // Double unlock fails.
    const twice = simnet.callPublicFn(
      "agent-vault",
      "unlock-from-job",
      [Cl.principal(payer), Cl.uint(0n), Cl.uint(10_000_000n)],
      payer
    );
    expect(twice.result).toBeErr(Cl.uint(104n));
  });

  it("lock-for-job fails if amount exceeds available", () => {
    configureVault();
    mintUsdcx(payer, 100_000_000n);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "deposit",
        [USDCX, Cl.uint(5_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(5_000_000n));

    setVaultEscrow(payer);
    const res = simnet.callPublicFn(
      "agent-vault",
      "lock-for-job",
      [Cl.principal(payer), Cl.uint(0n), Cl.uint(6_000_000n)],
      payer
    );
    expect(res.result).toBeErr(Cl.uint(101n));
  });

  it("draw-to-router is router-only and decrements remaining lock", () => {
    configureVault();
    mintUsdcx(payer, 100_000_000n);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "deposit",
        [USDCX, Cl.uint(20_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(20_000_000n));

    // Lock 20 for job 0
    setVaultEscrow(payer);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "lock-for-job",
        [Cl.principal(payer), Cl.uint(0n), Cl.uint(20_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(20_000_000n));

    // Unauthorized draw fails (router configured to job-router contract)
    const unauthorized = simnet.callPublicFn(
      "agent-vault",
      "draw-to-router",
      [Cl.principal(payer), Cl.uint(0n), USDCX, Cl.uint(1_000_000n)],
      payer
    );
    expect(unauthorized.result).toBeErr(Cl.uint(100n));

    // Allow this test to call draw directly by setting router to payer.
    setVaultRouter(payer);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "draw-to-router",
        [Cl.principal(payer), Cl.uint(0n), USDCX, Cl.uint(5_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(5_000_000n));

    const lock = simnet.callReadOnlyFn(
      "agent-vault",
      "get-job-lock",
      [Cl.principal(payer), Cl.uint(0n)],
      payer
    );
    expect(lock.result).toEqual(
      Cl.some(
        Cl.tuple({
          initial: Cl.uint(20_000_000n),
          remaining: Cl.uint(15_000_000n),
          unlocked: Cl.bool(false),
        })
      )
    );
  });

  it("draw-to-router fails if amount exceeds remaining", () => {
    configureVault();
    mintUsdcx(payer, 100_000_000n);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "deposit",
        [USDCX, Cl.uint(10_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(10_000_000n));

    setVaultEscrow(payer);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "lock-for-job",
        [Cl.principal(payer), Cl.uint(0n), Cl.uint(10_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(10_000_000n));

    setVaultRouter(payer);
    const res = simnet.callPublicFn(
      "agent-vault",
      "draw-to-router",
      [Cl.principal(payer), Cl.uint(0n), USDCX, Cl.uint(11_000_000n)],
      payer
    );
    expect(res.result).toBeErr(Cl.uint(101n));
  });

  it("release-fee is escrow-only and transfers to agent", () => {
    configureVault();
    mintUsdcx(payer, 100_000_000n);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "deposit",
        [USDCX, Cl.uint(5_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(5_000_000n));

    // Lock 5 for job 0 (temporarily allow this test to call lock directly).
    setVaultEscrow(payer);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "lock-for-job",
        [Cl.principal(payer), Cl.uint(0n), Cl.uint(5_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(5_000_000n));

    // Unauthorized release fails.
    // Restore escrow authorization to the real escrow contract first.
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "set-job-escrow-contract",
        [ESCROW],
        deployer
      ).result
    ).toBeOk(Cl.bool(true));

    const unauthorized = simnet.callPublicFn(
      "agent-vault",
      "release-fee",
      [Cl.principal(payer), Cl.uint(0n), USDCX, Cl.principal(agent), Cl.uint(1_000_000n)],
      payer
    );
    expect(unauthorized.result).toBeErr(Cl.uint(100n));

    // Allow this test to call release directly by setting escrow to payer.
    setVaultEscrow(payer);
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "release-fee",
        [Cl.principal(payer), Cl.uint(0n), USDCX, Cl.principal(agent), Cl.uint(1_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(1_000_000n));
  });

  it("withdraw fails when exceeding available (locked funds cannot be withdrawn)", () => {
    configureVault();
    mintUsdcx(payer, 200_000_000n);

    expect(
      simnet.callPublicFn(
        "agent-vault",
        "deposit",
        [USDCX, Cl.uint(100_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(100_000_000n));

    // Create a job to lock (max-input + fee) = 26 USDCx.
    const create = simnet.callPublicFn(
      "job-escrow",
      "create-job",
      [
        USDCX,
        Cl.principal(agent),
        Cl.uint(25_000_000n),
        Cl.uint(1_000_000n),
        Cl.uint(1n),
        Cl.uint(1n),
        Cl.uint(100n),
      ],
      payer
    );
    expect(create.result).toBeOk(Cl.uint(0n));

    // Now available should be 74 USDCx. Attempting to withdraw 80 should fail.
    const w = simnet.callPublicFn(
      "agent-vault",
      "withdraw",
      [USDCX, Cl.uint(80_000_000n)],
      payer
    );
    expect(w.result).toBeErr(Cl.uint(101n));
  });

  it("escrow can cancel an open job and funds become available again", () => {
    configureVault();
    mintUsdcx(payer, 200_000_000n);

    expect(
      simnet.callPublicFn(
        "agent-vault",
        "deposit",
        [USDCX, Cl.uint(100_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(100_000_000n));

    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [
          USDCX,
          Cl.principal(agent),
          Cl.uint(25_000_000n),
          Cl.uint(1_000_000n),
          Cl.uint(1n),
          Cl.uint(1n),
          Cl.uint(100n),
        ],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    expect(simnet.callPublicFn("job-escrow", "cancel-job", [Cl.uint(0n)], payer).result).toBeOk(
      Cl.bool(true)
    );

    const bal = simnet.callReadOnlyFn(
      "agent-vault",
      "get-balance",
      [Cl.principal(payer)],
      payer
    );
    expect(bal.result).toEqual(
      Cl.tuple({
        total: Cl.uint(100_000_000n),
        available: Cl.uint(100_000_000n),
        locked: Cl.uint(0n),
      })
    );
  });

  it("fee release only succeeds after draw-to-router reduces remaining to fee", () => {
    configureVault();
    mintUsdcx(payer, 200_000_000n);

    // Deposit 26 USDCx, create job (max 25 + fee 1)
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "deposit",
        [USDCX, Cl.uint(26_000_000n)],
        payer
      ).result
    ).toBeOk(Cl.uint(26_000_000n));

    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [
          USDCX,
          Cl.principal(agent),
          Cl.uint(25_000_000n),
          Cl.uint(1_000_000n),
          Cl.uint(1n),
          Cl.uint(1n),
          Cl.uint(100n),
        ],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    // For this unit test, temporarily authorize deployer as "router" to simulate draw.
    expect(
      simnet.callPublicFn("agent-vault", "set-job-router-contract", [Cl.principal(deployer)], deployer).result
    ).toBeOk(Cl.bool(true));

    expect(
      simnet.callPublicFn(
        "agent-vault",
        "draw-to-router",
        [Cl.principal(payer), Cl.uint(0n), USDCX, Cl.uint(25_000_000n)],
        deployer
      ).result
    ).toBeOk(Cl.uint(25_000_000n));

    // Temporarily authorize deployer as router in escrow to mark executed.
    expect(
      simnet.callPublicFn("job-escrow", "set-job-router-contract", [Cl.principal(deployer)], deployer).result
    ).toBeOk(Cl.bool(true));

    // Mark job executed so agent can claim.
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "mark-executed",
        [Cl.uint(0n), Cl.buffer(Buffer.alloc(32, 1))],
        deployer
      ).result
    ).toBeOk(Cl.bool(true));

    // Now agent claims fee.
    const claim = simnet.callPublicFn(
      "job-escrow",
      "claim-fee",
      [Cl.uint(0n), USDCX],
      agent
    );
    expect(claim.result).toBeOk(Cl.uint(1_000_000n));

    const bal = simnet.callReadOnlyFn(
      "agent-vault",
      "get-balance",
      [Cl.principal(payer)],
      payer
    );
    expect(bal.result).toEqual(
      Cl.tuple({
        total: Cl.uint(0n),
        available: Cl.uint(0n),
        locked: Cl.uint(0n),
      })
    );
  });
});
