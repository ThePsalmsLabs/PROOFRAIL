# TWAP Keeper Service

Off-chain service that periodically updates Time-Weighted Average Price (TWAP) for registered token pairs.

## Overview

The TWAP keeper service:
1. Monitors registered token pairs
2. Fetches current prices from Pyth Network API
3. Calls `pyth-price-oracle.update-twap()` on Stacks
4. Runs every N blocks for each pair (configurable)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (create `.env` file):
```env
# Stacks
STACKS_NETWORK=testnet
PYTH_ORACLE=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pyth-price-oracle
KEEPER_PRIVATE_KEY=0x...  # Private key for keeper (must have STX for fees)

# Pyth
PYTH_API_URL=https://hermes.pyth.network/v2/updates/price

# Token Pairs (comma-separated)
BASE_TOKEN=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-usdcx
QUOTE_TOKEN=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-alex
FEED_ID=0x...  # Pyth feed ID
UPDATE_INTERVAL_BLOCKS=10  # Update every 10 blocks
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
Pyth Network API
    ↓ (Price data)
TWAP Keeper Service
    ↓ (update-twap transaction)
Stacks pyth-price-oracle
    ↓ (TWAP updated)
Token pair TWAP state
```

## Production Considerations

- **Multiple Pairs**: Configure multiple token pairs in config
- **Update Frequency**: Adjust `updateIntervalBlocks` based on volatility
- **Monitoring**: Add metrics and alerting for failed updates
- **High Availability**: Run multiple keepers for redundancy
