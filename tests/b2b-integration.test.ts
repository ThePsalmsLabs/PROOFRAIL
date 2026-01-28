import { describe, expect, it, beforeEach } from "vitest";
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
const PYTH_ORACLE = Cl.contractPrincipal(deployer, "pyth-price-oracle");
const BRIDGE_ADAPTER = Cl.contractPrincipal(deployer, "cctp-bridge-adapter");
const VAULT = Cl.contractPrincipal(deployer, "agent-vault");

function configureSystem() {
  // Configure vault
  expect(simnet.callPublicFn("agent-vault", "set-usdcx-token", [USDCX], deployer).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn("agent-vault", "set-job-escrow-contract", [ESCROW], deployer).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn("agent-vault", "set-job-router-contract", [ROUTER], deployer).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn("agent-vault", "set-bridge-adapter-contract", [BRIDGE_ADAPTER], deployer).result).toBeOk(Cl.bool(true));

  // Configure escrow and router
  expect(simnet.callPublicFn("job-escrow", "set-job-router-contract", [ROUTER], deployer).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn("stake-registry", "set-job-router-contract", [ROUTER], deployer).result).toBeOk(Cl.bool(true));

  // Configure bridge adapter
  expect(simnet.callPublicFn("cctp-bridge-adapter", "set-usdcx-token", [USDCX], deployer).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn("cctp-bridge-adapter", "set-agent-vault-contract", [VAULT], deployer).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn("cctp-bridge-adapter", "register-chain", [Cl.uint(0), Cl.stringAscii("Ethereum"), Cl.uint(100000), Cl.uint(1000000000000)], deployer).result).toBeOk(Cl.bool(true));

  // Configure Pyth oracle
  expect(simnet.callPublicFn("pyth-price-oracle", "set-pyth-oracle", [Cl.principal(deployer)], deployer).result).toBeOk(Cl.bool(true));
  const feedId = Cl.bufferFromHex("0x" + "0".repeat(64));
  expect(simnet.callPublicFn("pyth-price-oracle", "register-price-feed", [USDCX, ALEX, feedId, Cl.uint(8), Cl.uint(1000000)], deployer).result).toBeOk(Cl.bool(true));
}

function mint(contract: string, recipient: string, amount: bigint) {
  expect(
    simnet.callPublicFn(contract, "mint", [Cl.uint(amount), Cl.principal(recipient)], deployer).result
  ).toBeOk(Cl.bool(true));
}

