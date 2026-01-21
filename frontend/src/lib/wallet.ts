"use client";

import { connect, disconnect, getLocalStorage, isConnected, request } from "@stacks/connect";
import type { MethodParams, MethodResult } from "@stacks/connect";
import type { ContractIdString } from "@stacks/transactions";
import { ClarityValue } from "@stacks/transactions";
import { STACKS_NETWORK } from "./proofrail-config";

export type ConnectedStxAccount = {
  address: string;
};

export function getConnectedStxAddress(): string | null {
  // During SSR / static generation, localStorage is not available.
  if (typeof window === "undefined") return null;
  if (!isConnected()) return null;
  const data = getLocalStorage();
  return data?.addresses?.stx?.[0]?.address ?? null;
}

export async function connectWallet(): Promise<string> {
  await connect({ forceWalletSelect: true });
  const addr = getConnectedStxAddress();
  if (!addr) throw new Error("Wallet connected but no STX address returned.");
  return addr;
}

export function disconnectWallet() {
  disconnect();
}

export async function callContract(params: {
  contract: ContractIdString; // address.contract-name
  functionName: string;
  functionArgs: ClarityValue[];
}) {
  const callParams: MethodParams<"stx_callContract"> = {
    contract: params.contract,
    functionName: params.functionName,
    functionArgs: params.functionArgs,
    network: STACKS_NETWORK,
  };
  const response = await request("stx_callContract", callParams);

  const txid = (response as MethodResult<"stx_callContract">).txid;
  if (!txid) throw new Error("Wallet did not return a txid for this transaction.");
  return { txid };
}

