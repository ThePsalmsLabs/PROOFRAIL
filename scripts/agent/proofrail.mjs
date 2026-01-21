#!/usr/bin/env node

import networkPkg from "@stacks/network";
import { Cl, broadcastTransaction, getAddressFromPrivateKey, makeContractCall } from "@stacks/transactions";
import { CONTRACTS, SWAP_FACTOR } from "./config.mjs";
import { callReadOnly, explorerTx, json, parseArgs, requireEnv, unwrapOptional, waitForTx } from "./utils.mjs";

const { StacksTestnet } = networkPkg;

function help() {
  // Keep this short—docs will go into INTEGRATION.md later.
  console.log(`
PROOFRAIL agent CLI (testnet)

Env:
  STACKS_PRIVATE_KEY=<hex private key>   (required for tx-sending commands)

Commands:
  address
  monitor [--limit 50]
  job --job-id <id>
  mint-usdcx --to <principal> --amount <amount>
  mint-alex --to <principal> --amount <amount>
  mint-alex-to-swap --amount <amount>
  execute --job-id <id> --swap-amount <amount> [--factor <n>]
  claim-fee --job-id <id>
  claim-stake --stake-id <id>

Examples:
  STACKS_PRIVATE_KEY=... node scripts/agent/proofrail.mjs address
  STACKS_PRIVATE_KEY=... node scripts/agent/proofrail.mjs monitor --limit 25
  STACKS_PRIVATE_KEY=... node scripts/agent/proofrail.mjs mint-usdcx --to ST... --amount 5000000
  STACKS_PRIVATE_KEY=... node scripts/agent/proofrail.mjs mint-alex-to-swap --amount 1000000000
  STACKS_PRIVATE_KEY=... node scripts/agent/proofrail.mjs execute --job-id 0 --swap-amount 100000
`.trim());
}

function getNetwork() {
  return new StacksTestnet();
}

function getKeyAndAddress() {
  const key = requireEnv("STACKS_PRIVATE_KEY");
  const address = getAddressFromPrivateKey(key, getNetwork());
  return { key, address };
}

function cp(c) {
  return Cl.contractPrincipal(c.address, c.name);
}

async function sendContractCall({ senderKey, contract, functionName, functionArgs }) {
  const network = getNetwork();
  const tx = await makeContractCall({
    contractAddress: contract.address,
    contractName: contract.name,
    functionName,
    functionArgs,
    senderKey,
    network,
  });
  const res = await broadcastTransaction({ transaction: tx, network });
  if (!res || !res.txid) throw new Error(`Broadcast failed: ${json(res)}`);
  return res.txid;
}

async function cmdAddress() {
  const { address } = getKeyAndAddress();
  console.log(address);
}

async function cmdMonitor(args) {
  const { address } = getKeyAndAddress();
  const limit = BigInt(args.limit ?? 50);

  const nextId = await callReadOnly({
    contractAddress: CONTRACTS.escrow.address,
    contractName: CONTRACTS.escrow.name,
    functionName: "get-next-job-id",
    functionArgs: [],
    sender: address,
  });

  const next = BigInt(nextId);
  const start = next > limit ? next - limit : 0n;

  console.log(`Scanning jobs [${start}..${next - 1n}] (sender=${address})`);
  for (let id = next; id > start; id--) {
    const jobId = id - 1n;
    const raw = await callReadOnly({
      contractAddress: CONTRACTS.escrow.address,
      contractName: CONTRACTS.escrow.name,
      functionName: "get-job",
      functionArgs: [Cl.uint(jobId)],
      sender: address,
    });
    const job = unwrapOptional(raw);
    if (!job) continue;
    const status = job.status;
    if (status === 0n) {
      console.log(
        `OPEN job #${jobId} payer=${job.payer} agent=${job.agent} maxInput=${job["max-input-usdcx"]} fee=${job["agent-fee-usdcx"]} expiry=${job["expiry-block"]}`
      );
    }
  }
}

async function cmdJob(args) {
  const { address } = getKeyAndAddress();
  const jobId = BigInt(args["job-id"]);
  const raw = await callReadOnly({
    contractAddress: CONTRACTS.escrow.address,
    contractName: CONTRACTS.escrow.name,
    functionName: "get-job",
    functionArgs: [Cl.uint(jobId)],
    sender: address,
  });
  console.log(json(raw));
}

