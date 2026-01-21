"use client";

import Link from "next/link";
import { useState } from "react";
import { createJob } from "@/lib/proofrail";
import { getErrorMessage } from "@/lib/errors";
import { useWallet } from "@/components/WalletProvider";

function explorerTx(txid: string) {
  const clean = txid.startsWith("0x") ? txid : `0x${txid}`;
  return `https://explorer.hiro.so/txid/${clean}?chain=testnet`;
}

export default function CreateJobPage() {
  const { address } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const [agent, setAgent] = useState("STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6"); // testnet wallet 1 in Clarinet
  const [maxInput, setMaxInput] = useState("1000000");
  const [agentFee, setAgentFee] = useState("50000");
  const [minAlexOut, setMinAlexOut] = useState("1");
  const [lockPeriod, setLockPeriod] = useState("1");
  const [expiryBlocks, setExpiryBlocks] = useState("50");

  async function onCreate() {
    setBusy(true);
    setError(null);
    setTxid(null);
    try {
      const res = await createJob({
        agent,
        maxInput: BigInt(maxInput),
        agentFee: BigInt(agentFee),
        minAlexOut: BigInt(minAlexOut),
        lockPeriod: BigInt(lockPeriod),
        expiryBlocks: BigInt(expiryBlocks),
      });
      setTxid(res.txid);
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Create job failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create job</h1>
          <p className="mt-1 text-sm text-zinc-400">Creates an on-chain job and locks funds in the vault.</p>
        </div>
        <Link href="/jobs" className="text-sm text-zinc-300 hover:text-zinc-100">
          Back
        </Link>
      </div>

      {!address ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-300">
          Connect your wallet to create a job.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-zinc-300">
              Agent STX address
              <input
                className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Max input (USDCx base units)
              <input
                className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Agent fee (USDCx base units)
              <input
                className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={agentFee}
                onChange={(e) => setAgentFee(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Min ALEX out (base units)
              <input
                className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={minAlexOut}
                onChange={(e) => setMinAlexOut(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Lock period (cycles)
              <input
                className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={lockPeriod}
                onChange={(e) => setLockPeriod(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Expiry (blocks from now)
              <input
                className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={expiryBlocks}
                onChange={(e) => setExpiryBlocks(e.target.value)}
                inputMode="numeric"
              />
            </label>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              onClick={onCreate}
              disabled={busy}
            >
              Create job
            </button>
            <Link href="/deposit" className="text-sm text-zinc-300 hover:text-zinc-100">
              Need to deposit first?
            </Link>
          </div>

          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          {txid ? (
            <p className="mt-4 text-sm text-zinc-300">
              Tx:{" "}
              <a className="font-mono underline hover:text-zinc-100" href={explorerTx(txid)} target="_blank">
                {txid}
              </a>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

