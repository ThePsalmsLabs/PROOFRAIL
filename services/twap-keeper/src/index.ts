/**
 * TWAP Keeper Service
 * 
 * Periodically calls pyth-price-oracle.update-twap() for registered token pairs.
 * Runs every N blocks to maintain accurate Time-Weighted Average Price data.
 */

import { 
  makeContractCall, 
  broadcastTransaction, 
  AnchorMode,
  PostConditionMode,
  getNonce,
  createStacksPrivateKey,
  privateKeyToString,
  getAddressFromPrivateKey,
  uintCV,
  intCV,
  principalCV,
} from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface Config {
  stacks: {
    network: 'testnet' | 'mainnet';
    pythOracle: string; // Contract principal
    keeperPrivateKey: string;
  };
  pyth: {
    apiUrl: string;
  };
  pairs: Array<{
    baseToken: string;
    quoteToken: string;
    feedId: string;
    updateIntervalBlocks: number; // Update every N blocks
  }>;
}

interface PriceData {
  price: bigint;
  confidence: bigint;
  publishTime: number;
  expo: number;
}

export class TWAPKeeper {
  private config: Config;
  private stacksNetwork: StacksTestnet | StacksMainnet;
  private isRunning: boolean = false;
  private lastUpdateBlocks: Map<string, number> = new Map();

  constructor(config: Config) {
    this.config = config;
    this.stacksNetwork = config.stacks.network === 'mainnet'
      ? new StacksMainnet()
      : new StacksTestnet();
  }

  /**
   * Start the TWAP keeper service
   */
  async start(): Promise<void> {
    console.log('📊 TWAP Keeper Service Starting...');
    console.log(`🌐 Stacks Network: ${this.config.stacks.network}`);
    console.log(`📝 Pyth Oracle: ${this.config.stacks.pythOracle}`);
    console.log(`📈 Tracking ${this.config.pairs.length} token pair(s)\n`);

    this.isRunning = true;

    // Start monitoring loop
    while (this.isRunning) {
      try {
        await this.updateTWAPs();
      } catch (error) {
        console.error('❌ Error in TWAP update loop:', error);
      }

      // Wait before next check (check every block)
      await this.sleep(30000); // 30 seconds
    }
  }

  /**
   * Stop the keeper service
   */
  stop(): void {
    console.log('\n🛑 Stopping TWAP keeper...');
    this.isRunning = false;
  }

  /**
   * Update TWAP for all registered pairs
   */
  private async updateTWAPs(): Promise<void> {
    const currentBlock = await this.getCurrentBlockHeight();

    for (const pair of this.config.pairs) {
      const pairKey = `${pair.baseToken}/${pair.quoteToken}`;
      const lastUpdate = this.lastUpdateBlocks.get(pairKey) || 0;
      const blocksSinceUpdate = currentBlock - lastUpdate;

      // Check if it's time to update this pair
      if (blocksSinceUpdate >= pair.updateIntervalBlocks) {
        try {
          await this.updateTWAP(pair, currentBlock);
          this.lastUpdateBlocks.set(pairKey, currentBlock);
        } catch (error) {
          console.error(`Failed to update TWAP for ${pairKey}:`, error);
        }
      }
    }
  }

  /**
   * Update TWAP for a specific token pair
   */
  private async updateTWAP(
    pair: Config['pairs'][0],
    currentBlock: number
  ): Promise<void> {
    console.log(`📊 Updating TWAP for ${pair.baseToken}/${pair.quoteToken}...`);

    // Fetch current price from Pyth API
    const priceData = await this.fetchPythPrice(pair.feedId);

    // Call update-twap on contract
    const [oracleDeployer, oracleName] = this.parseContract(this.config.stacks.pythOracle);
    const privateKey = createStacksPrivateKey(this.config.stacks.keeperPrivateKey);
    const senderAddress = getAddressFromPrivateKey(privateKey, this.stacksNetwork.version);

    const nonce = await getNonce(senderAddress, this.stacksNetwork);

    const tx = await makeContractCall({
      contractAddress: oracleDeployer,
      contractName: oracleName,
      functionName: 'update-twap',
      functionArgs: [
        principalCV(pair.baseToken),
        principalCV(pair.quoteToken),
        uintCV(priceData.price),
        uintCV(priceData.confidence),
        uintCV(priceData.publishTime),
        intCV(priceData.expo),
      ],
      senderKey: privateKeyToString(privateKey),
      network: this.stacksNetwork,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      nonce,
      fee: BigInt(2000), // Keeper fee
    });

    const result = await broadcastTransaction(tx, this.stacksNetwork);
    
    if (result.error) {
      throw new Error(`Transaction failed: ${result.error}`);
    }

    console.log(`   ✅ TWAP updated (TX: ${result.txid})`);
  }

  /**
   * Fetch price data from Pyth Network API
   */
  private async fetchPythPrice(feedId: string): Promise<PriceData> {
    const apiUrl = this.config.pyth.apiUrl || 'https://hermes.pyth.network/v2/updates/price';
    
    try {
      const response = await axios.get(`${apiUrl}?ids[]=${feedId}`, {
        timeout: 10000,
      });
      
      const priceData = response.data.parsed?.[0] || response.data;
      
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
   * Get current block height
   */
  private async getCurrentBlockHeight(): Promise<number> {
    const apiBaseUrl = this.config.stacks.network === 'mainnet'
      ? 'https://api.hiro.so'
      : 'https://api.testnet.hiro.so';
    
    try {
      const response = await axios.get(`${apiBaseUrl}/v2/info`);
      return response.data.stacks_tip_height;
    } catch (error) {
      console.error('Failed to get block height:', error);
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
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main entry point
if (require.main === module) {
  const config: Config = {
    stacks: {
      network: (process.env.STACKS_NETWORK as 'testnet' | 'mainnet') || 'testnet',
      pythOracle: process.env.PYTH_ORACLE || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pyth-price-oracle',
      keeperPrivateKey: process.env.KEEPER_PRIVATE_KEY || '',
    },
    pyth: {
      apiUrl: process.env.PYTH_API_URL || 'https://hermes.pyth.network/v2/updates/price',
    },
    pairs: [
      {
        baseToken: process.env.BASE_TOKEN || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-usdcx',
        quoteToken: process.env.QUOTE_TOKEN || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-alex',
        feedId: process.env.FEED_ID || '',
        updateIntervalBlocks: parseInt(process.env.UPDATE_INTERVAL_BLOCKS || '10'),
      },
    ],
  };

  if (!config.stacks.keeperPrivateKey) {
    console.error('❌ KEEPER_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  const keeper = new TWAPKeeper(config);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    keeper.stop();
    process.exit(0);
  });

  keeper.start().catch(console.error);
}
