# PROOFRAIL Automated Agent Bot

An automated agent service that continuously monitors for PROOFRAIL jobs and executes them to earn fees.

## Overview

The PROOFRAIL Agent Bot is an automated service that:
- 🔍 Monitors the blockchain for jobs assigned to your agent address
- ✅ Executes profitable jobs automatically
- 💰 Claims fees after successful execution
- 📊 Provides real-time logging and metrics

## Architecture

```
┌─────────────────────────────────────────┐
│         Agent Bot Service               │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  1. Monitor for Jobs             │  │
│  │     - Query job-escrow contract  │  │
│  │     - Filter by agent address    │  │
│  │     - Check profitability        │  │
│  └──────────┬───────────────────────┘  │
│             │                           │
│  ┌──────────▼───────────────────────┐  │
│  │  2. Execute Jobs                 │  │
│  │     - Call alex-executor         │  │
│  │     - Swap USDCx → ALEX         │  │
│  │     - Stake ALEX                 │  │
│  └──────────┬───────────────────────┘  │
│             │                           │
│  ┌──────────▼───────────────────────┐  │
│  │  3. Claim Fees                   │  │
│  │     - Call job-escrow.claim-fee  │  │
│  │     - Receive agent fee          │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ⏰ Repeat every 30 seconds            │
└─────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd agent-bot
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your agent credentials:

```bash
AGENT_ADDRESS=ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
AGENT_PRIVATE_KEY=your_private_key_here
NETWORK=devnet

# Update contract addresses after deployment
CONTRACT_JOB_ESCROW=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.job-escrow
CONTRACT_ALEX_EXECUTOR=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.alex-executor
# ... etc
```

### 3. Run the Agent

**Development mode (with TypeScript):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## Configuration

### Agent Identity

- `AGENT_ADDRESS`: Your Stacks wallet address (must match jobs assigned to you)
- `AGENT_PRIVATE_KEY`: Private key for signing transactions

### Contract Addresses

Update these after deploying PROOFRAIL contracts:

- `CONTRACT_JOB_ESCROW`: job-escrow contract principal
- `CONTRACT_ALEX_EXECUTOR`: alex-executor contract principal
- `CONTRACT_MOCK_USDCX`: USDCx token contract (use real on mainnet)
- `CONTRACT_MOCK_ALEX`: ALEX token contract (use real on mainnet)
- `CONTRACT_MOCK_SWAP_HELPER`: ALEX swap helper (use real on mainnet)
- `CONTRACT_MOCK_ALEX_STAKING`: ALEX staking contract (use real on mainnet)

### Monitoring Settings

- `POLL_INTERVAL_MS`: How often to check for new jobs (default: 30000ms = 30 seconds)
- `MIN_FEE_AMOUNT`: Minimum fee to consider job profitable (default: 10000 USDCx)
- `MAX_GAS_PRICE`: Maximum gas price willing to pay (default: 1000)

### Execution Strategy

- `SWAP_AMOUNT_PERCENT`: Percentage of max input to use (default: 50% for safety margin)
- `MAX_SLIPPAGE_PERCENT`: Maximum acceptable slippage (default: 5%)

## How It Works

### 1. Job Monitoring

The agent continuously polls the `job-escrow` contract to find jobs where:
- `agent` field matches your `AGENT_ADDRESS`
- `status` is `0` (open)
- `fee-paid` is `false`
- `expiry-block` is not imminent (> 5 blocks away)

### 2. Profitability Check

Before executing, the agent checks:
- Fee amount meets minimum threshold
- Job is not about to expire
- Gas costs are reasonable

### 3. Job Execution

The agent calls `alex-executor.execute-swap-stake-job` with:
- `job-id`: The job to execute
- `usdcx`: USDCx token contract
- `alex`: ALEX token contract
- `swap-helper`: ALEX swap helper contract
- `alex-staking`: ALEX staking contract
- `factor`: Swap factor (usually 95)
- `swap-amount`: Amount of USDCx to swap (50% of max for safety)

The executor:
1. Draws USDCx from vault
2. Swaps USDCx → ALEX via ALEX DEX
3. Stakes ALEX via stake-registry
4. Marks job as executed with UX data

### 4. Fee Claim

After successful execution, the agent calls `job-escrow.claim-fee` to receive the agent fee in USDCx.

## Example Output

```
🤖 PROOFRAIL Agent Bot Starting...
📍 Agent Address: ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
🌐 Network: devnet
⏱️  Poll Interval: 30000ms

🔍 [2026-01-22T10:30:00.000Z] Scanning for jobs...
   Found 2 job(s)

