import { Cl, ClarityValue, cvToValue, principalCV } from '@stacks/transactions';
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

  constructor(config: AgentConfig) {
    this.config = config;
    this.network = config.network === 'mainnet'
      ? new StacksMainnet()
      : new StacksTestnet();
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
   * Execute a job by calling alex-executor
   */
  private async executeJob(job: Job): Promise<void> {
    console.log(`   🔧 Executing job...`);

    // Calculate swap amount (use 50% of max input for safety margin)
    const swapAmount = job.maxInputAmount / BigInt(2);

    const txOptions = {
      contractAddress: this.extractDeployer(this.config.contracts.alexExecutor),
      contractName: this.extractContractName(this.config.contracts.alexExecutor),
      functionName: 'execute-swap-stake-job',
      functionArgs: [
        Cl.uint(job.jobId),
        Cl.contractPrincipal(
          this.extractDeployer(this.config.contracts.mockUsdcx),
          this.extractContractName(this.config.contracts.mockUsdcx)
        ),
        Cl.contractPrincipal(
          this.extractDeployer(this.config.contracts.mockAlex),
          this.extractContractName(this.config.contracts.mockAlex)
        ),
        Cl.contractPrincipal(
          this.extractDeployer(this.config.contracts.mockSwapHelper),
          this.extractContractName(this.config.contracts.mockSwapHelper)
        ),
        Cl.contractPrincipal(
          this.extractDeployer(this.config.contracts.mockAlexStaking),
          this.extractContractName(this.config.contracts.mockAlexStaking)
        ),
        Cl.uint(95), // factor
        Cl.uint(Number(swapAmount))
      ],
      senderKey: this.config.privateKey,
      network: this.network,
      anchorMode: 1,
    };

    // In production, you'd use @stacks/transactions makeContractCall and broadcastTransaction
    console.log(`   📤 Broadcasting transaction...`);
    console.log(`   💰 Swap amount: ${swapAmount} USDCx`);
    console.log(`   🎯 Min ALEX out: ${job.minAlexOut}`);

    // TODO: Implement actual transaction broadcasting
    // const txId = await this.broadcastTransaction(txOptions);
    // await this.waitForTransaction(txId);

    console.log(`   ✅ Job executed (simulated)`);
  }

  /**
   * Claim fee after successful execution
   */
  private async claimFee(jobId: number): Promise<void> {
    console.log(`   💵 Claiming fee...`);

    const txOptions = {
      contractAddress: this.extractDeployer(this.config.contracts.jobEscrow),
      contractName: this.extractContractName(this.config.contracts.jobEscrow),
      functionName: 'claim-fee',
      functionArgs: [
        Cl.uint(jobId),
        Cl.contractPrincipal(
          this.extractDeployer(this.config.contracts.mockUsdcx),
          this.extractContractName(this.config.contracts.mockUsdcx)
        )
      ],
      senderKey: this.config.privateKey,
      network: this.network,
      anchorMode: 1,
    };

    // TODO: Implement actual transaction broadcasting
    console.log(`   ✅ Fee claimed (simulated)`);
  }

  /**
   * Get all open jobs assigned to this agent
   */
  private async getMyOpenJobs(): Promise<Job[]> {
    // TODO: Implement actual contract call to get jobs
    // This would use read-only contract calls to job-escrow
    // and filter by agent address and status=0 (open)

    // For simulation:
    const mockJobs: Job[] = [
      // {
      //   jobId: 0,
      //   payer: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      //   agent: this.config.agentAddress,
      //   inputToken: this.config.contracts.mockUsdcx,
      //   maxInputAmount: BigInt(1000000),
      //   agentFeeAmount: BigInt(50000),
      //   minAlexOut: BigInt(900000),
      //   lockPeriod: BigInt(12),
      //   expiryBlock: BigInt(1000),
      //   status: 0,
      //   createdAtBlock: BigInt(900),
      //   feePaid: false
      // }
    ];

    return mockJobs;
  }

  /**
   * Get current block height
   */
  private async getCurrentBlockHeight(): Promise<number> {
    // TODO: Implement actual API call to get current block height
    // from Stacks node
    return 950;
  }

  /**
   * Helper: Extract deployer address from contract principal
   */
  private extractDeployer(contractPrincipal: string): string {
    return contractPrincipal.split('.')[0];
  }

  /**
   * Helper: Extract contract name from contract principal
   */
  private extractContractName(contractPrincipal: string): string {
    return contractPrincipal.split('.')[1];
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
