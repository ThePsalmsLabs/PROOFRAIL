"use client";

import { useState } from "react";
import { useWallet } from "./WalletProvider";

export function WalletConnectButton() {
  const [busy, setBusy] = useState(false);
  const { address, connect, disconnect } = useWallet();
  const connected = Boolean(address);

  async function onConnect() {
    setBusy(true);
    try {
      await connect();
    } finally {
      setBusy(false);
    }
  }

  function onDisconnect() {
    disconnect();
  }

  return (
    <div className="flex items-center gap-3">
      {connected ? (
        <>
          <span className="text-xs text-zinc-300">
            {address?.slice(0, 6)}…{address?.slice(-6)}
          </span>
          <button
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
            onClick={onDisconnect}
            disabled={busy}
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          onClick={onConnect}
          disabled={busy}
        >
          Connect wallet
        </button>
      )}
    </div>
  );
}

