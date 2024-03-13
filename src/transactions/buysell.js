const {
    Liquidity,
    LIQUIDITY_STATE_LAYOUT_V4,
    LiquidityPoolKeys,
    LiquidityStateV4,
    MARKET_STATE_LAYOUT_V3,
    MarketStateV3,
    Token,
    TokenAmount,
  } = require('@raydium-io/raydium-sdk');
  const {
    createAssociatedTokenAccountIdempotentInstruction,
    createCloseAccountInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
  } = require('@solana/spl-token');
  const {
    Keypair,
    Connection,
    PublicKey,
    ComputeBudgetProgram,
    KeyedAccountInfo,
    TransactionMessage,
    VersionedTransaction,
    Commitment,
  } = require('@solana/web3.js');
  const { getTokenAccounts, RAYDIUM_LIQUIDITY_PROGRAM_ID_V4, OPENBOOK_PROGRAM_ID, createPoolKeys } = require('./liquidity');
  const { retrieveEnvVariable } = require('./utils');
  const { getMinimalMarketV3, MinimalMarketLayoutV3 } = require('./market');
  const pino = require('pino');
  const bs58 = require('bs58');
  const fs = require('fs');
  const path = require('path');
  const BN = require('bn.js');
  
  const transport = pino.transport({
    targets: [
      {
        level: 'trace',
        target: 'pino-pretty',
        options: {},
      },
    ],
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
  
  let existingLiquidityPools = new Set();
  let existingOpenBookMarkets = new Set();
  let existingTokenAccounts = new Map();
  
  let wallet;
  let quoteToken;
  let quoteTokenAssociatedAddress;
  let quoteAmount;
  let commitment = retrieveEnvVariable('COMMITMENT_LEVEL', logger);
  
  const USE_SNIPE_LIST = retrieveEnvVariable('USE_SNIPE_LIST', logger) === 'true';
  const SNIPE_LIST_REFRESH_INTERVAL = Number(retrieveEnvVariable('SNIPE_LIST_REFRESH_INTERVAL', logger));
  const AUTO_SELL = retrieveEnvVariable('AUTO_SELL', logger) === 'true';
  const SELL_DELAY = Number(retrieveEnvVariable('SELL_DELAY', logger));
  const MAX_SELL_RETRIES = 60;
  
  let snipeList = [];
  
  async function init() {
    const PRIVATE_KEY = retrieveEnvVariable('PRIVATE_KEY', logger);
    wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
    logger.info(`Wallet Address: ${wallet.publicKey}`);
  
    const QUOTE_MINT = retrieveEnvVariable('QUOTE_MINT', logger);
    const QUOTE_AMOUNT = retrieveEnvVariable('QUOTE_AMOUNT', logger);
    switch (QUOTE_MINT) {
      case 'WSOL': {
        quoteToken = Token.WSOL;
        quoteAmount = new TokenAmount(Token.WSOL, QUOTE_AMOUNT, false);
        break;
      }
      case 'USDC': {
        quoteToken = new Token(
          TOKEN_PROGRAM_ID,
          new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
          6,
          'USDC',
          'USDC',
        );
        quoteAmount = new TokenAmount(quoteToken, QUOTE_AMOUNT, false);
        break;
      }
      default: {
        throw new Error(`Unsupported quote mint "${QUOTE_MINT}". Supported values are USDC and WSOL`);
      }
    }
  
    logger.info(
      `Script will buy all new tokens using ${QUOTE_MINT}. Amount that will be used to buy each token is: ${quoteAmount.toFixed().toString()}`,
    );
  
    const tokenAccounts = await getTokenAccounts(solanaConnection, wallet.publicKey, commitment);
  
    for (const ta of tokenAccounts) {
      existingTokenAccounts.set(ta.accountInfo.mint.toString(), {
        mint: ta.accountInfo.mint,
        address: ta.pubkey,
      });
    }
  
    const tokenAccount = tokenAccounts.find((acc) => acc.accountInfo.mint.toString() === quoteToken.mint.toString());
  
    if (!tokenAccount) {
      throw new Error(`No ${quoteToken.symbol} token account found in wallet: ${wallet.publicKey}`);
    }
  
    quoteTokenAssociatedAddress = tokenAccount.pubkey;
  
    loadSnipeList();
  }
  
  async function saveTokenAccount(mint, accountData) {

    if (!tokenAccount) {
      return;
    }
  
    let retries = 0;
    let balanceFound = false;
    while (retries < MAX_SELL_RETRIES) {
      try {
        const balanceResponse = (await solanaConnection.getTokenAccountBalance(tokenAccount.address)).value.amount;
  
        if (balanceResponse !== null && Number(balanceResponse) > 0 && !balanceFound) {
          balanceFound = true;
  
          const { innerTransaction, address } = Liquidity.makeSwapFixedInInstruction(
            {
              poolKeys: poolKeys,
              userKeys: {
                tokenAccountIn: tokenAccount.address,
                tokenAccountOut: quoteTokenAssociatedAddress,
                owner: wallet.publicKey,
              },
              amountIn: new BN(balanceResponse),
              minAmountOut: 0,
            },
            poolKeys.version,
          );
  
          const latestBlockhash = await solanaConnection.getLatestBlockhash({
            commitment: commitment,
          });
          const messageV0 = new TransactionMessage({
            payerKey: wallet.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: [
              ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
              ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200000 }),
              createCloseAccountInstruction(tokenAccount.address, wallet.publicKey, wallet.publicKey),
              ...innerTransaction.instructions,
            ],
          }).compileToV0Message();
          const transaction = new VersionedTransaction(messageV0);
          transaction.sign([wallet, ...innerTransaction.signers]);
          const signature = await solanaConnection.sendRawTransaction(transaction.serialize(), {
            maxRetries: 5,
            preflightCommitment: commitment,
          });
          logger.info(
            {
              mint: accountData.baseMint,
              url: `https://solscan.io/tx/${signature}?cluster=${network}`,
            },
            'sell',
          );
          break;
        }
      } catch (error) {
        // ignored
      }
      retries++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  
  function loadSnipeList() {
    if (!USE_SNIPE_LIST) {
      return;
    }
  
    const count = snipeList.length;
    const data = fs.readFileSync(path.join(__dirname, 'snipe-list.txt'), 'utf-8');
    snipeList = data
      .split('\n')
      .map((a) => a.trim())
      .filter((a) => a);
  
    if (snipeList.length != count) {
      logger.info(`Loaded snipe list: ${snipeList.length}`);
    }
  }
  
  function shouldBuy(key) {
    return USE_SNIPE_LIST ? snipeList.includes(key) : true;
  }
  
  const runListener = async () => {
    await init();
    const runTimestamp = Math.floor(new Date().getTime() / 1000);
    const raydiumSubscriptionId = solanaConnection.onProgramAccountChange(
      RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
      async (updatedAccountInfo) => {
        const key = updatedAccountInfo.accountId.toString();
        const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(updatedAccountInfo.accountInfo.data);
        const poolOpenTime = parseInt(poolState.poolOpenTime.toString());
        const existing = existingLiquidityPools.has(key);
  
        if (poolOpenTime > runTimestamp && !existing) {
          existingLiquidityPools.add(key);
          const _ = processRaydiumPool(updatedAccountInfo.accountId, poolState);
        }
      },
      commitment,
      [
        { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
            bytes: quoteToken.mint.toBase58(),
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('marketProgramId'),
            bytes: OPENBOOK_PROGRAM_ID.toBase58(),
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('status'),
            bytes: bs58.encode([6, 0, 0, 0, 0, 0, 0, 0]),
          },
        },
      ],
    );
  
    const openBookSubscriptionId = solanaConnection.onProgramAccountChange(
      OPENBOOK_PROGRAM_ID,
      async (updatedAccountInfo) => {
        const key = updatedAccountInfo.accountId.toString();
        const existing = existingOpenBookMarkets.has(key);
        if (!existing) {
          existingOpenBookMarkets.add(key);
          const _ = processOpenBookMarket(updatedAccountInfo);
        }
      },
      commitment,
      [
        { dataSize: MARKET_STATE_LAYOUT_V3.span },
        {
          memcmp: {
            offset: MARKET_STATE_LAYOUT_V3.offsetOf('quoteMint'),
            bytes: quoteToken.mint.toBase58(),
          },
        },
      ],
    );
  
    logger.info(`Listening for raydium changes: ${raydiumSubscriptionId}`);
    logger.info(`Listening for open book changes: ${openBookSubscriptionId}`);
  
    if (USE_SNIPE_LIST) {
      setInterval(loadSnipeList, SNIPE_LIST_REFRESH_INTERVAL);
    }
  };
  
  runListener();