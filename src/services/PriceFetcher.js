const { Connection, PublicKey } = require('@solana/web3.js');
const PoolInfoService = require('./PoolInfoByTokenAddress');
const pino = require('pino');
const { retrieveEnvVariable } = require('../utils/utils.js');
const { BL } = require('buffer-layout');


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

const RPC_ENDPOINT = retrieveEnvVariable('RPC_ENDPOINT', logger);
const RPC_WEBSOCKET_ENDPOINT = retrieveEnvVariable('RPC_WEBSOCKET_ENDPOINT', logger);
const solanaConnection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
 });
class PriceFetcher {
    constructor() {
        this.poolInfoService = new PoolInfoService();
    }


    async priceCheck(tokenMint) {
        try {
            // const BL = new BufferList();
            // Fetch pool information
            const poolInfoResponse = await this.poolInfoService.queryLpByAddress(tokenMint);
            const pool = poolInfoResponse.Raydium_LiquidityPoolv4[0];
            if (!pool) {
                throw new Error('Pool information not found for the given base token address.');
            }

             try {
                const quoteVaultPublicKey = new PublicKey(pool.quoteVault);
                const baseVaultPublicKey = new PublicKey(pool.baseVault);
                const quoteAccountInfo = await solanaConnection.getAccountInfo(new PublicKey(quoteVaultPublicKey));
                const baseAccountInfo = await solanaConnection.getAccountInfo(new PublicKey(baseVaultPublicKey));

                console.log("quoteAccountInfo.data:", quoteAccountInfo.data);
                console.log("baseAccountInfo.data:", baseAccountInfo.data);
                console.log("Quote Token Data Slice:", quoteAccountInfo.data.subarray(64, 72));
                console.log("Base Token Data Slice:", baseAccountInfo.data.subarray(64, 72));

                const quoteTokenAmount = Buffer.from(quoteAccountInfo.data.subarray(64, 72)).readBigUInt64LE();
                const baseTokenAmount = Buffer.from(baseAccountInfo.data.subarray(64, 72)).readBigUInt64LE();

                console.log("Quote Token Amount:", quoteTokenAmount.toString());
                console.log("Base Token Amount:", baseTokenAmount.toString());



                // const quoteTokenAmount = new BL.NearUInt64().decode(new Uint8Array(quoteAccountInfo.data.subarray(64, 72)));
                // const baseTokenAmount = new BL.NearUInt64().decode(new Uint8Array(baseAccountInfo.data.subarray(64, 72)));


                const calculatedAmount = (Number(quoteTokenAmount) /  Number(baseTokenAmount));
                const price = calculatedAmount / Math.pow(10, 9);
                // const price = Number(quoteTokenAmount) / Number(baseTokenAmount);
                // console.log("Adjusted Price:", price.toFixed(9));
                return(price)
            } catch(error) {
                console.log(error)
            }
        } catch (error) {
            console.error("Failed to calculate token price:", error);
            throw error;
        }
    }


}
const priceFetcher = new PriceFetcher();
priceFetcher.priceCheck('GPjNUrcXpUMv22kWiZwieMDzP2eNz8NgmDfb48LpDM3K').then(price => console.log(price)).catch(err => console.error(err));

module.exports = PriceFetcher;