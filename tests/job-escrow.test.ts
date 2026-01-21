import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const payer = accounts.get("wallet_1")!;
const agent = accounts.get("wallet_2")!;

const USDCX = Cl.contractPrincipal(deployer, "mock-usdcx");
const ALEX = Cl.contractPrincipal(deployer, "mock-alex");

const ESCROW = Cl.contractPrincipal(deployer, "job-escrow");
const ROUTER = Cl.contractPrincipal(deployer, "job-router");

function configureVaultAndEscrow() {
  expect(
    simnet.callPublicFn("agent-vault", "set-usdcx-token", [USDCX], deployer).result
  ).toBeOk(Cl.bool(true));
  expect(
    simnet.callPublicFn("agent-vault", "set-job-escrow-contract", [ESCROW], deployer).result
  ).toBeOk(Cl.bool(true));
  expect(
    simnet.callPublicFn("agent-vault", "set-job-router-contract", [ROUTER], deployer).result
  ).toBeOk(Cl.bool(true));
  expect(
    simnet.callPublicFn("job-escrow", "set-job-router-contract", [ROUTER], deployer).result
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

function depositToVault(amount: bigint) {
  expect(
    simnet.callPublicFn(
      "agent-vault",
      "deposit",
      [USDCX, Cl.uint(amount)],
      payer
    ).result
  ).toBeOk(Cl.uint(amount));
}

describe("job-escrow", () => {
  it("create-job stores job and locks funds (nonce increments)", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 100_000_000n);
    depositToVault(100_000_000n);

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
        Cl.uint(10n),
      ],
      payer
    );
    expect(create.result).toBeOk(Cl.uint(0n));

    const next = simnet.callReadOnlyFn("job-escrow", "get-next-job-id", [], payer);
    expect(next.result).toEqual(Cl.uint(1n));

    const job = simnet.callReadOnlyFn("job-escrow", "get-job", [Cl.uint(0n)], payer);
    // Unwrap the `(some (tuple ...))` result to validate fields without assuming a genesis block height.
    const jobTuple = (job.result as any).value;
    const fields = jobTuple.value as Record<string, any>;

    expect(fields["payer"]).toEqual(Cl.principal(payer));
    expect(fields["agent"]).toEqual(Cl.principal(agent));
    expect(fields["token-contract"]).toEqual(Cl.principal(`${deployer}.mock-usdcx`));
    expect(fields["max-input-usdcx"]).toEqual(Cl.uint(25_000_000n));
    expect(fields["agent-fee-usdcx"]).toEqual(Cl.uint(1_000_000n));
    expect(fields["min-alex-out"]).toEqual(Cl.uint(1n));
    expect(fields["lock-period"]).toEqual(Cl.uint(1n));
    expect(fields["status"]).toEqual(Cl.uint(0n));
    expect(fields["receipt-hash"]).toEqual(Cl.none());
    expect(fields["executed-at-block"]).toEqual(Cl.none());
    expect(fields["fee-paid"]).toEqual(Cl.bool(false));

    const createdAt = fields["created-at-block"].value as bigint;
    const expiryBlock = fields["expiry-block"].value as bigint;
    expect(expiryBlock - createdAt).toEqual(10n);

    const bal = simnet.callReadOnlyFn("agent-vault", "get-balance", [Cl.principal(payer)], payer);
    expect(bal.result).toEqual(
      Cl.tuple({
        total: Cl.uint(100_000_000n),
        available: Cl.uint(74_000_000n),
        locked: Cl.uint(26_000_000n),
      })
    );
  });

  it("create-job fails if agent == payer", () => {
    configureVaultAndEscrow();
    const res = simnet.callPublicFn(
      "job-escrow",
      "create-job",
      [
        USDCX,
        Cl.principal(payer),
        Cl.uint(1n),
        Cl.uint(1n),
        Cl.uint(1n),
        Cl.uint(1n),
        Cl.uint(10n),
      ],
      payer
    );
    expect(res.result).toBeErr(Cl.uint(206n));
  });

  it("create-job fails if lock-period > 32", () => {
    configureVaultAndEscrow();
    const res = simnet.callPublicFn(
      "job-escrow",
      "create-job",
      [
        USDCX,
        Cl.principal(agent),
        Cl.uint(1n),
        Cl.uint(1n),
        Cl.uint(1n),
        Cl.uint(33n),
        Cl.uint(10n),
      ],
      payer
    );
    expect(res.result).toBeErr(Cl.uint(206n));
  });

  it("create-job fails if vault lock fails (insufficient balance)", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 1_000_000n);
    depositToVault(1_000_000n);
    const res = simnet.callPublicFn(
      "job-escrow",
      "create-job",
      [
        USDCX,
        Cl.principal(agent),
        Cl.uint(2_000_000n),
        Cl.uint(1_000_000n),
        Cl.uint(1n),
        Cl.uint(1n),
        Cl.uint(10n),
      ],
      payer
    );
    expect(res.result).toBeErr(Cl.uint(101n));
  });

  it("cancel-job works for payer when OPEN and unlocks funds", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 50_000_000n);
    depositToVault(50_000_000n);
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(10_000_000n), Cl.uint(1_000_000n), Cl.uint(1n), Cl.uint(1n), Cl.uint(10n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    expect(simnet.callPublicFn("job-escrow", "cancel-job", [Cl.uint(0n)], payer).result).toBeOk(
      Cl.bool(true)
    );

    const job = simnet.callReadOnlyFn("job-escrow", "get-job", [Cl.uint(0n)], payer);
    const fields = (job.result as any).value.value as Record<string, any>;
    expect(fields["status"]).toEqual(Cl.uint(2n));

    const bal = simnet.callReadOnlyFn("agent-vault", "get-balance", [Cl.principal(payer)], payer);
    expect(bal.result).toEqual(
      Cl.tuple({ total: Cl.uint(50_000_000n), available: Cl.uint(50_000_000n), locked: Cl.uint(0n) })
    );
  });

  it("cancel-job fails for non-payer", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 50_000_000n);
    depositToVault(50_000_000n);
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(10_000_000n), Cl.uint(1_000_000n), Cl.uint(1n), Cl.uint(1n), Cl.uint(10n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    const res = simnet.callPublicFn("job-escrow", "cancel-job", [Cl.uint(0n)], agent);
    expect(res.result).toBeErr(Cl.uint(204n));
  });

  it("expire-job fails before expiry and works after expiry", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 50_000_000n);
    depositToVault(50_000_000n);
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(10_000_000n), Cl.uint(1_000_000n), Cl.uint(1n), Cl.uint(1n), Cl.uint(10n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    const tooEarly = simnet.callPublicFn("job-escrow", "expire-job", [Cl.uint(0n)], agent);
    expect(tooEarly.result).toBeErr(Cl.uint(206n));

    for (let i = 0; i < 12; i++) simnet.mineBlock([]);
    const ok = simnet.callPublicFn("job-escrow", "expire-job", [Cl.uint(0n)], agent);
    expect(ok.result).toBeOk(Cl.bool(true));
  });

  it("mark-executed is router-only and fails when expired", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 50_000_000n);
    depositToVault(50_000_000n);
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(10_000_000n), Cl.uint(1_000_000n), Cl.uint(1n), Cl.uint(1n), Cl.uint(1n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    const receiptHash = Cl.buffer(Buffer.alloc(32, 2));

    // Not called by router contract-caller: should fail
    const unauthorized = simnet.callPublicFn("job-escrow", "mark-executed", [Cl.uint(0n), receiptHash], payer);
    expect(unauthorized.result).toBeErr(Cl.uint(200n));

    // Force router principal to match direct caller for testing.
    expect(simnet.callPublicFn("job-escrow", "set-job-router-contract", [Cl.principal(payer)], deployer).result).toBeOk(
      Cl.bool(true)
    );

    simnet.mineBlock([]);
    const expired = simnet.callPublicFn("job-escrow", "mark-executed", [Cl.uint(0n), receiptHash], payer);
    expect(expired.result).toBeErr(Cl.uint(207n));
  });

  it("mark-executed cannot be called twice", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 50_000_000n);
    depositToVault(50_000_000n);

    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(10_000_000n), Cl.uint(1_000_000n), Cl.uint(1n), Cl.uint(1n), Cl.uint(100n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    // Allow payer to act as router for this test.
    expect(simnet.callPublicFn("job-escrow", "set-job-router-contract", [Cl.principal(payer)], deployer).result).toBeOk(
      Cl.bool(true)
    );

    const receiptHash = Cl.buffer(Buffer.alloc(32, 4));
    expect(simnet.callPublicFn("job-escrow", "mark-executed", [Cl.uint(0n), receiptHash], payer).result).toBeOk(
      Cl.bool(true)
    );

    const twice = simnet.callPublicFn("job-escrow", "mark-executed", [Cl.uint(0n), receiptHash], payer);
    expect(twice.result).toBeErr(Cl.uint(202n));
  });

  it("cancel-job fails if job is not OPEN (e.g., already executed)", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 50_000_000n);
    depositToVault(50_000_000n);

    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(10_000_000n), Cl.uint(1_000_000n), Cl.uint(1n), Cl.uint(1n), Cl.uint(100n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    expect(simnet.callPublicFn("job-escrow", "set-job-router-contract", [Cl.principal(payer)], deployer).result).toBeOk(
      Cl.bool(true)
    );
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "mark-executed",
        [Cl.uint(0n), Cl.buffer(Buffer.alloc(32, 5))],
        payer
      ).result
    ).toBeOk(Cl.bool(true));

    const cancel = simnet.callPublicFn("job-escrow", "cancel-job", [Cl.uint(0n)], payer);
    expect(cancel.result).toBeErr(Cl.uint(202n));
  });

  it("claim-fee fails if job is not EXECUTED", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 26_000_000n);
    depositToVault(26_000_000n);
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(25_000_000n), Cl.uint(1_000_000n), Cl.uint(1n), Cl.uint(1n), Cl.uint(100n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    const res = simnet.callPublicFn("job-escrow", "claim-fee", [Cl.uint(0n), USDCX], agent);
    expect(res.result).toBeErr(Cl.uint(202n));
  });

  it("expire-job fails if job is not OPEN", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 50_000_000n);
    depositToVault(50_000_000n);
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(10_000_000n), Cl.uint(1_000_000n), Cl.uint(1n), Cl.uint(1n), Cl.uint(100n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    expect(simnet.callPublicFn("job-escrow", "cancel-job", [Cl.uint(0n)], payer).result).toBeOk(Cl.bool(true));

    const res = simnet.callPublicFn("job-escrow", "expire-job", [Cl.uint(0n)], agent);
    expect(res.result).toBeErr(Cl.uint(202n));
  });

  it("claim-fee is agent-only, enforces token match, and is single-claim", () => {
    configureVaultAndEscrow();
    mintUsdcx(payer, 26_000_000n);
    depositToVault(26_000_000n);
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(25_000_000n), Cl.uint(1_000_000n), Cl.uint(1n), Cl.uint(1n), Cl.uint(100n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    // Simulate spending max-input so only fee remains locked.
    expect(simnet.callPublicFn("agent-vault", "set-job-router-contract", [Cl.principal(deployer)], deployer).result).toBeOk(
      Cl.bool(true)
    );
    expect(
      simnet.callPublicFn(
        "agent-vault",
        "draw-to-router",
        [Cl.principal(payer), Cl.uint(0n), USDCX, Cl.uint(25_000_000n)],
        deployer
      ).result
    ).toBeOk(Cl.uint(25_000_000n));

    // Allow deployer to mark executed for test
    expect(simnet.callPublicFn("job-escrow", "set-job-router-contract", [Cl.principal(deployer)], deployer).result).toBeOk(
      Cl.bool(true)
    );
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "mark-executed",
        [Cl.uint(0n), Cl.buffer(Buffer.alloc(32, 3))],
        deployer
      ).result
    ).toBeOk(Cl.bool(true));

    // Token mismatch fails
    const mismatch = simnet.callPublicFn("job-escrow", "claim-fee", [Cl.uint(0n), ALEX], agent);
    expect(mismatch.result).toBeErr(Cl.uint(208n));

    // Non-agent fails
    const nonAgent = simnet.callPublicFn("job-escrow", "claim-fee", [Cl.uint(0n), USDCX], payer);
    expect(nonAgent.result).toBeErr(Cl.uint(203n));

    // Agent claim succeeds once
    const claim = simnet.callPublicFn("job-escrow", "claim-fee", [Cl.uint(0n), USDCX], agent);
    expect(claim.result).toBeOk(Cl.uint(1_000_000n));

    // Double claim fails
    const twice = simnet.callPublicFn("job-escrow", "claim-fee", [Cl.uint(0n), USDCX], agent);
    expect(twice.result).toBeErr(Cl.uint(205n));
  });
});
