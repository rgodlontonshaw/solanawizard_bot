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
const { json } = require('stream/consumers');

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
                logger.info(poolState);
                existingLiquidityPools.add(key);
                const metadataPda = metaplex.nfts().pdas().metadata({ mint: poolState.baseMint });
                const tokenDetails = await Metadata.fromAccountAddress(solanaConnection, metadataPda);
                logger.info(tokenDetails.data.uri);
                fetchTokenMetadata(tokenDetails.data.uri, poolState);
            }
        },
        commitment,
    );

    logger.info(`Listening for Raydium pool changes: ${raydiumSubscriptionId}`);
};

async function fetchTokenMetadata(uri, poolState) {
    try {
        const response = await fetch(uri);
        if (!response.ok) {
            throw new Error(`Error fetching metadata: ${response.statusText}`);
        }

        let liquidity = 0;

        try{
            liquidity = await calculateLiquidity(poolState);
        }
        catch(error){
        }
    
        const metadata = await response.json();
        const tokenData = {
            name: metadata.name,
            symbol: metadata.symbol,
            description: metadata.description,
            image: metadata.image,
            liquidity: liquidity,
            web: extractURL(metadata.description, 'web'),
            twitter: extractURL(metadata.description, 'twitter'),
            telegram: extractURL(metadata.description, 'telegram'),
        };
        newPairEmitter.emit('newPair', tokenData);
        return metadata;
    } catch (error) {
        console.error(`Failed to fetch token metadata: ${error}`);
    }
}

function extractURL(description, type) {
    let regex;
    let iconWithX = '❌';

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

    if (!regex) return iconWithX;

    const match = RegExp(regex).exec(description);
    return match ? match[1] : iconWithX;
}

async function calculateLiquidity(poolState) {
    try {

        if (!poolState || !poolState.baseVault || !poolState.quoteVault) {
            console.error('Invalid or missing poolState');
            return 0; // Return 0 liquidity for invalid poolState
        }

     


        // Repeat for quote token and other relevant values

        // Convert baseVault and quoteVault to PublicKey before using them in getAccountInfo
        const baseVaultPublicKey = new PublicKey(poolState.baseVault);
        const quoteVaultPublicKey = new PublicKey(poolState.quoteVault);
        // Use the converted PublicKeys in getAccountInfo
        const baseTokenBalance = await solanaConnection.getAccountInfo(baseVaultPublicKey, commitment);
        const quoteTokenBalance = await solanaConnection.getAccountInfo(quoteVaultPublicKey, commitment);

        console.log(`Base Token Balance: ${baseTokenBalance.lamports}`);
        console.log(`Quote Token Balance: ${quoteTokenBalance.lamports}`);

        // Convert string decimal values to integers
        const baseDecimals = parseInt(poolState.baseDecimal, 10);
        const quoteDecimals = parseInt(poolState.quoteDecimal, 10);

        // Use the converted integers in the calculation
        const baseTokenAmount = baseTokenBalance.lamports / Math.pow(10, baseDecimals);
        const quoteTokenAmount = quoteTokenBalance.lamports / Math.pow(10, quoteDecimals);


        console.log(`Base Token Amount: ${baseTokenAmount}`);
        console.log(`Quote Token Amount: ${quoteTokenAmount}`);

        // // Calculating USD value of the tokens in each vault
        // const baseTokenValueInUSD = baseTokenAmount * baseTokenPriceInUSD;
        // const quoteTokenValueInUSD = quoteTokenAmount * quoteTokenPriceInUSD;

        // console.log(`Base Token Price in USD: ${baseTokenPriceInUSD}`);
        // console.log(`Quote Token Price in USD: ${quoteTokenPriceInUSD}`);

        // Calculating total liquidity in USD
        // const totalLiquidityInUSD = baseTokenValueInUSD + quoteTokenValueInUSD;

        // console.log(`Total liquidity in USD: ${totalLiquidityInUSD}`);
        return 0;

    }
    catch (error) {
        console.error(`Error in calculateLiquidity: ${error}`);
        throw error;
    }
}

module.exports = { runListener, newPairEmitter };