import { ClarityValue, cvToHex, parseReadOnlyResponse, ReadOnlyFunctionResponse } from "@stacks/transactions";
import { STACKS_API_BASE } from "./proofrail-config";

export async function callReadOnly(params: {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  senderAddress: string;
}): Promise<ClarityValue> {
  const url = `${STACKS_API_BASE}/v2/contracts/call-read/${params.contractAddress}/${params.contractName}/${params.functionName}`;
  const body = {
    sender: params.senderAddress,
    arguments: params.functionArgs.map(cvToHex),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Read-only call failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as ReadOnlyFunctionResponse;
  return parseReadOnlyResponse(json);
}

