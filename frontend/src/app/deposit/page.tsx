"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deposit, getVaultBalance, withdraw } from "@/lib/proofrail";
import type { VaultBalance } from "@/lib/types/contracts";
import { getErrorMessage } from "@/lib/errors";
import { useWallet } from "@/components/WalletProvider";

function explorerTx(txid: string) {
  const clean = txid.startsWith("0x") ? txid : `0x${txid}`;
  return `https://explorer.hiro.so/txid/${clean}?chain=testnet`;
}

export default function DepositPage() {
  const { address } = useWallet();
  const [amount, setAmount] = useState<string>("1000000"); // 1.0 (if token has 6 decimals)
  const [busy, setBusy] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [vaultBalance, setVaultBalance] = useState<VaultBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!address) return;
    const bal = await getVaultBalance(address, address);
    setVaultBalance(bal);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setVaultBalance(null);
      setError(null);
      if (!address) return;
      try {
        const bal = await getVaultBalance(address, address);
        if (!cancelled) setVaultBalance(bal);
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e) || "Failed to load balance.");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  async function onDeposit() {
    setBusy(true);
    setError(null);
    setTxid(null);
    try {
      const amt = BigInt(amount);
      const res = await deposit(amt);
      setTxid(res.txid);
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Deposit failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onWithdraw() {
    setBusy(true);
    setError(null);
    setTxid(null);
    try {
      const amt = BigInt(amount);
      const res = await withdraw(amt);
      setTxid(res.txid);
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Withdraw failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vault</h1>
          <p className="mt-1 text-sm text-zinc-400">Deposit and withdraw USDCx (testnet mock token).</p>
        </div>
        <Link href="/" className="text-sm text-zinc-300 hover:text-zinc-100">
          Back
        </Link>
      </div>

      {!address ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-300">
          Connect your wallet to deposit/withdraw.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
            <h2 className="text-sm font-semibold">Actions</h2>
            <label className="mt-4 block text-sm text-zinc-300">
              Amount (base units)
              <input
                className="mt-2 w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <div className="mt-4 flex gap-3">
              <button
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                onClick={onDeposit}
                disabled={busy}
              >
                Deposit
              </button>
              <button
                className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
                onClick={onWithdraw}
                disabled={busy}
              >
                Withdraw
              </button>
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

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
            <h2 className="text-sm font-semibold">Current balance</h2>
            <div className="mt-4 text-sm">
              {error ? (
                <span className="text-red-300">{error}</span>
              ) : !vaultBalance ? (
                <span className="text-zinc-400">Loading…</span>
              ) : (
                <pre className="overflow-auto rounded-lg bg-black/40 p-3 text-xs text-zinc-200">
                  {JSON.stringify(vaultBalance, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2)}
                </pre>
              )}
            </div>
            <button
              className="mt-4 rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
              onClick={refresh}
              disabled={busy || !address}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

