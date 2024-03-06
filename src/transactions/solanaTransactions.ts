import solanaWeb3, { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();
import bs58 from 'bs58';

import { Db, Bot } from '../types'; 

export async function transferSOL(db: Db, bot: Bot, chatId: string, recipientAddress: string, amountSol: number): Promise<void> {
    try {
        if (!chatId) throw new Error('Chat ID is missing or invalid.');
        if (!recipientAddress) throw new Error('Recipient address is missing or invalid.');
        if (typeof amountSol !== 'number' || isNaN(amountSol) || amountSol <= 0) throw new Error('Amount must be a positive number.');

        // Retrieve the document for the user
        let doc = await db.collection('userWallets').doc(chatId.toString()).get();
        if (!doc.exists) throw new Error('Wallet not found for the user.');
        const walletData = doc.data();
        // Decode the Base58 encoded secret key
        const secretKey = bs58.decode(walletData.secretKey);
        const clusterApiUrl = solanaWeb3.clusterApiUrl;

        // Check the length of the decoded secret key
        if (secretKey.length !== 64) {
            throw new Error("Decoded secret key must be 64 bytes long");
        }

        // Create a Keypair from the secret key
        const senderKeypair = Keypair.fromSecretKey(secretKey);

        // Setup the connection to the Solana cluster
        const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
        
        // Calculate the lamports to transfer
        const lamports = amountSol * LAMPORTS_PER_SOL;

        // Check if the sender account has enough balance to cover the transaction
        const senderBalance = await connection.getBalance(senderKeypair.publicKey);
        if (senderBalance < lamports) {
            throw new Error(`Insufficient funds: Your balance is ${senderBalance / LAMPORTS_PER_SOL} SOL, but the transaction requires at least ${amountSol} SOL.`);
        }

        // Prepare the transaction
        let transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: senderKeypair.publicKey,
                toPubkey: new PublicKey(recipientAddress),
                lamports,
            })
        );

        // Sign and send the transaction
        var signature = await sendAndConfirmTransaction(connection, transaction, [senderKeypair]);

        console.log('Transaction successful:', signature);
        bot.sendMessage(chatId, `Successfully transferred ${amountSol} SOL to ${recipientAddress}`);
    } catch (error) {
        console.error('Transaction failed:', error);
        var errorMessage=error!.toString();
        bot.sendMessage(chatId, `Failed to transfer SOL: ${errorMessage}. Please try again later.`);
    }
}
