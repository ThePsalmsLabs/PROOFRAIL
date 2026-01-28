# Circle xReserve Relayer Service

Off-chain service that watches Ethereum for USDC deposits to Circle xReserve and relays minting attestations to Stacks.

## Overview

The xReserve relayer service:
1. Monitors Ethereum for USDC deposits to Circle xReserve contract
2. Fetches minting attestation from Circle xReserve API
3. Submits `receive-bridge-message` to Stacks `bridge-adapter` with protocol=0 (xReserve)
4. Tracks processed deposits to prevent duplicates

## Why xReserve over CCTP?

- ✅ **Already live on Stacks** (launched December 2025)
- ✅ **Official Circle infrastructure** (same trust model as CCTP)
- ✅ **Stacks-specific** (designed for Stacks, not adapted)
- ✅ **1:1 USDC backing** (USDCx fully backed by USDC in xReserve)
- ✅ **Institutional-grade** (Circle is regulated, SOC2 compliant)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (create `.env` file):
```env
# Source chain (Ethereum)
ETHEREUM_RPC_URL=https://eth.llamarpc.com
XRESERVE_CONTRACT=0x...  # Circle xReserve contract on Ethereum

# Stacks
STACKS_NETWORK=testnet
BRIDGE_ADAPTER=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.cctp-bridge-adapter
RELAYER_PRIVATE_KEY=0x...  # Private key for relayer

# Circle xReserve API
XRESERVE_API_URL=https://api.circle.com/v1/xreserve
```

3. Build:
```bash
npm run build
```

4. Run:
```bash
npm start
```

## Architecture

```
Ethereum
    ↓ (USDC deposit)
Circle xReserve Contract
    ↓ (Deposit event)
Relayer Service
    ↓ (Fetch attestation)
Circle xReserve API
    ↓ (Minting attestation)
Relayer Service
    ↓ (Submit transaction)
Stacks bridge-adapter
    ↓ (receive-bridge-message, protocol=0)
USDCx minted on Stacks
    ↓ (Auto-deposit)
ProofRail vault
```

## Integration with Bridge Adapter

The relayer calls `receive-bridge-message` with `protocol=0` to indicate xReserve:

```clarity
(receive-bridge-message
  message
  attestation
  message-hash
  recipient
  amount
  source-domain
  u0  ;; protocol = 0 (xReserve)
)
```
