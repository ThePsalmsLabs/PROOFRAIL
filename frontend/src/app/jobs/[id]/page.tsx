"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  cancelJob,
  claimStake,
  claimAgentFee,
  executeSwapStakeJob,
  getJob,
  getStakePosition,
  getUserStakeInfo,
} from "@/lib/proofrail";
import { getErrorMessage } from "@/lib/errors";
import { useWallet } from "@/components/WalletProvider";

function explorerTx(txid: string) {
  const clean = txid.startsWith("0x") ? txid : `0x${txid}`;
  return `https://explorer.hiro.so/txid/${clean}?chain=testnet`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function statusLabel(status: bigint) {
  switch (status) {
    case 0n:
      return "OPEN";
    case 1n:
      return "EXECUTED";
    case 2n:
      return "CANCELLED";
    case 3n:
      return "EXPIRED";
    default:
      return `UNKNOWN(${status})`;
  }
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const jobId = useMemo(() => BigInt(params.id), [params.id]);

  const { address } = useWallet();
  const [job, setJob] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);

  const [swapAmount, setSwapAmount] = useState("100000");

  const [stakeInfo, setStakeInfo] = useState<unknown | null>(null);
  const [stakePositions, setStakePositions] = useState<unknown[]>([]);

  async function refresh() {
    if (!address) return;
    setError(null);
    setTxid(null);
    try {
      const j = await getJob(address, jobId);
      setJob(j ?? null);

      const info = await getUserStakeInfo(address, address);
      setStakeInfo(info ?? null);

      const infoRec = asRecord(info);
      const positionCount = (infoRec?.["position-count"] as bigint | undefined) ?? 0n;
      const max = positionCount > 10n ? 10n : positionCount; // avoid huge reads
      const positions = await Promise.all(
        Array.from({ length: Number(max) }, (_, i) => BigInt(i)).map(async (sid) => getStakePosition(address, address, sid))
      );
      setStakePositions(positions);
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Failed to load job.");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, jobId]);

  const jobRec = asRecord(job);
  const innerJob = jobRec && jobRec["type"] === "some" ? jobRec["value"] : job;
  const innerRec = asRecord(innerJob);
  const status = (innerRec?.["status"] as bigint | undefined) ?? undefined;
  const payer = (innerRec?.["payer"] as string | undefined) ?? undefined;
  const agent = (innerRec?.["agent"] as string | undefined) ?? undefined;

  const isPayer = address && payer && address === payer;
  const isAgent = address && agent && address === agent;

  async function runAction(fn: () => Promise<{ txid: string }>) {
    setBusy(true);
    setError(null);
    setTxid(null);
    try {
      const res = await fn();
      setTxid(res.txid);
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Job #{jobId.toString()}</h1>
          <p className="mt-1 text-sm text-zinc-400">On-chain job details and actions.</p>
        </div>
        <Link href="/jobs" className="text-sm text-zinc-300 hover:text-zinc-100">
          Back
        </Link>
      </div>

      {!address ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-300">
          Connect your wallet to view and act on jobs.
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-200">{error}</div>
      ) : !job ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-300">Job not found.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Details</h2>
              <span className="text-xs text-zinc-300">{status !== undefined ? statusLabel(status) : "—"}</span>
            </div>
            <div className="mt-4">
              <pre className="overflow-auto rounded-lg bg-black/40 p-3 text-xs text-zinc-200">
                {JSON.stringify(innerJob, null, 2)}
              </pre>
            </div>
            {txid ? (
              <p className="mt-4 text-sm text-zinc-300">
                Tx:{" "}
                <a className="font-mono underline hover:text-zinc-100" href={explorerTx(txid)} target="_blank">
                  {txid}
                </a>
              </p>
            ) : null}
            <button
              className="mt-4 rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
              onClick={refresh}
              disabled={busy}
            >
              Refresh
            </button>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
              <h2 className="text-sm font-semibold">Job actions</h2>
              <p className="mt-1 text-xs text-zinc-400">Actions are permissioned by payer/agent roles.</p>

              <div className="mt-4 flex flex-col gap-3">
                <button
                  className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
                  onClick={() => runAction(() => cancelJob(jobId))}
                  disabled={busy || !isPayer}
                  title={!isPayer ? "Only payer can cancel" : ""}
                >
                  Cancel job (payer)
                </button>

                <div className="rounded-lg border border-zinc-800 bg-black/30 p-3">
                  <div className="text-xs font-semibold text-zinc-200">Execute swap+stake (agent)</div>
                  <label className="mt-2 block text-xs text-zinc-300">
                    Swap amount (USDCx base units)
                    <input
                      className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(e.target.value)}
                      inputMode="numeric"
                    />
                  </label>
                  <button
                    className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                    onClick={() =>
                      runAction(() => executeSwapStakeJob({ jobId, swapAmount: BigInt(swapAmount) }))
                    }
                    disabled={busy || !isAgent}
                    title={!isAgent ? "Only agent can execute" : ""}
                  >
                    Execute
                  </button>
                </div>

                <button
                  className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
                  onClick={() => runAction(() => claimAgentFee(jobId))}
                  disabled={busy || !isAgent}
                  title={!isAgent ? "Only agent can claim fee" : ""}
                >
                  Claim agent fee (agent)
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
              <h2 className="text-sm font-semibold">Your stakes (ALEX)</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Registry view for connected wallet. (Shows first 10 positions.)
              </p>
              <div className="mt-4">
                {stakeInfo ? (
                  <pre className="overflow-auto rounded-lg bg-black/40 p-3 text-xs text-zinc-200">
                    {JSON.stringify(stakeInfo, null, 2)}
                  </pre>
                ) : (
                  <span className="text-sm text-zinc-400">Loading…</span>
                )}
              </div>
              {stakePositions.length ? (
                <div className="mt-4 space-y-2">
                  {stakePositions.map((pos, i) => {
                    const posRec = asRecord(pos);
                    const claimed = posRec?.["claimed"] === true;
                    return (
                      <div
                        key={i}
                        className="rounded-lg border border-zinc-800 bg-black/30 p-3 text-xs text-zinc-200"
                      >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">stake-id: {i}</div>
                        <div className="text-zinc-400">{claimed ? "claimed" : "active"}</div>
                      </div>
                      <pre className="mt-2 overflow-auto">{JSON.stringify(pos, null, 2)}</pre>
                      <button
                        className="mt-3 rounded-md bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
                        onClick={() => runAction(() => claimStake(BigInt(i)))}
                        disabled={busy || claimed}
                      >
                        Claim stake
                      </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

