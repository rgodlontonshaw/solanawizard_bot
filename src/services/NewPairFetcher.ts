import {
    LIQUIDITY_STATE_LAYOUT_V4,
    LiquidityStateV4,
  } from '@raydium-io/raydium-sdk';
  import {
    Connection,
    Commitment,
  } from '@solana/web3.js';
  import { RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 } from '../liquidity';
  import { retrieveEnvVariable } from '../utils';
  import pino from 'pino';
  import { Metaplex } from '@metaplex-foundation/js';
  import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
import { TokenInfo } from '../models/TokenInfo';

  const fetch = require('node-fetch');

  const transport = pino.transport({
    targets: [{
      level: 'trace',
      target: 'pino-pretty',
      options: {},
    }],
  });
  
  export const logger = pino(
    {
      redact: ['poolKeys'],
      serializers: {
        error: pino.stdSerializers.err,
      },
      base: undefined,
    },
    transport,
  );
  
  const network = 'mainnet-beta';
  const RPC_ENDPOINT = retrieveEnvVariable('RPC_ENDPOINT', logger);
  const RPC_WEBSOCKET_ENDPOINT = retrieveEnvVariable('RPC_WEBSOCKET_ENDPOINT', logger);
  
  const solanaConnection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
  });
  const metaplex = Metaplex.make(solanaConnection);

  const commitment: Commitment = retrieveEnvVariable('COMMITMENT_LEVEL', logger) as Commitment;
  
  let existingLiquidityPools: Set<string> = new Set<string>();
  
  const runListener = async () => {
    const runTimestamp = Math.floor(new Date().getTime() / 1000);
    const raydiumSubscriptionId = solanaConnection.onProgramAccountChange(
      RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
      async (updatedAccountInfo) => {
        const key = updatedAccountInfo.accountId.toString();
        const poolState: LiquidityStateV4 = LIQUIDITY_STATE_LAYOUT_V4.decode(updatedAccountInfo.accountInfo.data);
        const poolOpenTime = parseInt(poolState.toString());
        const existing = existingLiquidityPools.has(key);
      
  
        if (parseInt(poolState.poolOpenTime.toString()) > runTimestamp && !existing) {
         // const _ = processRaydiumPool(updatedAccountInfo.accountId, poolState); //FOR THE TRANSACTION
          existingLiquidityPools.add(key);
          const metadataPda = metaplex.nfts().pdas().metadata({ mint: poolState.baseMint });
          const tokenDetails = await Metadata.fromAccountAddress(solanaConnection, metadataPda);
          logger.info(tokenDetails.data.uri);
          fetchTokenMetadata(tokenDetails.data.uri);
        }
      },
      commitment,
    );
  
    logger.info(`Listening for Raydium pool changes: ${raydiumSubscriptionId}`);
  };

  async function fetchTokenMetadata(uri: string) {
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Error fetching metadata: ${response.statusText}`);
      }
      const metadata = await response.json();
      const tokenData: TokenInfo = {
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description,
        image: metadata.image,
        web: extractURL(metadata.description, 'web'),
        twitter: extractURL(metadata.description, 'twitter'),
       telegram: extractURL(metadata.description, 'telegram'),
      };
      console.log(tokenData);
      return metadata;
    } catch (error) {
      console.error(`Failed to fetch token metadata: ${error}`);
    }
  }

  function extractURL(description: string, type: 'web' | 'twitter' | 'telegram'): string | undefined {
    let regex;
    
    switch (type) {
      case 'telegram':
        regex = /(?:TG|Telegram|TG✅)\s*[:✅]*\s*(https?:\/\/t\.me\/\S+)/i;
        break;
      case 'twitter':
        regex = /(?:Twitter|X|Twitter\/X|X🚀)\s*[:🚀]*\s*(https?:\/\/(twitter\.com|x\.com)\/\S+)/i;
        break;
      case 'web':
        regex = /(?:Web|Website|Website🌐)\s*[:🌐]*\s*(https?:\/\/\S+)/i;
        break;
    }
  
    if (!regex) return undefined;
  
    const match = RegExp(regex).exec(description);
    return match ? match[1] : undefined;
  }
  runListener();
  