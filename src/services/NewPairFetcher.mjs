import pkg from '@raydium-io/raydium-sdk';
const { LIQUIDITY_STATE_LAYOUT_V4 } = pkg;
import * as solanaWeb3 from '@solana/web3.js';
import { RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 } from '../liquidity/liquidity.mjs';
import { retrieveEnvVariable } from '../utils/utils.mjs';
import pino from 'pino';
import { Metaplex } from '@metaplex-foundation/js';
import Metadata from "@metaplex-foundation/mpl-token-metadata";
import fetch from 'node-fetch';

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

const solanaConnection = new solanaWeb3.Connection(RPC_ENDPOINT, {
wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
});
const metaplex = Metaplex.make(solanaConnection);

const commitment = solanaWeb3.Commitment;

let existingLiquidityPools = new Set();

const runListener = async () => {
const runTimestamp = Math.floor(new Date().getTime() / 1000);
const raydiumSubscriptionId = solanaConnection.onProgramAccountChange(
  RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
  async (updatedAccountInfo) => {
    const key = updatedAccountInfo.accountId.toString();
    const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(updatedAccountInfo.accountInfo.data);
  
    if (parseInt(poolState.poolOpenTime.toString()) > runTimestamp && !existingLiquidityPools.has(key)) {
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

async function fetchTokenMetadata(uri) {
try {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Error fetching metadata: ${response.statusText}`);
  }
  const metadata = await response.json();
  const tokenData = {
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

function extractURL(description, type) {
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

const match = regex.exec(description);
return match ? match[1] : undefined;
}
runListener();