describe("B2B Integration Flow", () => {
  beforeEach(() => {
    configureSystem();
  });

  it("Complete B2B flow: Bridge → Deposit → Create Job → Execute with Price Validation → Receipt", () => {
    // Step 1: Bridge USDC from Ethereum (simulated via bridge adapter)
    // In production, this would come from xReserve relayer
    const bridgeMessage = Cl.bufferFromHex("0x" + "0".repeat(512));
    const bridgeAttestation = Cl.bufferFromHex("0x" + "1".repeat(128));
    const bridgeMessageHash = Cl.bufferFromHex("0x" + "2".repeat(64));
    const bridgeAmount = Cl.uint(10_000_000n); // 10 USDC

    // Receive bridge message (protocol 0 = xReserve)
    expect(
      simnet.callPublicFn(
        "cctp-bridge-adapter",
        "receive-bridge-message",
        [bridgeMessage, bridgeAttestation, bridgeMessageHash, Cl.principal(payer), bridgeAmount, Cl.uint(0), Cl.uint(0)],
        deployer
      ).result
    ).toBeOk(Cl.tuple({}));

    // Complete bridge and auto-deposit to vault
    expect(
      simnet.callPublicFn(
        "cctp-bridge-adapter",
        "complete-bridge-and-deposit",
        [bridgeMessageHash, Cl.principal(payer), bridgeAmount, USDCX],
        deployer
      ).result
    ).toBeOk(Cl.tuple({}));

    // Verify funds are in vault
    const vaultBalance = simnet.callReadOnlyFn("agent-vault", "get-balance", [Cl.principal(payer)], payer);
    expect(vaultBalance.result).toBeOk(
      Cl.tuple({
        total: Cl.uint(9_990_000n), // After 0.1% bridge fee
        available: Cl.uint(9_990_000n),
        locked: Cl.uint(0n),
      })
    );

    // Step 2: Create job with price bounds
    const maxInput = Cl.uint(9_000_000n); // 9 USDC
    const agentFee = Cl.uint(90_000n); // 0.9 USDC (1%)
    const minAlexOut = Cl.uint(8_000_000n);
    const lockPeriod = Cl.uint(1n);
    const expiryBlocks = Cl.uint(100n);

    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), maxInput, agentFee, minAlexOut, lockPeriod, expiryBlocks],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    // Step 3: Execute job with price validation
    // First, validate price
    const minPrice = Cl.uint(95000000); // $0.95
    const maxPrice = Cl.uint(105000000); // $1.05
    const currentPrice = Cl.uint(100000000); // $1.00
    const confidence = Cl.uint(500000); // 0.5%
    const publishTime = Cl.uint(simnet.blockHeight);
    const expo = Cl.int(-8);

    // Price validation should pass
    const priceValidation = simnet.callPublicFn(
      "pyth-price-oracle",
      "validate-price-for-execution",
      [USDCX, ALEX, minPrice, maxPrice, currentPrice, confidence, publishTime, expo],
      agent
    );
    expect(priceValidation.result).toBeOk(Cl.tuple({}));

    // Fund swap liquidity
    mint("mock-alex", `${deployer}.mock-swap-helper`, 100_000_000n);

    // Execute job via router with price validation
    const executorParams = Cl.bufferFromHex("0x00"); // Empty params for legacy executor
    const inputAmount = Cl.uint(9_000_000n);

    // Use execute-job-with-price-validation
    const execution = simnet.callPublicFn(
      "job-router",
      "execute-job-with-price-validation",
      [
        Cl.uint(0n),
        Cl.contractPrincipal(deployer, "alex-executor"),
        USDCX,
        inputAmount,
        executorParams,
        USDCX,
        ALEX,
        minPrice,
        maxPrice,
        currentPrice,
        confidence,
        publishTime,
        expo,
      ],
      agent
    );

    // Execution should succeed
    expect(execution.result).toBeOk(Cl.tuple({}));

    // Step 4: Verify job is executed
    const job = simnet.callReadOnlyFn("job-escrow", "get-job", [Cl.uint(0n)], payer);
    expect(job.result).toBeSome(
      Cl.tuple({
        status: Cl.uint(1), // EXECUTED
      })
    );

    // Step 5: Agent claims fee
    const claimFee = simnet.callPublicFn("job-escrow", "claim-fee", [Cl.uint(0n), USDCX], agent);
    expect(claimFee.result).toBeOk(Cl.uint(90_000n));

    // Verify receipt was generated (check job output)
    const executedJob = simnet.callReadOnlyFn("job-escrow", "get-job", [Cl.uint(0n)], payer);
    const jobData = executedJob.result as any;
    expect(jobData.value["receipt-hash"]).toBeDefined();
    expect(jobData.value["protocol-used"]).toBe("ALEX");
  });

  it("Price validation should block execution if price out of bounds", () => {
    configureSystem();

    // Fund payer
    mint("mock-usdcx", payer, 10_000_000n);
    expect(simnet.callPublicFn("agent-vault", "deposit", [USDCX, Cl.uint(10_000_000n)], payer).result).toBeOk(Cl.uint(10_000_000n));

    // Create job
    expect(
      simnet.callPublicFn(
        "job-escrow",
        "create-job",
        [USDCX, Cl.principal(agent), Cl.uint(9_000_000n), Cl.uint(90_000n), Cl.uint(8_000_000n), Cl.uint(1n), Cl.uint(100n)],
        payer
      ).result
    ).toBeOk(Cl.uint(0n));

    // Try to execute with price outside bounds
    const minPrice = Cl.uint(95000000); // $0.95
    const maxPrice = Cl.uint(105000000); // $1.05
    const badPrice = Cl.uint(110000000); // $1.10 (above max)
    const confidence = Cl.uint(500000);
    const publishTime = Cl.uint(simnet.blockHeight);
    const expo = Cl.int(-8);

    // Price validation should fail
    const priceValidation = simnet.callPublicFn(
      "pyth-price-oracle",
      "validate-price-for-execution",
      [USDCX, ALEX, minPrice, maxPrice, badPrice, confidence, publishTime, expo],
      agent
    );
    expect(priceValidation.result).toBeErr(Cl.uint(402)); // ERR-PRICE-DEVIATION

    // Execution should fail if price validation fails
    const executorParams = Cl.bufferFromHex("0x00");
    const execution = simnet.callPublicFn(
      "job-router",
      "execute-job-with-price-validation",
      [
        Cl.uint(0n),
        Cl.contractPrincipal(deployer, "alex-executor"),
        USDCX,
        Cl.uint(9_000_000n),
        executorParams,
        USDCX,
        ALEX,
        minPrice,
        maxPrice,
        badPrice, // Bad price
        confidence,
        publishTime,
        expo,
      ],
      agent
    );

    expect(execution.result).toBeErr(Cl.uint(402)); // Price validation error
  });
});
