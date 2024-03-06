import solanaWeb3 from '@solana/web3.js';
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'));

export class SolanaService {
  static async createSolanaWallet(): Promise<solanaWeb3.Keypair> {
    const newPair: solanaWeb3.Keypair = solanaWeb3.Keypair.generate();
    return newPair;
  }

  static async getSolBalance(pubKey: string): Promise<number> {
    const balance: number = await connection.getBalance(new solanaWeb3.PublicKey(pubKey));
    return balance / solanaWeb3.LAMPORTS_PER_SOL;
  }
}
