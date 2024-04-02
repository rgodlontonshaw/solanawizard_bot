const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const { LIQUIDITY_STATE_LAYOUT_V4, TokenAccount,
SPL_ACCOUNT_LAYOUT,} = require('@raydium-io/raydium-sdk');
const { OpenOrders } =  require( "@project-serum/serum");
const{BN}  = require( "bn.js");
const { gql, GraphQLClient } = require("graphql-request");



const { retrieveEnvVariable } = require('../utils/utils.js');
const pino = require('pino');
const fetch = require('node-fetch');
const EventEmitter = require('events');
const { consumers } = require('stream');

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
const OPENBOOK_PROGRAM_ID = new PublicKey(
    "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"
  );


const solanaConnection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
});

const roundToNearestFifthDecimal = (num) => {
    let multiplier = Math.pow(10, 6);  // 10^5 for 5 decimal places
    return Math.round(num * multiplier) / multiplier;
};


class PriceLiquidityMonitor extends EventEmitter {
    constructor() {
        super();
    }

    async fetchSolPrice() {
        try {
            const response = await fetch('https://price.jup.ag/v4/price?ids=SOL');
            if (!response.ok) {
                throw new Error(`Failed to fetch SOL price: ${response.statusText}`);
            }
            const json = await response.json();
            return json.data.SOL.price;
        } catch (error) {
            console.error(`Error fetching SOL price: ${error}`);
            throw error;
        }
    }

    async calculateTokenPrice(mintAddress) {
        // const accountInfo = await solanaConnection.getAccountInfo(this.poolKey);
        let fetchedPoolState;
        try {
            const endpoint = `https://programs.shyft.to/v0/graphql/?api_key=-ZMCvwqQpkEEYUvd`;
            const graphQLClient = new GraphQLClient(endpoint, {
                method: `POST`,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const query = gql`
                query MyQuery($where: Raydium_LiquidityPoolv4_bool_exp) {
                    Raydium_LiquidityPoolv4(where: $where) {
                        baseDecimal
                        quoteDecimal
                        baseVault
                        quoteVault
                        openOrders
                    }
                }
            `;
            const variables = {
                where: {
                  baseMint: {
                    _eq: mintAddress,
                  },
                },
              };
            
            const data = await graphQLClient.request(query, variables);
            if (data.Raydium_LiquidityPoolv4.length === 0) {
                throw new Error(`No pool state found for poolKey: ${this.poolKey}`);
            }
            fetchedPoolState = data.Raydium_LiquidityPoolv4[0];
        } catch (error) {
            console.error(`Error fetching pool state from Shyft: ${error}`);
            throw error;
        }

        const poolState = {
            baseDecimal: fetchedPoolState.baseDecimal,
            quoteDecimal: fetchedPoolState.quoteDecimal,
            baseVault: new PublicKey(fetchedPoolState.baseVault),
            quoteVault: new PublicKey(fetchedPoolState.quoteVault),
            openOrders: new PublicKey(fetchedPoolState.openOrders),
        };

        console.log('Pool State:', poolState);

        // const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(accountInfo.data);

        const openOrders = await OpenOrders.load(
            solanaConnection,
            poolState.openOrders,
            OPENBOOK_PROGRAM_ID 
          );

        console.log('Base Decimal:', poolState.baseDecimal);

        const baseDecimal = 10 ** poolState.baseDecimal; 
        const quoteDecimal = 10 ** poolState.quoteDecimal;

        const baseTokenAmount = await solanaConnection.getTokenAccountBalance(
            poolState.baseVault
          );
          const quoteTokenAmount = await solanaConnection.getTokenAccountBalance(
            poolState.quoteVault
          );

        // const basePnl = poolState.baseNeedTakePnl.toNumber() / baseDecimal;
        // const quotePnl = poolState.quoteNeedTakePnl.toNumber() / quoteDecimal;

        const openOrdersBaseTokenTotal =
        openOrders.baseTokenTotal.toNumber() / baseDecimal;
        const openOrdersQuoteTokenTotal =
            openOrders.quoteTokenTotal.toNumber() / quoteDecimal;

        const base =
            (baseTokenAmount.value?.uiAmount || 0) + openOrdersBaseTokenTotal;
        const quote =
            (quoteTokenAmount.value?.uiAmount || 0) +
            openOrdersQuoteTokenTotal;


        const baseTokenPriceInSOL = quote / base;
        const fullPrice = baseTokenPriceInSOL * await this.fetchSolPrice();

        console.log('Full Price in USD:', fullPrice);
        const baseTokenPriceInUSD = roundToNearestFifthDecimal(fullPrice);

        return baseTokenPriceInUSD;
        // const baseTokenLiquidityInUSD = baseVaultBalanceAmount * baseTokenPriceInUSD;

    
        // const quoteTokenLiquidityInUSD = quoteVaultBalanceAmount * this.solPriceInUSD;
        // const totalLiquidityInUSD = baseTokenLiquidityInUSD + quoteTokenLiquidityInUSD;

        // console.log(`Total Liquidity in USD: ${totalLiquidityInUSD}`);
        console.log('Base Token Price in USD:', baseTokenPriceInUSD);
    }
}

module.exports = PriceLiquidityMonitor;