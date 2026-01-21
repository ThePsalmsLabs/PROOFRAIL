import { Cl, cvToHex, cvToValue, parseReadOnlyResponse } from "@stacks/transactions";
import { HIRO_API } from "./config.mjs";

export function json(value) {
  return JSON.stringify(
    value,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

export function unwrapOptional(value) {
  if (value == null) return null;
  if (typeof value === "object" && value && value.type === "some") return value.value;
  if (typeof value === "object" && value && value.type === "none") return null;
  return value;
}

export function formatTxid(txid) {
  return txid.startsWith("0x") ? txid : `0x${txid}`;
}

export function explorerTx(txid) {
  return `https://explorer.hiro.so/txid/${formatTxid(txid)}?chain=testnet`;
}

export async function callReadOnly({ contractAddress, contractName, functionName, functionArgs, sender }) {
  const url = `${HIRO_API}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;
  const body = {
    sender,
    arguments: (functionArgs ?? []).map(cvToHex),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`call-read failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const cv = parseReadOnlyResponse(json);
  return cvToValue(cv);
}

export async function waitForTx(txid, { timeoutMs = 120_000, pollMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const id = formatTxid(txid).replace(/^0x/, "");
  while (Date.now() < deadline) {
    const res = await fetch(`${HIRO_API}/extended/v1/tx/${id}`);
    if (res.ok) {
      const json = await res.json();
      if (json.tx_status === "success") return json;
      if (json.tx_status === "abort_by_response" || json.tx_status === "abort_by_post_condition") {
        throw new Error(`Tx aborted (${json.tx_status}): ${JSON.stringify(json)}`);
      }
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
  throw new Error(`Timed out waiting for tx ${txid}`);
}

export const cv = {
  uint: n => Cl.uint(BigInt(n)),
  principal: p => Cl.principal(p),
  contractPrincipal: (address, name) => Cl.contractPrincipal(address, name),
};

