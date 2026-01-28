# PROOFRAIL: B2B INFRASTRUCTURE PRODUCT SPECIFICATION
## Verifiable Execution Infrastructure for Institutional DeFi Automation

**Version:** 3.0 (Infrastructure Pivot)
**Date:** January 28, 2026
**Target Market:** B2B (Protocols, Funds, DAOs, Agent Platforms)
**Positioning:** Infrastructure, not consumer app

---

## EXECUTIVE SUMMARY

### The Pivot

ProofRail is pivoting from a **retail agent marketplace** to a **B2B execution infrastructure protocol**. Instead of selling to end users, we sell to:

1. **DeFi Protocols** - Vaults, yield optimizers, rebalancing strategies
2. **Institutional Funds** - Multi-chain treasury management firms
3. **Protocol DAOs** - Automated treasury operations
4. **Agent Platforms** - SaaS providers needing payment rails + execution verification

### The Product

**ProofRail = Verifiable Execution Layer + Cross-Chain Liquidity Bridge + Real-Time Price Oracle**

**What customers buy:**
- SDK/API for automated DeFi execution
- Cryptographic execution receipts for audit compliance
- Price-aware routing (Pyth integration prevents bad fills)
- Native USDC cross-chain bridging (Circle CCTP)
- Protocol-agnostic executor framework

**Revenue model:**
- Execution fees (5-10 bps per transaction)
- Bridge fees (10 bps on cross-chain transfers)
- Enterprise licensing for white-label deployments
- Data licensing (execution analytics to market makers)

---

## MARKET ANALYSIS (B2B FOCUS)

### Target Customer Segments

#### 1. **DeFi Protocols (Primary)**
**Examples:**
- Yield aggregators (Yearn-style on Stacks)
- Rebalancing vaults
- DCA (Dollar-Cost Averaging) products
- Liquid staking protocols

**Pain Points:**
- Need trustless automation without custody
- Require verifiable audit trails for compliance
- Want cross-chain liquidity access
- Need price protection (prevent sandwich attacks)

**Our Solution:**
- Executor framework → plug into any DeFi protocol
- Verifiable receipts → audit compliance
- CCTP bridge → cross-chain USDC access
- Pyth oracle → price protection

**TAM:** 50-100 protocols on Stacks/Bitcoin L2 ecosystem (growing)

#### 2. **Institutional Treasury Managers (Secondary)**
**Examples:**
- Multi-chain funds (managing $10M-$500M)
- DAO treasuries (GitcoinDAO, Aave, Uniswap)
- Crypto-native hedge funds

**Pain Points:**
- Need automated rebalancing across chains
- Require institutional-grade audit trails
- Want price guarantees before execution
- Compliance requirements (SOC2, attestations)

**Our Solution:**
- CCTP bridge → move USDC from Ethereum/Base to Stacks
- Pyth prices → real-time validation before execution
- Receipt system → cryptographic proof for auditors
- Multi-job batching → efficient treasury operations

**TAM:** $500B+ in DAO treasuries, $2T+ in institutional crypto assets

#### 3. **Agent-as-a-Service Platforms (Tertiary)**
**Examples:**
- Agent marketplaces (like AutoGPT for crypto)
- Trading bot platforms
- Automation-as-a-service providers

