import * as solanaWeb3 from '@solana/web3.js';
import { RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 } from '../liquidity/liquidity.js';
import { retrieveEnvVariable } from '../utils/utils.js';
import { Metaplex,Metadata  } from '@metaplex-foundation/js';
import {pino} from 'pino';
import { program } from '@project-serum/anchor/dist/cjs/native/system.js';


const transport = pino.transport({
  targets: [{
    level: 'trace',
    target: 'pino-pretty',
    options: {},
  }],
});

const logger = pino(transport);

import {
  Liquidity,
  LIQUIDITY_STATE_LAYOUT_V4,
  LiquidityPoolKeys,
  LiquidityStateV4,
  MARKET_STATE_LAYOUT_V3,
  MarketStateV3,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';


const network: string = 'mainnet-beta';
const RPC_ENDPOINT: string = retrieveEnvVariable('RPC_ENDPOINT', logger);
const RPC_WEBSOCKET_ENDPOINT: string = retrieveEnvVariable('RPC_WEBSOCKET_ENDPOINT', logger);

const solanaConnection: solanaWeb3.Connection = new solanaWeb3.Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
});
const metaplex: Metaplex = Metaplex.make(solanaConnection);

const commitment: solanaWeb3.Commitment = 'confirmed';

let existingLiquidityPools: Set<string> = new Set();

export const startListeningForNewPairs = (onNewPair: (metadata: any) => void): void => {
  runListener(onNewPair);
};

const runListener = async (onNewPair: (metadata: any) => void): Promise<void> => {
  const runTimestamp: number = Math.floor(new Date().getTime() / 1000);
  const raydiumSubscriptionId: number = solanaConnection.onProgramAccountChange(
    RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    async (updatedAccountInfo: solanaWeb3.KeyedAccountInfo) => {
      const key: string = updatedAccountInfo.accountId.toString();
      const poolState: any = LIQUIDITY_STATE_LAYOUT_V4.decode(updatedAccountInfo.accountInfo.data);
    
      if (parseInt(poolState.poolOpenTime.toString()) > runTimestamp && !existingLiquidityPools.has(key)) {
        existingLiquidityPools.add(key);
        // const metadataPda: solanaWeb3.PublicKey = await Metadata.getPDA(poolState.baseMint);
        // const tokenDetails: any = await Metadata.load(solanaConnection, metadataPda);
        // logger.info(tokenDetails.data.uri);
        // fetchTokenMetadata(tokenDetails.data.uri).then((metadata: any) => {
        //   if (onNewPair) {
        //     onNewPair(metadata); // Invoke the callback with the metadata
        //   }
        // });
      }
    },
    commitment,
  );

  logger.info(`Listening for Raydium pool changes: ${raydiumSubscriptionId}`);
};

async function fetchTokenMetadata(uri: string): Promise<any> {
  try {
    const response: Response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Error fetching metadata: ${response.statusText}`);
    }
    const metadata: any = await response.json();
    const tokenData: any = {
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

function extractURL(description: string, type: string): string | undefined {
  let regex: RegExp | undefined;

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

  const match: RegExpExecArray | null = regex.exec(description);
  return match ? match[1] : undefined;
}
runListener(() => {});
