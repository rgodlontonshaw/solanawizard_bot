import { Connection, PublicKey } from '@solana/web3.js';
import pkg from '@raydium-io/raydium-sdk';
const { Liquidity, MAINNET_PROGRAM_ID, Market, SPL_ACCOUNT_LAYOUT, publicKey, struct } = pkg;
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export const RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 = MAINNET_PROGRAM_ID.AmmV4;
export const OPENBOOK_PROGRAM_ID = MAINNET_PROGRAM_ID.OPENBOOK_MARKET;


export const MINIMAL_MARKET_STATE_LAYOUT_V3 = struct([
  publicKey('eventQueue'),
  publicKey('bids'),
  publicKey('asks'),
]);

export interface AccountData {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  lpMint: PublicKey;
  baseDecimals: number;
  quoteDecimals: number;
  openOrders: PublicKey;
  targetOrders: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  marketProgramId: PublicKey;
  marketId: PublicKey;
  withdrawQueue: PublicKey;
  lpVault: PublicKey;
}

export interface MinimalMarketLayoutV3 {
  bids: PublicKey;
  asks: PublicKey;
  eventQueue: PublicKey;
}

export function createPoolKeys(
  id: string,
  accountData: AccountData,
  minimalMarketLayoutV3: MinimalMarketLayoutV3,
) {
  return {
    id,
    baseMint: accountData.baseMint,
    quoteMint: accountData.quoteMint,
    lpMint: accountData.lpMint,
    baseDecimals: accountData.baseDecimals, // Fixed typo from baseDecimal to baseDecimals
    quoteDecimals: accountData.quoteDecimals, // Fixed typo from quoteDecimal to quoteDecimals
    lpDecimals: 5,
    version: 4,
    programId: RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    authority: Liquidity.getAssociatedAuthority({
      programId: RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    }).publicKey,
    openOrders: accountData.openOrders,
    targetOrders: accountData.targetOrders,
    baseVault: accountData.baseVault,
    quoteVault: accountData.quoteVault,
    marketVersion: 3,
    marketProgramId: accountData.marketProgramId,
    marketId: accountData.marketId,
    marketAuthority: Market.getAssociatedAuthority({
      programId: accountData.marketProgramId,
      marketId: accountData.marketId,
    }).publicKey,
    marketBaseVault: accountData.baseVault,
    marketQuoteVault: accountData.quoteVault,
    marketBids: minimalMarketLayoutV3.bids,
    marketAsks: minimalMarketLayoutV3.asks,
    marketEventQueue: minimalMarketLayoutV3.eventQueue,
    withdrawQueue: accountData.withdrawQueue,
    lpVault: accountData.lpVault,
    lookupTableAccount: PublicKey.default,
  };
}

export interface TokenAccount {
  pubkey: PublicKey;
  programId: PublicKey;
  accountInfo: any; // Ideally, define a more specific type for accountInfo
}

export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
  commitment: string,
): Promise<TokenAccount[]> {
  const tokenResp = await connection.getTokenAccountsByOwner(
    owner,
    {
      programId: TOKEN_PROGRAM_ID,
    },
    commitment,
  );

  const accounts: TokenAccount[] = [];
  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      programId: account.owner,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
    });
  }

  return accounts;
}