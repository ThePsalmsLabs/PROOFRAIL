"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getJob, getNextJobId } from "@/lib/proofrail";
import { getErrorMessage } from "@/lib/errors";
import { useWallet } from "@/components/WalletProvider";

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

export default function JobsPage() {
  const { address } = useWallet();
  const [jobs, setJobs] = useState<Array<{ id: bigint; job: unknown | null }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connected = useMemo(() => Boolean(address), [address]);

  async function refresh() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const next = await getNextJobId(address);
      const maxScan = 50n;
      const start = next > maxScan ? next - maxScan : 0n;
      const ids: bigint[] = [];
      for (let i = start; i < next; i++) ids.push(i);
      ids.reverse(); // newest first

      const results = await Promise.all(
        ids.map(async (id) => {
          const j = await getJob(address, id);
          return { id, job: j ?? null };
        })
      );

      setJobs(results.filter((r) => r.job));
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Failed to load jobs.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-zinc-400">Scans the most recent on-chain jobs (up to 50).</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/jobs/create"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Create job
          </Link>
          <button
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
            onClick={refresh}
            disabled={!connected || busy}
          >
            Refresh
          </button>
        </div>
      </div>

      {!address ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-300">
          Connect your wallet to load jobs.
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-200">{error}</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-300">No jobs found.</div>
      ) : (
        <div className="space-y-3">
          {jobs.map(({ id, job }) => {
            const jobRec = asRecord(job);
            const inner =
              jobRec && jobRec["type"] === "some" ? jobRec["value"] : job; // optional wrapper (some/none)
            const innerRec = asRecord(inner);
            const status = (innerRec?.["status"] as bigint | undefined) ?? undefined;
            const payer = (innerRec?.["payer"] as string | undefined) ?? undefined;
            const agent = (innerRec?.["agent"] as string | undefined) ?? undefined;
            return (
              <Link
                key={id.toString()}
                href={`/jobs/${id.toString()}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Job #{id.toString()}</div>
                  <div className="text-xs text-zinc-300">{status !== undefined ? statusLabel(status) : "—"}</div>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-zinc-400">
                  <div className="font-mono">payer: {payer ?? "—"}</div>
                  <div className="font-mono">agent: {agent ?? "—"}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

