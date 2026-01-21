import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const user = accounts.get("wallet_1")!;
const other = accounts.get("wallet_2")!;

const ALEX = Cl.contractPrincipal(deployer, "mock-alex");
const STAKING = Cl.contractPrincipal(deployer, "mock-alex-staking-v2");
const REGISTRY = Cl.contractPrincipal(deployer, "stake-registry");

function setRouterPrincipal(router: string) {
  expect(
    simnet.callPublicFn(
      "stake-registry",
      "set-job-router-contract",
      [Cl.principal(router)],
      deployer
    ).result
  ).toBeOk(Cl.bool(true));
}

function mintAlex(recipient: string, amount: bigint) {
  expect(
    simnet.callPublicFn(
      "mock-alex",
      "mint",
      [Cl.uint(amount), Cl.principal(recipient)],
      deployer
    ).result
  ).toBeOk(Cl.bool(true));
}

describe("stake-registry", () => {
  it("stake-for-user is router-only", () => {
    // default router is deployer (owner), so calling as user should fail once we set router to other.
    setRouterPrincipal(other);
    const res = simnet.callPublicFn(
      "stake-registry",
      "stake-for-user",
      [Cl.principal(user), ALEX, STAKING, Cl.uint(1_000_000n), Cl.uint(1n)],
      user
    );
    expect(res.result).toBeErr(Cl.uint(500n));
  });

  it("stake-for-user records position and increases totals", () => {
    // Allow direct call from user for this unit test.
    setRouterPrincipal(user);

    // Fund registry with ALEX to stake.
    mintAlex(`${deployer}.stake-registry`, 5_000_000n);

    const stake = simnet.callPublicFn(
      "stake-registry",
      "stake-for-user",
      [Cl.principal(user), ALEX, STAKING, Cl.uint(2_000_000n), Cl.uint(1n)],
      user
    );
    expect(stake.result).toBeOk(Cl.uint(0n));

    const info = simnet.callReadOnlyFn(
      "stake-registry",
      "get-user-stake-info",
      [Cl.principal(user), Cl.principal(`${deployer}.mock-alex`)],
      user
    );
    expect(info.result).toEqual(
      Cl.tuple({ "total-staked": Cl.uint(2_000_000n), "position-count": Cl.uint(1n) })
    );

    const pos = simnet.callReadOnlyFn(
      "stake-registry",
      "get-stake-position",
      [Cl.principal(user), Cl.principal(`${deployer}.mock-alex`), Cl.uint(0n)],
      user
    );
    const fields = (pos.result as any).value.value as Record<string, any>;
    expect(fields["amount"]).toEqual(Cl.uint(2_000_000n));
    expect(fields["lock-period"]).toEqual(Cl.uint(1n));
    expect(fields["claimed"]).toEqual(Cl.bool(false));
    // sanity: unlock-block > staked-at-block
    expect((fields["unlock-block"].value as bigint) > (fields["staked-at-block"].value as bigint)).toBe(true);
  });

  it("claim-stake fails before unlock", () => {
    setRouterPrincipal(user);
    mintAlex(`${deployer}.stake-registry`, 2_000_000n);
    expect(
      simnet.callPublicFn(
        "stake-registry",
        "stake-for-user",
        [Cl.principal(user), ALEX, STAKING, Cl.uint(2_000_000n), Cl.uint(1n)],
        user
      ).result
    ).toBeOk(Cl.uint(0n));

    const claim = simnet.callPublicFn(
      "stake-registry",
      "claim-stake",
      [ALEX, STAKING, Cl.uint(0n)],
      user
    );
    expect(claim.result).toBeErr(Cl.uint(504n));
  });

  it("claim-stake succeeds after unlock and transfers to user", () => {
    setRouterPrincipal(user);
    mintAlex(`${deployer}.stake-registry`, 2_000_000n);
    expect(
      simnet.callPublicFn(
        "stake-registry",
        "stake-for-user",
        [Cl.principal(user), ALEX, STAKING, Cl.uint(2_000_000n), Cl.uint(1n)],
        user
      ).result
    ).toBeOk(Cl.uint(0n));

    // Advance beyond unlock-block (~525 blocks for lock-period 1).
    for (let i = 0; i < 530; i++) simnet.mineBlock([]);

    const before = simnet.callReadOnlyFn("mock-alex", "get-balance", [Cl.principal(user)], user);
    expect(before.result).toBeOk(Cl.uint(0n));

    const claim = simnet.callPublicFn(
      "stake-registry",
      "claim-stake",
      [ALEX, STAKING, Cl.uint(0n)],
      user
    );
    expect(claim.result).toBeOk(Cl.uint(2_000_000n));

    const after = simnet.callReadOnlyFn("mock-alex", "get-balance", [Cl.principal(user)], user);
    expect(after.result).toBeOk(Cl.uint(2_000_000n));
  });

  it("claim-stake fails for non-owner (position not found)", () => {
    setRouterPrincipal(user);
    mintAlex(`${deployer}.stake-registry`, 2_000_000n);
    expect(
      simnet.callPublicFn(
        "stake-registry",
        "stake-for-user",
        [Cl.principal(user), ALEX, STAKING, Cl.uint(2_000_000n), Cl.uint(1n)],
        user
      ).result
    ).toBeOk(Cl.uint(0n));

    for (let i = 0; i < 530; i++) simnet.mineBlock([]);

    const claim = simnet.callPublicFn(
      "stake-registry",
      "claim-stake",
      [ALEX, STAKING, Cl.uint(0n)],
      other
    );
    expect(claim.result).toBeErr(Cl.uint(503n));
  });

  it("claim-stake cannot be called twice", () => {
    setRouterPrincipal(user);
    mintAlex(`${deployer}.stake-registry`, 2_000_000n);
    expect(
      simnet.callPublicFn(
        "stake-registry",
        "stake-for-user",
        [Cl.principal(user), ALEX, STAKING, Cl.uint(2_000_000n), Cl.uint(1n)],
        user
      ).result
    ).toBeOk(Cl.uint(0n));

    for (let i = 0; i < 530; i++) simnet.mineBlock([]);

    expect(
      simnet.callPublicFn("stake-registry", "claim-stake", [ALEX, STAKING, Cl.uint(0n)], user).result
    ).toBeOk(Cl.uint(2_000_000n));

    const twice = simnet.callPublicFn(
      "stake-registry",
      "claim-stake",
      [ALEX, STAKING, Cl.uint(0n)],
      user
    );
    expect(twice.result).toBeErr(Cl.uint(505n));
  });
});
