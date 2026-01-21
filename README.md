## PROOFRAIL

On-chain job escrow + vault on Stacks, with a router that can swap USDCx→ALEX and stake on behalf of a user, producing a deterministic receipt hash.

This repo contains:

- **Clarity 4 smart contracts** (`contracts/`)
- **Simnet tests** with Clarinet/Vitest (`tests/`)
- **Testnet deployment plans** (`deployments/`)
- **Next.js UI** (`frontend/`)
- **Agent CLI** for monitoring/executing/claiming (`scripts/agent/`)

## Quickstart (local simnet)

### Prereqs

- `clarinet` installed
- Node.js 20+ (this repo uses ESM)

### Run tests

```bash
npm install
npm run test
```

Run only the end-to-end integration test:

```bash
npm run test -- tests/integration.test.ts
```

## Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

The UI is configured for the **testnet deployment** in `frontend/src/lib/proofrail-config.ts`.

## Agent CLI (testnet)

The agent CLI signs and broadcasts contract calls using a local private key.

```bash
export STACKS_PRIVATE_KEY=...   # testnet key
npm run agent -- --help
```

Common flows:

```bash
export STACKS_PRIVATE_KEY=...
npm run agent -- monitor --limit 25
npm run agent -- execute --job-id 0 --swap-amount 100000
npm run agent -- claim-fee --job-id 0
```

Mint demo tokens (deployer-only, for the mock testnet token contracts):

```bash
export STACKS_PRIVATE_KEY=...   # deployer key
npm run agent -- mint-usdcx --to ST...PAYER --amount 5000000
npm run agent -- mint-alex-to-swap --amount 1000000000
```

## Docs

- `INTEGRATION.md`: developer integration + call flows
- `DEMO_VIDEO.md`: 90-second demo recording script

