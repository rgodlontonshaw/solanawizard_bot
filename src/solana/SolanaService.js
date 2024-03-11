const solanaWeb3 = require('@solana/web3.js');
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'));

class SolanaService {
  static async createSolanaWallet() {
    const newPair = solanaWeb3.Keypair.generate();
    return newPair;
  }

  static async getSolBalance(pubKey) {
    const balance = await connection.getBalance(new solanaWeb3.PublicKey(pubKey));
    return balance / solanaWeb3.LAMPORTS_PER_SOL;
  }
}

module.exports = SolanaService;
