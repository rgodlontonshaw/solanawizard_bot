const { gql, GraphQLClient } = require("graphql-request");


class PoolInfoService {
  constructor() {
    const endpoint = `https://programs.shyft.to/v0/graphql/?api_key=-ZMCvwqQpkEEYUvd`;
    this.graphQLClient = new GraphQLClient(endpoint, {
      method: `POST`,
      jsonSerializer: {
        parse: JSON.parse,
        stringify: JSON.stringify,
      },
    });
  }

  async queryLpByAddress(address) {
    const query = gql`
      query MyQuery($where: Raydium_LiquidityPoolv4_bool_exp) {
        Raydium_LiquidityPoolv4(where: $where) {
          _updatedAt
          amountWaveRatio
          baseDecimal
          baseLotSize
          baseMint
          baseNeedTakePnl
          baseTotalPnl
          baseVault
          depth
          lpMint
          lpReserve
          lpVault
          marketId
          marketProgramId
          maxOrder
          maxPriceMultiplier
          minPriceMultiplier
          minSeparateDenominator
          minSeparateNumerator
          minSize
          nonce
          openOrders
          orderbookToInitTime
          owner
          pnlDenominator
          pnlNumerator
          poolOpenTime
          punishCoinAmount
          punishPcAmount
          quoteDecimal
          quoteLotSize
          quoteMint
          quoteNeedTakePnl
          quoteTotalPnl
          quoteVault
          resetFlag
          state
          status
          swapBase2QuoteFee
          swapBaseInAmount
          swapBaseOutAmount
          swapFeeDenominator
          swapFeeNumerator
          swapQuote2BaseFee
          swapQuoteInAmount
          swapQuoteOutAmount
          systemDecimalValue
          targetOrders
          tradeFeeDenominator
          tradeFeeNumerator
          volMaxCutRatio
          withdrawQueue
          pubkey
        }
      }`;

    const variables = {
      where: {
        baseMint: {
          _eq: address,
        },
      },
    };

    try {
      const data = await this.graphQLClient.request(query, variables);
      console.log("Data fetched successfully:", data);
      return data; 
    } catch (error) {
      console.error("GraphQL query failed:", error);
      throw error;
    }
  }
  
}

const poolInfoService = new PoolInfoService();
  const tokenAddress = 'GPjNUrcXpUMv22kWiZwieMDzP2eNz8NgmDfb48LpDM3K';
  try {
    const data =  poolInfoService.queryLpByAddress(tokenAddress);
    console.log("Queried Data:", data);
  } catch (error) {
    console.error("Error querying data:", error);
 }



module.exports = PoolInfoService;