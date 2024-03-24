const { PublicKey, Connection } = require('@solana/web3.js');
const { ApiPoolInfoV4, MARKET_STATE_LAYOUT_V3, Market, SPL_MINT_LAYOUT } = require('@raydium-io/raydium-sdk');
const Client = require('@triton-one/yellowstone-grpc');
const base58 = require('bs58');
const { connection, rpcToken, rpcUrl } = require('../config');

const RPC_ENDPOINT = retrieveEnvVariable('RPC_ENDPOINT', logger);


async function fetchPoolData(programId, transaction, accounts) {
  const formatData = {
    slot: transaction.slot,
    txid: base58.encode(transaction.signature),
    poolInfos: []
  };

  for (const instruction of [...transaction.message.instructions, ...transaction.meta.innerInstructions.flat().map(i => i.instructions).flat()]) {
    if (accounts[instruction.programIdIndex] !== programId || [...instruction.data.values()][0] != 1) {
      continue;
    }

    const keyIndexes = [...instruction.accounts.values()];
    const [baseMintAccount, quoteMintAccount, marketAccount] = await connection.getMultipleAccountsInfo([
      new PublicKey(accounts[keyIndexes[8]]),
      new PublicKey(accounts[keyIndexes[9]]),
      new PublicKey(accounts[keyIndexes[16]]),
    ]);

    if (!baseMintAccount || !quoteMintAccount || !marketAccount) {
      throw new Error('Failed to fetch account information');
    }

    const baseMintInfo = SPL_MINT_LAYOUT.decode(baseMintAccount.data);
    const quoteMintInfo = SPL_MINT_LAYOUT.decode(quoteMintAccount.data);
    const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);

    formatData.poolInfos.push(createPoolInfo(baseMintInfo, quoteMintInfo, marketInfo, keyIndexes, accounts, programId));
  }

  return formatData;
}

function createPoolInfo(baseMintInfo, quoteMintInfo, marketInfo, keyIndexes, accounts, programId) {
  const market = new Market(marketInfo, baseMintInfo.decimals, quoteMintInfo.decimals, false, programId);
  return {
    id: accounts[keyIndex[4]],
    baseMint: accounts[keyIndex[8]],
    quoteMint: accounts[keyIndex[9]],
    lpMint: accounts[keyIndex[7]],
    baseDecimals: baseMintInfo.decimals,
    quoteDecimals: quoteMintInfo.decimals,
    lpDecimals: baseMintInfo.decimals,
    version: 4,
    programId: programId,
    authority: accounts[keyIndex[5]],
    openOrders: accounts[keyIndex[6]],
    targetOrders: accounts[keyIndex[12]],
    baseVault: accounts[keyIndex[10]],
    quoteVault: accounts[keyIndex[11]],
    withdrawQueue: PublicKey.default.toString(),
    lpVault: PublicKey.default.toString(),
    marketVersion: 3,
    marketProgramId: marketAccount.owner.toString(),
    marketId: accounts[keyIndex[16]],
    marketAuthority: Market.getAssociatedAuthority({ programId: marketAccount.owner, marketId: new PublicKey(accounts[keyIndex[16]]) }).publicKey.toString(),
    marketBaseVault: marketInfo.baseVault.toString(),
    marketQuoteVault: marketInfo.quoteVault.toString(),
    marketBids: marketInfo.bids.toString(),
    marketAsks: marketInfo.asks.toString(),
    marketEventQueue: marketInfo.eventQueue.toString(),
    lookupTableAccount: PublicKey.default.toString()
  };
}

async function subNewAmmPool() {
  const programId = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
  const client = new Client(RPC_ENDPOINT, rpcToken);
  const rpcConnInfo = await client.subscribe();

  rpcConnInfo.on('data', async (data) => {
    if (data.transaction && data.transaction.meta.err === undefined && data.filters.includes('transactionsSubKey')) {
      const accounts = data.transaction.message.accountKeys.map(key => base58.encode(key));
      const poolData = await fetchPoolData(programId, data.transaction, accounts);
      console.log(poolData);
    }
  });
}

subNewAmmPool();
