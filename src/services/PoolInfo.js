const { Connection, PublicKey } = require("@solana/web3.js");
const { LIQUIDITY_STATE_LAYOUT_V4 } = require("@raydium-io/raydium-sdk");
const { retrieveEnvVariable } = require('../utils/utils.js');
const Base58 = require('base58');


const pino = require('pino');

const BN = require("bn.js");

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
const commitment = retrieveEnvVariable('COMMITMENT_LEVEL', logger);

const solanaConnection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
});


async function parsePoolInfo(poolId) {
  try {
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
   
    const info = await solanaConnection.getAccountInfo(new PublicKey(poolId));
    if (!info) {
      console.log("Pool information not found.");
      return;
    }

    const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);

    // Fetch the balances of the vaults
    const baseTokenVaultBalance = await solanaConnection.getTokenAccountBalance(new PublicKey(poolState.baseVault));
    const quoteTokenVaultBalance = await solanaConnection.getTokenAccountBalance(new PublicKey(poolState.quoteVault));

    console.log("Base Token Vault Balance:", baseTokenVaultBalance.value.amount);
    console.log("Quote Token Vault Balance:", quoteTokenVaultBalance.value.amount);

    priceCheck(poolState.baseMint,baseTokenVaultBalance);

   
  } catch (e) {
    console.error('Parsing poolstate error: ', e);
  }
}


async function priceCheck(tokenMint, rawTokenAmount) {

  const programId = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');


  console.log(rawTokenAmount, tokenMint)
  let accountInfo = null
  accountInfo = await solanaConnection.getProgramAccounts(programId, {
    filters: [
      { memcmp: { offset: 400, bytes: tokenMint } },
      { dataSize: 752 }
    ]
  })
  // if (!accountInfo) {
  //   accountInfo = await solanaConnection.getProgramAccounts(rayV4, {
  //     filters: [ { memcmp: { offset: 368, bytes: tokenMint } }, { dataSize: 752 } ]
  //   })
  // }
  // try {
  //   const quoteVaultPublicKey = new PublicKey(accountInfo[0].account.data.subarray(400-32, 400)).toString()
  //   const baseVaultPublicKey = new PublicKey(accountInfo[0].account.data.subarray(400-64, 400-32)).toString()
  //   const quoteAccountInfo = await solanaConnection.getAccountInfo(new PublicKey(quoteVaultPublicKey))
  //   const baseAccountInfo = await solanaConnection.getAccountInfo(new PublicKey(baseVaultPublicKey))
  //   const quoteTokenAmount = new BL.NearUInt64().decode(new Uint8Array(quoteAccountInfo.data.subarray(64, 72)))
  //   const baseTokenAmount = new BL.NearUInt64().decode(new Uint8Array(baseAccountInfo.data.subarray(64, 72)))
  //   const calculatedAmount = (quoteTokenAmount / baseTokenAmount) * rawTokenAmount
  //   const price = calculatedAmount / Math.pow(10, 9)
  //   console.log(Number(price.toFixed(9)))
  //   return(price)
  // } catch(error) {
  //   console.log(error)
  // }
}

// priceCheck(new PublicKey("ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82"), 1000000)



const testPoolId = 'GwcNkpNdzzGGvBVQhw1E1WJbsjVfZ6WpYVqT6hQFfY6B';

// Call the function directly with the hardcoded pool ID
parsePoolInfo(testPoolId)
  .then(() => console.log('Finished processing pool info.'))
  .catch((error) => console.error('Error during pool info processing:', error));

module.exports = { parsePoolInfo };