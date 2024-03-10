const solanaWeb3 = require('@solana/web3.js');
const dotenv = require('dotenv');
dotenv.config();
const bs58 = require('bs58');

async function transferSOL(db, bot, chatId, recipientAddress, amountSol) {
    try {
        if (!chatId) throw new Error('Chat ID is missing or invalid.');
        if (!recipientAddress) throw new Error('Recipient address is missing or invalid.');
        if (typeof amountSol !== 'number' || isNaN(amountSol) || amountSol <= 0) throw new Error('Amount must be a positive number.');

        let doc = await db.collection('userWallets').doc(chatId.toString()).get();
        if (!doc.exists) throw new Error('Wallet not found for the user.');
        const walletData = doc.data();

        const secretKey = bs58.decode(walletData.secretKey);

        if (secretKey.length !== 64) {
            throw new Error("Decoded secret key must be 64 bytes long");
        }

        const senderKeypair = solanaWeb3.Keypair.fromSecretKey(secretKey);

        const connection = new solanaWeb3.Connection(`https://api.mainnet-beta.solana.com`, 'confirmed');

        const lamports = amountSol * solanaWeb3.LAMPORTS_PER_SOL;

        const senderBalance = await connection.getBalance(senderKeypair.publicKey);
        if (senderBalance < lamports) {
            throw new Error(`Insufficient funds: Your balance is ${senderBalance / solanaWeb3.LAMPORTS_PER_SOL} SOL, but the transaction requires at least ${amountSol} SOL.`);
        }

        let transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: senderKeypair.publicKey,
                toPubkey: new solanaWeb3.PublicKey(recipientAddress),
                lamports,
            })
        );

        var signature = await solanaWeb3.sendAndConfirmTransaction(connection, transaction, [senderKeypair]);

        console.log('Transaction successful:', signature);
        bot.sendMessage(chatId, `Successfully transferred ${amountSol} SOL to ${recipientAddress}`);
    } catch (error) {
        console.error('Transaction failed:', error);
        bot.sendMessage(chatId, `Failed to transfer SOL: ${error.message}. Please try again later.`);
    }
}

module.exports = { transferSOL };
