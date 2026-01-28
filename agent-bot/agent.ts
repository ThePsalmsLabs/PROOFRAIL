import { 
  Cl, 
  ClarityValue, 
  cvToValue, 
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  getAddressFromPrivateKey,
  TransactionVersion,
  createStacksPrivateKey,
  privateKeyToString,
  getNonce,
  callReadOnlyFunction,
  ReadOnlyFunctionOptions,
  uintCV,
  contractPrincipalCV,
  principalCV,
} from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

/**
 * PROOFRAIL Automated Agent Bot
 *
 * This agent continuously monitors for jobs assigned to it and executes them automatically.
 * It earns fees for successful job execution.
 */

export interface AgentConfig {
  agentAddress: string;
  privateKey: string;
  network: 'testnet' | 'mainnet' | 'devnet';
  contracts: {
    jobEscrow: string;
    alexExecutor: string;
    mockUsdcx: string;
    mockAlex: string;
    mockSwapHelper: string;
    mockAlexStaking: string;
  };
  monitoring: {
    pollIntervalMs: number;
    maxGasPrice: number;
    minFeeAmount: number;
  };
}

export interface Job {
  jobId: number;
  payer: string;
  agent: string;
  inputToken: string;
  maxInputAmount: bigint;
  agentFeeAmount: bigint;
  minAlexOut: bigint;
  lockPeriod: bigint;
  expiryBlock: bigint;
  status: number;
  createdAtBlock: bigint;
  feePaid: boolean;
}

