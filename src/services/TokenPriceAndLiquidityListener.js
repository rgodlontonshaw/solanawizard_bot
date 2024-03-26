const { Connection, PublicKey } = require('@solana/web3.js');
const { LIQUIDITY_STATE_LAYOUT_V4, TokenAccount,
    SPL_ACCOUNT_LAYOUT,} = require('@raydium-io/raydium-sdk');
const { retrieveEnvVariable } = require('../utils/utils.js');
const pino = require('pino');
const fetch = require('node-fetch');
const EventEmitter = require('events');
const{BN}  = require( "bn.js");
const { OpenOrders } =  require( "@project-serum/serum");



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
    constructor(poolKey) {
        super();
        this.poolKey = new PublicKey(poolKey);
        this.solPriceInUSD = 0;
    }

    async fetchSolPrice() {
        try {
            const response = await fetch('https://price.jup.ag/v4/price?ids=SOL');
            if (!response.ok) {
                throw new Error(`Failed to fetch SOL price: ${response.statusText}`);
            }
            const json = await response.json();
            this.solPriceInUSD = json.data.SOL.price;
        } catch (error) {
            console.error(`Error fetching SOL price: ${error}`);
        }
    }

    async fetchUserTokens() {
        const programId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'); // SPL Token program ID
        const { value } = await this.connection.getTokenAccountsByOwner(this.ownerPublicKey, { programId });

        return value.map(accountInfo => {
            // Here you can parse accountInfo to extract necessary details
            // For simplicity, we're just returning the public keys of the accounts
            return accountInfo.pubkey.toString();
        });
    }

    async startListening() {
        await this.fetchSolPrice();  // Fetch the initial price before starting to listen

        this.poolSubscriptionId = solanaConnection.onAccountChange(
            this.poolKey,
            async (accountInfo) => {
                const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(accountInfo.data);

                const openOrders = await OpenOrders.load(
                    solanaConnection,
                    poolState.openOrders,
                    OPENBOOK_PROGRAM_ID // OPENBOOK_PROGRAM_ID(marketProgramId) of each pool can get from api: https://api.raydium.io/v2/sdk/liquidity/mainnet.json
                  );

                const baseDecimal = 10 ** poolState.baseDecimal.toNumber(); // e.g. 10 ^ 6
                const quoteDecimal = 10 ** poolState.quoteDecimal.toNumber();

                const baseTokenAmount = await solanaConnection.getTokenAccountBalance(
                    poolState.baseVault
                  );
                const quoteTokenAmount = await solanaConnection.getTokenAccountBalance(
                poolState.quoteVault
                );

                const basePnl = poolState.baseNeedTakePnl.toNumber() / baseDecimal;
                const quotePnl = poolState.quoteNeedTakePnl.toNumber() / quoteDecimal;

                const openOrdersBaseTokenTotal =
                openOrders.baseTokenTotal.toNumber() / baseDecimal;
                const openOrdersQuoteTokenTotal =
                    openOrders.quoteTokenTotal.toNumber() / quoteDecimal;
                

                const base =
                    (baseTokenAmount.value?.uiAmount || 0) + openOrdersBaseTokenTotal - basePnl;
                const quote =
                    (quoteTokenAmount.value?.uiAmount || 0) +
                    openOrdersQuoteTokenTotal -
                    quotePnl;  
                    
                const baseTokenPriceInSOL = quote / base;

                const fullPrice = baseTokenPriceInSOL * this.solPriceInUSD;

        
                console.log('Full Price in USD:', fullPrice);

                const baseTokenPriceInUSD = roundToNearestFifthDecimal(fullPrice);
                
                console.log(`Base Token Price in USD: ${baseTokenPriceInUSD}`);
                // Fetch the vault balances
                // const baseVaultBalance = await solanaConnection.getTokenAccountBalance(baseVaultKey);
                // const quoteVaultBalance = await solanaConnection.getTokenAccountBalance(quoteVaultKey);
                

                // console.log(`Base Vault Balance: ${baseVaultBalance.value.uiAmount}`);
                // console.log(`Quote Vault Balance: ${quoteVaultBalance.value.uiAmount}`);


            

                // const baseTokenLiquidityInUSD = baseVaultBalanceAmount * baseTokenPriceInUSD;
                // const quoteTokenLiquidityInUSD = quoteVaultBalanceAmount * this.solPriceInUSD;
                // const totalLiquidityInUSD = baseTokenLiquidityInUSD + quoteTokenLiquidityInUSD;

                // console.log(`Total Liquidity in USD: ${totalLiquidityInUSD}`);

 
            },
            'confirmed',
        );
    }

    stopListening() {
        if (this.poolSubscriptionId) {
            solanaConnection.removeAccountChangeListener(this.poolSubscriptionId);
        }
    }
}

// Usage example
const poolKey = '879F697iuDJGMevRkRcnW21fcXiAeLJK1ffsw2ATebce';  // Replace with the actual pool public key

const monitor = new PriceLiquidityMonitor(poolKey);
monitor.startListening();
