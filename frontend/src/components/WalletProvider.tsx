"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { connectWallet, disconnectWallet, getConnectedStxAddress } from "@/lib/wallet";

type WalletContextValue = {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => getConnectedStxAddress());

  const value = useMemo<WalletContextValue>(() => {
    return {
      address,
      connect: async () => {
        const addr = await connectWallet();
        setAddress(addr);
      },
      disconnect: () => {
        disconnectWallet();
        setAddress(null);
      },
      refresh: () => {
        setAddress(getConnectedStxAddress());
      },
    };
  }, [address]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