export class ProofRailAgent {
  private config: AgentConfig;
  private network: StacksTestnet | StacksMainnet;
  private isRunning: boolean = false;
  private apiBaseUrl: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.network = config.network === 'mainnet'
      ? new StacksMainnet()
      : new StacksTestnet();
    this.apiBaseUrl = config.network === 'mainnet'
      ? 'https://api.hiro.so'
      : 'https://api.testnet.hiro.so';
  }

  /**
   * Start the automated agent bot
   */
  async start(): Promise<void> {
    console.log('🤖 PROOFRAIL Agent Bot Starting...');
    console.log(`📍 Agent Address: ${this.config.agentAddress}`);
    console.log(`🌐 Network: ${this.config.network}`);
    console.log(`⏱️  Poll Interval: ${this.config.monitoring.pollIntervalMs}ms\n`);

    this.isRunning = true;

    while (this.isRunning) {
      try {
        await this.monitorAndExecute();
      } catch (error) {
        console.error('❌ Error in monitoring loop:', error);
      }

      // Wait before next poll
      await this.sleep(this.config.monitoring.pollIntervalMs);
    }
  }

  /**
   * Stop the agent bot
   */
  stop(): void {
    console.log('\n🛑 Stopping agent bot...');
    this.isRunning = false;
  }

  /**
   * Main monitoring and execution loop
   */
  private async monitorAndExecute(): Promise<void> {
    console.log(`🔍 [${new Date().toISOString()}] Scanning for jobs...`);

    // Get all open jobs assigned to this agent
    const jobs = await this.getMyOpenJobs();

    if (jobs.length === 0) {
      console.log('   No jobs found');
      return;
    }

    console.log(`   Found ${jobs.length} job(s)`);

    for (const job of jobs) {
      await this.processJob(job);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    console.log(`\n📋 Processing Job #${job.jobId}`);
    console.log(`   Payer: ${job.payer}`);
    console.log(`   Fee: ${job.agentFeeAmount} USDCx`);
    console.log(`   Max Input: ${job.maxInputAmount} USDCx`);

    // Check if job is profitable
    if (job.agentFeeAmount < BigInt(this.config.monitoring.minFeeAmount)) {
      console.log(`   ⏭️  Skipping: Fee too low (${job.agentFeeAmount} < ${this.config.monitoring.minFeeAmount})`);
      return;
    }

    // Check if job is about to expire
    const currentBlock = await this.getCurrentBlockHeight();
    const blocksUntilExpiry = Number(job.expiryBlock - BigInt(currentBlock));

    if (blocksUntilExpiry < 5) {
      console.log(`   ⏭️  Skipping: Job expires in ${blocksUntilExpiry} blocks`);
      return;
    }

    console.log(`   ⏳ Expiry: ${blocksUntilExpiry} blocks remaining`);

    // Price validation (if enabled)
    if (this.config.priceValidation?.enabled) {
      try {
        const priceValid = await this.validatePrice(job);
        if (!priceValid) {
          console.log(`   ⏭️  Skipping: Price validation failed`);
          return;
        }
      } catch (error) {
        console.error(`   ⚠️  Price validation error:`, error);
        // Continue execution if price validation fails (don't block jobs)
      }
    }

    try {
      // Execute the job
      await this.executeJob(job);

      // Claim the fee
      await this.claimFee(job.jobId);

      console.log(`   ✅ Job #${job.jobId} completed successfully!`);
    } catch (error) {
      console.error(`   ❌ Failed to execute job #${job.jobId}:`, error);
    }
  }

  /**
   * Validate price using Pyth oracle (if enabled)
   */
  private async validatePrice(job: Job): Promise<boolean> {
    if (!this.config.priceValidation?.enabled) {
      return true; // Skip validation if disabled
    }

    console.log(`   💹 Validating price...`);

    try {
      // Fetch price data from Pyth API (pull integration)
      // In production, this would call Pyth's API to get latest price
      const [pythDeployer, pythName] = this.parseContract(this.config.contracts.pythOracle);
      const [usdcxDeployer] = this.parseContract(this.config.contracts.mockUsdcx);
      const [alexDeployer] = this.parseContract(this.config.contracts.mockAlex);

      // For now, return true - actual implementation would:
      // 1. Fetch price from Pyth API
      // 2. Validate price is within acceptable range
      // 3. Check price freshness
      console.log(`   ✅ Price validation passed (mock)`);
      return true;
    } catch (error) {
      console.error(`   ❌ Price validation error:`, error);
      return false;
    }
  }

  /**
   * Fetch price data from Pyth Network API
   */
  private async fetchPythPrice(feedId: string): Promise<{
    price: bigint;
    confidence: bigint;
    publishTime: number;
    expo: number;
  }> {
    // Pyth pull API endpoint
    const apiUrl = this.config.priceValidation?.pythApiUrl || 'https://hermes.pyth.network/v2/updates/price';
    
    try {
      const response = await fetch(`${apiUrl}?ids[]=${feedId}`);
      if (!response.ok) {
        throw new Error(`Pyth API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      // Parse Pyth price data structure
      const priceData = data.parsed?.[0] || data;
      
      return {
        price: BigInt(priceData.price?.price || 0),
        confidence: BigInt(priceData.price?.conf || 0),
        publishTime: priceData.price?.publish_time || Math.floor(Date.now() / 1000),
        expo: priceData.price?.expo || -8,
      };
    } catch (error) {
      console.error('Failed to fetch Pyth price:', error);
      throw error;
    }
  }

  /**
   * Execute a job by calling alex-executor
   */
  private async executeJob(job: Job): Promise<void> {
    console.log(`   🔧 Executing job...`);

    // Calculate swap amount (use 50% of max input for safety margin)
    const swapAmount = job.maxInputAmount / BigInt(2);

    const [escrowDeployer, escrowName] = this.parseContract(this.config.contracts.jobEscrow);
    const [executorDeployer, executorName] = this.parseContract(this.config.contracts.alexExecutor);
    const [usdcxDeployer, usdcxName] = this.parseContract(this.config.contracts.mockUsdcx);
    const [alexDeployer, alexName] = this.parseContract(this.config.contracts.mockAlex);
    const [swapDeployer, swapName] = this.parseContract(this.config.contracts.mockSwapHelper);
    const [stakingDeployer, stakingName] = this.parseContract(this.config.contracts.mockAlexStaking);

    const privateKey = createStacksPrivateKey(this.config.privateKey);
    const senderAddress = getAddressFromPrivateKey(privateKey, this.network.version);

    // Get nonce
    const nonce = await getNonce(senderAddress, this.network);

    const tx = await makeContractCall({
      contractAddress: executorDeployer,
      contractName: executorName,
      functionName: 'execute-swap-stake-job',
      functionArgs: [
        uintCV(job.jobId),
        contractPrincipalCV(usdcxDeployer, usdcxName),
        contractPrincipalCV(alexDeployer, alexName),
        contractPrincipalCV(swapDeployer, swapName),
        contractPrincipalCV(stakingDeployer, stakingName),
        uintCV(100_000_000n), // factor
        uintCV(swapAmount),
      ],
      senderKey: privateKeyToString(privateKey),
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      nonce,
      fee: BigInt(1000), // Base fee
    });

    console.log(`   📤 Broadcasting transaction...`);
    console.log(`   💰 Swap amount: ${swapAmount} USDCx`);
    console.log(`   🎯 Min ALEX out: ${job.minAlexOut}`);

    const txId = await this.broadcastTransaction(tx);
    console.log(`   📝 Transaction ID: ${txId}`);

    await this.waitForTransaction(txId);
    console.log(`   ✅ Job executed successfully`);
  }

  /**
   * Claim fee after successful execution
   */
  private async claimFee(jobId: number): Promise<void> {
    console.log(`   💵 Claiming fee...`);

    const [escrowDeployer, escrowName] = this.parseContract(this.config.contracts.jobEscrow);
    const [usdcxDeployer, usdcxName] = this.parseContract(this.config.contracts.mockUsdcx);

    const privateKey = createStacksPrivateKey(this.config.privateKey);
    const senderAddress = getAddressFromPrivateKey(privateKey, this.network.version);

    // Get nonce
    const nonce = await getNonce(senderAddress, this.network);

    const tx = await makeContractCall({
      contractAddress: escrowDeployer,
      contractName: escrowName,
      functionName: 'claim-fee',
      functionArgs: [
        uintCV(jobId),
        contractPrincipalCV(usdcxDeployer, usdcxName),
      ],
      senderKey: privateKeyToString(privateKey),
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      nonce,
      fee: BigInt(1000),
    });

    const txId = await this.broadcastTransaction(tx);
    console.log(`   📝 Transaction ID: ${txId}`);

    await this.waitForTransaction(txId);
    console.log(`   ✅ Fee claimed successfully`);
  }

  /**
   * Get all open jobs assigned to this agent
   */
  private async getMyOpenJobs(): Promise<Job[]> {
    const [escrowDeployer, escrowName] = this.parseContract(this.config.contracts.jobEscrow);
    const privateKey = createStacksPrivateKey(this.config.privateKey);
    const senderAddress = getAddressFromPrivateKey(privateKey, this.network.version);

    try {
      // Get next job ID (nonce)
      const nextIdResult = await callReadOnlyFunction({
        contractAddress: escrowDeployer,
        contractName: escrowName,
        functionName: 'get-next-job-id',
        functionArgs: [],
        network: this.network,
        senderAddress,
      });

      const nextId = cvToValue(nextIdResult);
      const nextIdNum = typeof nextId === 'bigint' ? Number(nextId) : Number(nextId);

      if (nextIdNum === 0) {
        return [];
      }

      // Fetch jobs in batches (check last 100 jobs)
      const startId = Math.max(0, nextIdNum - 100);
      const jobs: Job[] = [];

      for (let id = startId; id < nextIdNum; id++) {
        try {
          const jobResult = await callReadOnlyFunction({
            contractAddress: escrowDeployer,
            contractName: escrowName,
            functionName: 'get-job',
            functionArgs: [uintCV(id)],
            network: this.network,
            senderAddress,
          });

          const jobData = cvToValue(jobResult);
          
          // Check if job exists and matches our agent
          if (jobData && typeof jobData === 'object' && !Array.isArray(jobData)) {
            const job = jobData as Record<string, unknown>;
            const agent = job.agent as string;
            const status = typeof job.status === 'bigint' ? Number(job.status) : Number(job.status);

            // Filter: must be assigned to this agent and status must be OPEN (0)
            if (agent === this.config.agentAddress && status === 0) {
              jobs.push({
                jobId: id,
                payer: job.payer as string,
                agent: agent,
                inputToken: job['input-token'] as string,
                maxInputAmount: typeof job['max-input-amount'] === 'bigint' 
                  ? job['max-input-amount'] 
                  : BigInt(job['max-input-amount'] as number),
                agentFeeAmount: typeof job['agent-fee-amount'] === 'bigint'
                  ? job['agent-fee-amount']
                  : BigInt(job['agent-fee-amount'] as number),
                minAlexOut: typeof job['min-alex-out'] === 'bigint'
                  ? job['min-alex-out']
                  : BigInt(job['min-alex-out'] as number),
                lockPeriod: typeof job['lock-period'] === 'bigint'
                  ? job['lock-period']
                  : BigInt(job['lock-period'] as number),
                expiryBlock: typeof job['expiry-block'] === 'bigint'
                  ? job['expiry-block']
                  : BigInt(job['expiry-block'] as number),
                status: status,
                createdAtBlock: typeof job['created-at-block'] === 'bigint'
                  ? job['created-at-block']
                  : BigInt(job['created-at-block'] as number),
                feePaid: job['fee-paid'] as boolean,
              });
            }
          }
        } catch (error) {
          // Job might not exist, skip it
          continue;
        }
      }

      return jobs;
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      return [];
    }
  }

  /**
   * Get current block height
   */
  private async getCurrentBlockHeight(): Promise<number> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/v2/info`);
      if (!response.ok) {
        throw new Error(`Failed to fetch block height: ${response.statusText}`);
      }
      const data = await response.json() as { stacks_tip_height: number };
      return data.stacks_tip_height;
    } catch (error) {
      console.error('Failed to get current block height:', error);
      throw error;
    }
  }

  /**
   * Parse contract principal into [deployer, contractName]
   */
  private parseContract(contractPrincipal: string): [string, string] {
    const parts = contractPrincipal.split('.');
    if (parts.length !== 2) {
      throw new Error(`Invalid contract principal: ${contractPrincipal}`);
    }
    return [parts[0], parts[1]];
  }

  /**
   * Broadcast a transaction with retry logic
   */
  private async broadcastTransaction(tx: any): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await broadcastTransaction(tx, this.network);
        if (response.error) {
          throw new Error(`Transaction broadcast failed: ${response.error}`);
        }
        return response.txid;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const delay = attempt * 1000; // Exponential backoff
          console.log(`   ⚠️  Broadcast attempt ${attempt} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Failed to broadcast transaction after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForTransaction(txId: string, maxWaitBlocks = 10): Promise<void> {
    const startBlock = await this.getCurrentBlockHeight();
    const endBlock = startBlock + maxWaitBlocks;

    console.log(`   ⏳ Waiting for confirmation (block ${startBlock} to ${endBlock})...`);

    while (true) {
      const currentBlock = await this.getCurrentBlockHeight();
      
      if (currentBlock > endBlock) {
        throw new Error(`Transaction ${txId} not confirmed after ${maxWaitBlocks} blocks`);
      }

      try {
        const response = await fetch(`${this.apiBaseUrl}/extended/v1/tx/${txId}`);
        if (response.ok) {
          const txData = await response.json() as { tx_status: string };
          
          if (txData.tx_status === 'success') {
            console.log(`   ✅ Transaction confirmed at block ${currentBlock}`);
            return;
          }
          
          if (txData.tx_status === 'abort_by_response' || txData.tx_status === 'abort_by_post_condition') {
            throw new Error(`Transaction ${txId} failed: ${txData.tx_status}`);
          }
        }
      } catch (error) {
        // Transaction might not be in mempool yet, continue waiting
      }

      await this.sleep(5000); // Wait 5 seconds before checking again
    }
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Example usage
if (require.main === module) {
  const config: AgentConfig = {
    agentAddress: process.env.AGENT_ADDRESS || 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5',
    privateKey: process.env.AGENT_PRIVATE_KEY || '0x...',
    network: 'devnet',
    contracts: {
      jobEscrow: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.job-escrow',
      alexExecutor: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.alex-executor',
      mockUsdcx: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-usdcx',
      mockAlex: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-alex',
      mockSwapHelper: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-swap-helper',
      mockAlexStaking: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-alex-staking-v2',
    },
    monitoring: {
      pollIntervalMs: 30000, // Check every 30 seconds
      maxGasPrice: 1000,
      minFeeAmount: 10000, // Minimum 10k USDCx fee to execute
    },
  };

  const agent = new ProofRailAgent(config);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    agent.stop();
    process.exit(0);
  });

  agent.start().catch(console.error);
}
