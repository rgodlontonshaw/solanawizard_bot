const { Connection, PublicKey } = require('@solana/web3.js');
const { MARKET_STATE_LAYOUT_V3 } = require('@raydium-io/raydium-sdk');

async function getMinimalMarketV3(connection, marketId, commitment) {
  const marketInfo = await connection.getAccountInfo(marketId, {
    commitment,
    dataSlice: {
      offset: MARKET_STATE_LAYOUT_V3.offsetOf('eventQueue'),
      length: 32 * 3,
    },
  });

  return MINIMAL_MARKET_STATE_LAYOUT_V3.decode(marketInfo.data);
}

module.exports = { getMinimalMarketV3 };
