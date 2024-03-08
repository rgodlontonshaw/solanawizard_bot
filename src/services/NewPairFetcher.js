const { LIQUIDITY_STATE_LAYOUT_V4, LiquidityStateV4 } = require('@raydium-io/raydium-sdk');
const { Connection, PublicKey } = require('@solana/web3.js');
const { RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 } = require('../liquidity/liquidity.js');
const { retrieveEnvVariable } = require('../utils/utils.js');
const pino = require('pino');
const { Metaplex } = require('@metaplex-foundation/js');
const { Metadata } = require("@metaplex-foundation/mpl-token-metadata");
const TokenInfo = require('../models/TokenInfo.js');
const EventEmitter = require('events');
class NewPairEmitter extends EventEmitter {}
const newPairEmitter = new NewPairEmitter()

const fetch = require('node-fetch');

const transport = pino.transport({
    targets: [{
        level: 'trace',
        target: 'pino-pretty',
        options: {},
    }],
});

const logger = pino(
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

const commitment = retrieveEnvVariable('COMMITMENT_LEVEL', logger);

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
        newPairEmitter.emit('newPair', tokenData);
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

    const match = RegExp(regex).exec(description);
    return match ? match[1] : undefined;
}


module.exports = { runListener, newPairEmitter };