📋 Processing Job #0
   Payer: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
   Fee: 50000 USDCx
   Max Input: 1000000 USDCx
   ⏳ Expiry: 95 blocks remaining
   🔧 Executing job...
   📤 Broadcasting transaction...
   💰 Swap amount: 500000 USDCx
   🎯 Min ALEX out: 900000
   ✅ Job executed
   💵 Claiming fee...
   ✅ Fee claimed
   ✅ Job #0 completed successfully!

📋 Processing Job #1
   Payer: ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG
   Fee: 5000 USDCx
   ⏭️  Skipping: Fee too low (5000 < 10000)

🔍 [2026-01-22T10:30:30.000Z] Scanning for jobs...
   No jobs found
```

## Advanced Usage

### Custom Job Filtering

You can extend the agent to filter jobs based on custom criteria:

```typescript
// In agent.ts
private shouldExecuteJob(job: Job): boolean {
  // Only execute jobs from trusted payers
  const trustedPayers = [
    'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
  ];

  if (!trustedPayers.includes(job.payer)) {
    return false;
  }

  // Only execute if fee-to-input ratio is > 5%
  const feeRatio = Number(job.agentFeeAmount) / Number(job.maxInputAmount);
  if (feeRatio < 0.05) {
    return false;
  }

  return true;
}
```

### Multi-Agent Deployment

Run multiple agents for redundancy:

```bash
# Terminal 1: Agent A
AGENT_ADDRESS=ST1... AGENT_PRIVATE_KEY=0x... npm run dev

# Terminal 2: Agent B
AGENT_ADDRESS=ST2... AGENT_PRIVATE_KEY=0x... npm run dev
```

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["npm", "start"]
```

```bash
docker build -t proofrail-agent .
docker run -d --env-file .env proofrail-agent
```

## Monitoring and Logging

### Log Levels

Set `LOG_LEVEL` in `.env`:
- `debug`: Verbose logging
- `info`: Standard logging (default)
- `warn`: Warnings only
- `error`: Errors only

### Metrics

The agent tracks:
- Total jobs executed
- Total fees earned
- Success rate
- Average execution time
- Gas costs

(Metrics dashboard coming soon)

## Security Considerations

### Private Key Management

**Never commit your private key to git!**

Options for secure key management:
1. Environment variables (development)
2. AWS Secrets Manager (production)
3. Hardware wallet integration (future)

### Job Validation

The agent validates:
- Job is assigned to your address
- Job is not expired
- Fee is reasonable
- Gas costs are acceptable

### Error Handling

The agent gracefully handles:
- Network errors (retries)
- Failed transactions (logs and skips)
- Insufficient balance (alerts)
- Contract errors (logs and continues)

## Troubleshooting

### "No jobs found"

- Check that jobs are being created with your agent address
- Verify contract addresses in `.env` are correct
- Ensure you're on the right network (devnet/testnet/mainnet)

### "ERR-NOT-AGENT"

- Job is assigned to a different agent address
- Check `AGENT_ADDRESS` matches the job's `agent` field

### "ERR-EXPIRED"

- Job expired before execution
- Reduce `POLL_INTERVAL_MS` to check more frequently
- Skip jobs with < 10 blocks until expiry

### "Insufficient balance"

- Agent wallet needs STX for gas fees
- Fund your agent address with testnet/mainnet STX

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

Output will be in `dist/` directory.

### Adding New Executor Support

The agent currently supports `alex-executor`. To add support for other executors (Velar, Bitflow, etc.):

1. Add executor configuration to `AgentConfig`
2. Implement executor-specific execution logic
3. Update job filtering to detect executor type
4. Call appropriate executor contract

Example:

```typescript
private async executeJob(job: Job): Promise<void> {
  const executorType = await this.getExecutorType(job.executorContract);

  switch (executorType) {
    case 'alex':
      await this.executeAlexJob(job);
      break;
    case 'velar':
      await this.executeVelarJob(job);
      break;
    default:
      throw new Error(`Unsupported executor: ${executorType}`);
  }
}
```

## Roadmap

- [ ] Complete transaction broadcasting (currently simulated)
- [ ] Add real-time metrics dashboard
- [ ] Implement hardware wallet support
- [ ] Add multi-executor support (Velar, Bitflow)
- [ ] Create web UI for monitoring
- [ ] Add profit calculator
- [ ] Implement gas optimization strategies
- [ ] Add alert system (Telegram/Discord)

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Write tests
4. Submit a pull request

## License

MIT

## Support

- Documentation: See [../REFACTORING_COMPLETE.md](../REFACTORING_COMPLETE.md)
- Issues: https://github.com/your-repo/issues
- Discord: https://discord.gg/your-server

---

**Happy Agent-ing! 🤖💰**