async function cmdMintUsdcx(args) {
  const { key } = getKeyAndAddress();
  const to = args.to;
  const amount = BigInt(args.amount);
  if (!to || !args.amount) throw new Error("mint-usdcx requires --to and --amount");
  const txid = await sendContractCall({
    senderKey: key,
    contract: CONTRACTS.usdcx,
    functionName: "mint",
    functionArgs: [Cl.uint(amount), Cl.principal(to)],
  });
  console.log(`Broadcasted mint-usdcx tx: ${txid}`);
  console.log(explorerTx(txid));
  await waitForTx(txid);
  console.log("Confirmed.");
}

async function cmdMintAlex(args) {
  const { key } = getKeyAndAddress();
  const to = args.to;
  const amount = BigInt(args.amount);
  if (!to || !args.amount) throw new Error("mint-alex requires --to and --amount");
  const txid = await sendContractCall({
    senderKey: key,
    contract: CONTRACTS.alex,
    functionName: "mint",
    functionArgs: [Cl.uint(amount), Cl.principal(to)],
  });
  console.log(`Broadcasted mint-alex tx: ${txid}`);
  console.log(explorerTx(txid));
  await waitForTx(txid);
  console.log("Confirmed.");
}

async function cmdMintAlexToSwap(args) {
  const amount = BigInt(args.amount);
  if (!args.amount) throw new Error("mint-alex-to-swap requires --amount");
  const swapPrincipal = `${CONTRACTS.swap.address}.${CONTRACTS.swap.name}`;
  return cmdMintAlex({ to: swapPrincipal, amount: amount.toString() });
}

async function cmdExecute(args) {
  const { key, address } = getKeyAndAddress();
  const jobId = BigInt(args["job-id"]);
  const swapAmount = BigInt(args["swap-amount"]);
  const factor = args.factor ? BigInt(args.factor) : SWAP_FACTOR;

  const txid = await sendContractCall({
    senderKey: key,
    contract: CONTRACTS.router,
    functionName: "execute-swap-stake-job",
    functionArgs: [
      Cl.uint(jobId),
      cp(CONTRACTS.usdcx),
      cp(CONTRACTS.alex),
      cp(CONTRACTS.swap),
      cp(CONTRACTS.staking),
      Cl.uint(factor),
      Cl.uint(swapAmount),
    ],
  });

  console.log(`Broadcasted execute tx: ${txid}`);
  console.log(explorerTx(txid));
  await waitForTx(txid);
  console.log("Confirmed.");
  console.log(`Tip: now run claim-fee --job-id ${jobId}`);
}

async function cmdClaimFee(args) {
  const { key } = getKeyAndAddress();
  const jobId = BigInt(args["job-id"]);
  const txid = await sendContractCall({
    senderKey: key,
    contract: CONTRACTS.escrow,
    functionName: "claim-agent-fee",
    functionArgs: [Cl.uint(jobId), cp(CONTRACTS.usdcx)],
  });
  console.log(`Broadcasted claim-fee tx: ${txid}`);
  console.log(explorerTx(txid));
  await waitForTx(txid);
  console.log("Confirmed.");
}

async function cmdClaimStake(args) {
  const { key } = getKeyAndAddress();
  const stakeId = BigInt(args["stake-id"]);
  const txid = await sendContractCall({
    senderKey: key,
    contract: CONTRACTS.registry,
    functionName: "claim-stake",
    functionArgs: [cp(CONTRACTS.alex), cp(CONTRACTS.staking), Cl.uint(stakeId)],
  });
  console.log(`Broadcasted claim-stake tx: ${txid}`);
  console.log(explorerTx(txid));
  await waitForTx(txid);
  console.log("Confirmed.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") return help();

  if (cmd === "address") return cmdAddress();
  if (cmd === "monitor") return cmdMonitor(args);
  if (cmd === "job") return cmdJob(args);
  if (cmd === "mint-usdcx") return cmdMintUsdcx(args);
  if (cmd === "mint-alex") return cmdMintAlex(args);
  if (cmd === "mint-alex-to-swap") return cmdMintAlexToSwap(args);
  if (cmd === "execute") return cmdExecute(args);
  if (cmd === "claim-fee") return cmdClaimFee(args);
  if (cmd === "claim-stake") return cmdClaimStake(args);

  console.error(`Unknown command: ${cmd}\n`);
  help();
  process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