**Pain Points:**
- Need payment rails for agent compensation
- Require non-custodial execution (users won't give keys)
- Want verifiable proof agents did the work
- Need cross-protocol support

**Our Solution:**
- Job escrow → trustless payment settlement
- Executor trait → support any protocol
- Receipt hashing → verifiable proof
- Fee claiming → automated agent compensation

**TAM:** Emerging market, ~$10M ARR currently, growing 300%+ YoY

---

## PRODUCT ARCHITECTURE (WITH NEW INTEGRATIONS)

### System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                     MULTI-CHAIN LIQUIDITY LAYER                  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │  Ethereum USDC │  │  Arbitrum USDC │  │   Base USDC      │   │
│  └───────┬────────┘  └───────┬────────┘  └────────┬─────────┘   │
│          │                   │                     │             │
│          └───────────────────┴─────────────────────┘             │
│                              │                                   │
│                    ┌─────────▼──────────┐                        │
│                    │  Circle CCTP Bridge│                        │
│                    │   (Native USDC)    │                        │
│                    └─────────┬──────────┘                        │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  cctp-bridge-adapter │ ← NEW CONTRACT
                    │  (Stacks Contract)   │
                    └──────────┬───────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                    PROOFRAIL CORE PROTOCOL                        │
│                                                                   │
│  ┌──────────────────┐      ┌──────────────────┐                 │
│  │  agent-vault     │◄────►│  job-escrow      │                 │
│  │  (USDCx custody) │      │  (Lifecycle)     │                 │
│  └────────┬─────────┘      └────────┬─────────┘                 │
│           │                         │                            │
│           │         ┌───────────────▼────────┐                  │
│           │         │   job-router           │                  │
│           │         │   (Orchestration)      │                  │
│           │         └───────┬────────────────┘                  │
│           │                 │                                    │
│  ┌────────▼─────────┐      │      ┌──────────────────┐          │
│  │ pyth-price-oracle│◄─────┘      │ stake-registry   │          │
│  │ (Price feeds)    │             │ (Stake tracking) │          │
│  └──────────────────┘             └──────────────────┘          │
│           ▲                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
    ┌───────▼──────────┐
    │  Pyth Network    │
    │  (Off-chain price│
    │   attestations)  │
    └──────────────────┘
            ▲
            │
    ┌───────┴──────────┐
    │  Market Data     │
    │  (Exchanges)     │
    └──────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│                    PROTOCOL EXECUTOR LAYER                        │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ alex-executor  │  │ velar-executor │  │ custom-executor  │   │
│  │ (ALEX DEX)     │  │ (Velar DEX)    │  │ (Any protocol)   │   │
│  └────────────────┘  └────────────────┘  └──────────────────┘   │
│                  (All implement executor-trait)                   │
└──────────────────────────────────────────────────────────────────┘
```

### New Integrations Explained

#### **1. Pyth Price Oracle Integration** ([pyth-price-oracle.clar](contracts/pyth-price-oracle.clar))

**What it does:**
- Fetches real-time price data for token pairs
- Validates prices before job execution
- Prevents execution during extreme price deviations
- Maintains TWAP (Time-Weighted Average Price) for smoothing

**B2B Value:**
- **Price protection**: Institutional clients won't get rekt by flash crashes
- **Compliance**: Auditable price validation for every trade
- **MEV resistance**: Prevents sandwich attacks on large trades
- **Confidence intervals**: Only execute when Pyth confidence is acceptable

**Integration flow:**
```clarity
1. Job created with min/max price constraints
2. Agent calls job-router.execute-job()
3. Router calls pyth-price-oracle.validate-price-for-execution()
4. If price valid → execute swap
5. If price invalid → revert with ERR-PRICE-DEVIATION
6. Receipt includes validated price at execution
```

**Real-world example:**
```
DAO wants to swap $1M USDC → ALEX
- Sets min price: $0.95/ALEX (5% slippage tolerance)
- Sets max price: $1.05/ALEX
- Pyth reports: $1.02/ALEX ± 1% confidence
- ✅ Execution proceeds
- Receipt hash includes: validated-price, confidence-interval, timestamp
```

#### **2. Circle CCTP Bridge Integration** ([cctp-bridge-adapter.clar](contracts/cctp-bridge-adapter.clar))

**What it does:**
- Bridges native USDC from Ethereum/Arbitrum/Base/Optimism → Stacks
- Direct deposit to ProofRail vault (seamless UX)
- Tracks cross-chain message attestations
- Prevents replay attacks

**B2B Value:**
- **Cross-chain liquidity**: Institutions hold USDC on Ethereum, use on Stacks
- **Native USDC**: No wrapped tokens, no bridge risk (Circle's infrastructure)
- **Seamless UX**: Bridge → deposit → create job in one flow
- **Institutional grade**: Circle CCTP has $10B+ monthly volume

**Integration flow:**
```
1. Institution initiates bridge from Ethereum
   - Calls CCTP TokenMessenger on Ethereum
   - Burns USDC on Ethereum
   - Emits CCTP message

2. Circle attestation service signs message

3. Message relayed to Stacks
   - cctp-bridge-adapter.receive-cctp-message()
   - Mints native USDC on Stacks
   - Wraps to USDCx (or uses native)
   - Auto-deposits to ProofRail vault

4. Institution's vault balance increases
   - Ready to create jobs immediately
   - No manual deposit transaction needed
```

**Real-world example:**
```
Hedge fund managing $100M treasury:
1. Holds USDC on Arbitrum (low fees, high liquidity)
2. Wants to stake on ALEX (Stacks)
3. Bridges $10M USDC via CCTP (10 bps fee)
4. Arrives as USDCx in ProofRail vault
5. Creates 100 jobs × $100K each (automated execution)
6. Agents execute over 1 week (DCA strategy)
7. Fund gets ALEX stake positions + verifiable receipts for compliance
```

---

## BUSINESS MODEL (B2B REVENUE STREAMS)

### 1. **Execution Fees** (Primary Revenue)

**Model:** Take 5-10 basis points on every job execution

**Example:**
- Protocol executes $1M in swaps per month
- Fee: 10 bps = $1,000/month
- 100 protocols = $100K MRR

**Why protocols pay:**
- Trustless automation (don't need to custody funds)
- Audit trails (compliance requirement)
- Price protection (worth paying for)

### 2. **Bridge Fees** (Secondary Revenue)

**Model:** Take 10 bps on cross-chain USDC bridging

**Example:**
- Institution bridges $50M/month Ethereum → Stacks
- Fee: 10 bps = $50,000/month
- 10 institutions = $500K MRR

**Why institutions pay:**
- Native USDC (no slippage vs. wrapped assets)
- Auto-deposit (saves gas + time)
- Integrated experience (one-stop shop)

### 3. **Enterprise Licensing** (Tertiary Revenue)

**Model:** White-label ProofRail for protocols building their own infrastructure

**Example:**
- Yield optimizer wants branded execution layer
- License fee: $50K setup + $10K/month
- Includes: Custom executor, dedicated support, SLA

**Why protocols pay:**
- Don't want to build from scratch
- Need proven security (audited contracts)
- Want to focus on product, not infra

### 4. **Data Licensing** (Future Revenue)

**Model:** Sell aggregated execution data to market makers / analytics firms

**Example:**
- Execution flow data (what's being traded, when, how much)
- Price impact analytics
- Agent performance benchmarks
- Sell to: Trading firms, analytics platforms, researchers

**Why they pay:**
- Unique on-chain execution data
- Institutional-quality (verifiable receipts)
- Not available elsewhere

---

## GO-TO-MARKET STRATEGY (B2B)

### Phase 1: Protocol Partnerships (Months 1-3)

**Target:** 5-10 DeFi protocols on Stacks

**Approach:**
1. Build integration SDK (Clarity + TypeScript)
2. Offer free pilot period (3 months, no fees)
3. Provide integration support (technical docs + dedicated Slack)
4. Co-marketing (joint blog posts, case studies)

**Success metric:** 5 protocols processing >$100K/month via ProofRail

**Likely prospects:**
- ALEX (yield products)
- Velar (AMM automation)
- Arkadiko (collateral management)
- StackingDAO (liquid staking)

### Phase 2: Institutional Pilots (Months 3-6)

**Target:** 3-5 institutional treasury managers

**Approach:**
1. Build institutional dashboard (multi-job batching, reporting)
2. Integrate CCTP bridge (cross-chain access)
3. Pyth price feeds (risk management)
4. SOC2 compliance prep (audit trail export)

**Success metric:** $50M+ bridged via CCTP, $500K in fee revenue

**Likely prospects:**
- DAO treasury managers (Aave, Gitcoin, etc.)
- Bitcoin-focused funds (wanting Stacks exposure)
- Multi-chain funds (arbitrage strategies)

### Phase 3: Agent Platform Integration (Months 6-12)

**Target:** 2-3 agent marketplace platforms

**Approach:**
1. Agent SDK (monitoring, execution, fee claiming)
2. White-label options (branded execution layer)
3. Revenue share model (50/50 split on fees)

**Success metric:** 100+ agents using ProofRail, $1M+ in fee revenue

**Likely prospects:**
- Fetch.ai (agent marketplace)
- AutoGPT ecosystem (crypto automation)
- Custom trading bot platforms

---

## TECHNICAL INTEGRATION GUIDE (For B2B Customers)

### For DeFi Protocols: Build a Custom Executor

**Step 1: Implement the executor-trait**

```clarity
;; your-protocol-executor.clar
(impl-trait .executor-trait.executor-trait)

(define-public (execute
  (job-id uint)
  (input-amount uint)
  (executor-params (buff 2048))
)
  (let (
    ;; Decode protocol-specific params
    (params (unwrap! (decode-params executor-params) ERR-INVALID-PARAMS))

    ;; Validate with Pyth price oracle
    (price-valid (try! (contract-call? .pyth-price-oracle validate-price-for-execution
      (get input-token params)
      (get output-token params)
      (get min-price params)
      (get max-price params))))

    ;; Execute your protocol's logic
    (output-amount (try! (contract-call? .your-dex swap
      input-amount
      (get min-out params))))
  )
    (ok {
      success: true,
      receipt-hash: (generate-receipt job-id input-amount output-amount),
      output-amount: output-amount,
      output-token: (get output-token params),
      protocol-name: "YourProtocol",
      action-type: "swap",
      gas-used: u0,
      metadata: 0x00
    })
  )
)
```

**Step 2: Register your executor**

```clarity
;; Users create jobs targeting your executor
(contract-call? .job-escrow create-job-generic
  .token-usdcx            ;; input token
  agent-principal         ;; agent to execute
  u1000000                ;; max input (1 USDC)
  u10000                  ;; agent fee (0.01 USDC)
  .your-protocol-executor ;; YOUR EXECUTOR
  encoded-params          ;; your protocol's params
  u100                    ;; expiry blocks
)
```

**Step 3: Earn fees from integrations**

ProofRail charges 10 bps on execution → you get 90 bps vs. user doing it manually

### For Institutions: Bridge and Automate

**Step 1: Bridge USDC from Ethereum**

```typescript
// On Ethereum
const cctp = new CircleCCTP(ethereumProvider)
await cctp.depositForBurn(
  amount,
  STACKS_DOMAIN_ID,
  stacksRecipient,
  USDC_ADDRESS
)

// Automated relayer watches for attestation
// Calls cctp-bridge-adapter on Stacks
// USDCx appears in your ProofRail vault
```

**Step 2: Create batched jobs (DCA strategy)**

```typescript
const jobs = []
for (let i = 0; i < 10; i++) {
  jobs.push(await proofrail.createJob({
    agent: APPROVED_AGENT,
    maxInput: 100_000_000n, // 100 USDC per job
    agentFee: 1_000_000n,    // 1 USDC fee
    minAlexOut: calculateMinOutput(currentPrice * 0.95), // 5% slippage
    lockPeriod: 32n,
    expiryBlocks: 1000n + (i * 100n), // Stagger expirations
  }))
}

// Agents execute over time
// You get verifiable receipts for each execution
```

**Step 3: Export audit reports**

```typescript
const jobs = await proofrail.getJobsByPayer(institutionAddress)
const receipts = jobs.map(j => ({
  jobId: j.jobId,
  executedAt: j.executedAtBlock,
  receiptHash: j.receiptHash,
  priceAtExecution: j.validatedPrice,
  outputAmount: j.outputAmount,
}))

// Export as CSV for auditors
exportToCSV(receipts, 'q1-2026-proofrail-executions.csv')
```

---

## WHY THIS WORKS (B2B THESIS)

### 1. **Distribution Advantage**

**B2C (original plan):**
- Need to acquire 10,000 retail users
- CAC: $50-$200 per user
- Total CAC: $500K - $2M
- Churn: 80%+ (retail crypto is brutal)

**B2B (new plan):**
- Need 10-20 protocol integrations
- CAC: $5K-$10K per protocol (direct sales + integration support)
- Total CAC: $50K - $200K
- Churn: <20% (sticky infrastructure)

**10x cheaper customer acquisition + better retention**

### 2. **Revenue Concentration**

**B2C:**
- Average user: $100-$1,000 in vault
- 10,000 users × $500 avg × 10 bps/month = $5K MRR
- Need massive scale to hit $100K MRR

**B2B:**
- Average protocol: $1M-$50M monthly volume
- 10 protocols × $10M avg × 10 bps = $100K MRR
- 100 protocols = $1M MRR

**Faster path to meaningful revenue**

### 3. **Moat via Data**

**B2C:**
- No moat (users can switch to any automation tool)
- Network effects are weak
- Price competition inevitable

**B2B:**
- Execution data = valuable asset
- Protocols integrate once, switching cost is high
- Data licensing creates secondary revenue stream
- Each integration makes platform more valuable (execution liquidity)

**Stronger defensibility**

### 4. **Alignment with Stacks Ecosystem**

**Reality check:**
- Stacks has 5-10K daily active users (tiny for retail)
- But ~50-100 active protocols
- Those protocols NEED infrastructure
- Bitcoin L2 narrative = institutional interest

**Better product-market fit for B2B on Stacks**

---

## SUCCESS METRICS (6-Month Milestones)

### Month 3:
- ✅ 5 protocol integrations live
- ✅ $1M+ monthly execution volume
- ✅ $10K MRR from execution fees
- ✅ Pyth integration live on testnet
- ✅ CCTP bridge adapter deployed (testnet)

### Month 6:
- ✅ 15 protocol integrations
- ✅ 3 institutional pilots (treasury management)
- ✅ $50M+ monthly execution volume
- ✅ $10M+ bridged via CCTP
- ✅ $50K MRR ($600K ARR run-rate)
- ✅ First enterprise license sold ($50K)

### Month 12:
- ✅ 50+ protocol integrations
- ✅ 10 institutional clients
- ✅ $500M+ monthly execution volume
- ✅ $100M+ bridged via CCTP
- ✅ $500K MRR ($6M ARR)
- ✅ Series A fundraise ($20M+ valuation)

---

## COMPETITIVE ANALYSIS (B2B Infrastructure)

### Ethereum L2s:
- **Gelato Network**: Centralized execution, no verifiable receipts
- **Chainlink Automation**: Limited to price feeds, no execution
- **Keep3r Network**: Agent marketplace, but no escrow

**ProofRail advantage:**
- Verifiable receipts (cryptographic proof)
- Escrow-based payment (trustless)
- Bitcoin L2 positioning (institutional narrative)

### Solana:
- **Clockwork**: Scheduled transactions, no escrow
- **Squads**: Multi-sig automation, manual approvals

**ProofRail advantage:**
- Full automation (no manual approvals needed)
- Cross-chain liquidity (CCTP)
- Price-aware execution (Pyth)

### Stacks Ecosystem:
- **No direct competitors** (first mover advantage)

**ProofRail positioning:**
- De facto execution infrastructure for Stacks DeFi
- First CCTP bridge integration on Stacks
- Only Pyth-integrated execution layer

---

## IMPLEMENTATION ROADMAP

### Q1 2026: Foundation
- ✅ Deploy Pyth price oracle integration (testnet)
- ✅ Deploy CCTP bridge adapter (testnet)
- ✅ Build protocol SDK (Clarity + TypeScript)
- ✅ First 3 protocol integrations (ALEX, Velar, Arkadiko)
- ✅ Launch institutional dashboard (batching, reporting)

### Q2 2026: Traction
- ✅ Mainnet deployment (all contracts audited)
- ✅ CCTP bridge live (Ethereum → Stacks)
- ✅ 10 protocol integrations
- ✅ First institutional pilot ($10M+ bridged)
- ✅ $50K MRR

### Q3 2026: Scale
- ✅ Multi-chain CCTP (Arbitrum, Base, Optimism → Stacks)
- ✅ Agent platform partnerships (2-3 platforms)
- ✅ Data analytics dashboard (execution metrics)
- ✅ $200K MRR

### Q4 2026: Enterprise
- ✅ SOC2 compliance certification
- ✅ Enterprise SLAs (99.9% uptime guarantees)
- ✅ White-label deployments (3+ protocols)
- ✅ Data licensing revenue stream launched
- ✅ $500K MRR
- ✅ Series A fundraise

---

## CONCLUSION: THE B2B THESIS

### Why B2B is the Right Move

1. **Better unit economics**: $100K MRR with 10 customers vs. 10,000 customers
2. **Stronger moat**: Integration switching costs + data network effects
3. **Faster PMF validation**: 5 protocols using it = clear signal
4. **Institutional narrative**: Bitcoin L2 + Circle CCTP = credible story
5. **Revenue diversification**: Execution fees + bridge fees + licensing + data

### The Unique Value Proposition

**ProofRail is the only protocol offering:**
- ✅ Verifiable execution receipts (cryptographic proof)
- ✅ Price-aware routing (Pyth integration)
- ✅ Cross-chain USDC access (Circle CCTP)
- ✅ Protocol-agnostic execution (trait-based)
- ✅ Bitcoin L2 settlement (Stacks security)

### Next Steps

1. **Finalize Pyth integration** (testnet deployment this week)
2. **Build CCTP bridge relayer** (automated message attestation)
3. **Ship protocol SDK** (documentation + code examples)
4. **Outbound sales** (reach out to 20 Stacks protocols)
5. **First pilot** (ALEX integration as reference customer)

**This is the path to $10M ARR on Stacks.**

---

**END OF B2B INFRASTRUCTURE SPEC**
