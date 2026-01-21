"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CONTRACTS, contractId, DEPLOYER_ADDRESS } from "@/lib/proofrail-config";
import { getVaultBalance, type JsonClarity } from "@/lib/proofrail";
import { getErrorMessage } from "@/lib/errors";
import { useWallet } from "@/components/WalletProvider";

export default function Home() {
  const { address } = useWallet();
  const [vaultBalance, setVaultBalance] = useState<JsonClarity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vaultId = useMemo(() => contractId(CONTRACTS.vault), []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      setVaultBalance(null);
      if (!address) return;
      try {
        const bal = await getVaultBalance(address, address);
        if (!cancelled) setVaultBalance(bal);
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e) || "Failed to load vault balance.");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">PROOFRAIL</h1>
        <p className="max-w-2xl text-zinc-300">
          Connect a Stacks Testnet wallet to deposit USDCx into the vault, create jobs, and (as an agent)
          execute swap+stake jobs via the router.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Deployment</h2>
        <div className="mt-3 grid gap-2 text-sm text-zinc-300">
          <div>
            <span className="text-zinc-400">Deployer</span>: <span className="font-mono">{DEPLOYER_ADDRESS}</span>
          </div>
          <div>
            <span className="text-zinc-400">Vault</span>: <span className="font-mono">{vaultId}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Vault balance</h2>
          <p className="mt-1 text-xs text-zinc-400">Requires wallet connection.</p>
          <div className="mt-4 text-sm">
            {!address ? (
              <span className="text-zinc-400">Connect your wallet to load balance.</span>
            ) : error ? (
              <span className="text-red-300">{error}</span>
            ) : !vaultBalance ? (
              <span className="text-zinc-400">Loading…</span>
            ) : (
              <pre className="overflow-auto rounded-lg bg-black/40 p-3 text-xs text-zinc-200">
                {JSON.stringify(vaultBalance, null, 2)}
              </pre>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Link
              href="/deposit"
              className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              Deposit / withdraw
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Jobs</h2>
          <p className="mt-1 text-xs text-zinc-400">Create and track job lifecycle on-chain.</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/jobs/create"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Create job
            </Link>
            <Link
              href="/jobs"
              className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              View jobs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
