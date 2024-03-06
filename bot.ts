import { SolanaService } from "./src/solana/SolanaService";
import { KeyboardLayouts } from "./src/ui/KeyboardLayouts";
import { SettingsScreen } from "./src/settings/Settings"; // Fixed import path
import bs58 from "bs58";
import TelegramBot from "node-telegram-bot-api";
import db from "./src/db/FirebaseService";
import { startListeningForNewPairs } from './src/services/NewPairFetcher';
import { HelpScreen } from "./src/help/Help";
import solanaWeb3, { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

interface TransferState {
  [chatId: string]: any;
}

let transferState: TransferState = {};

const token = process.env.TELEGRAM_BOT_TOKEN || ''; 
const bot = new TelegramBot(token, { polling: true });

// Handle callback queries from the inline keyboard
bot.on("callback_query", async (callbackQuery) => {
  const message = callbackQuery.message!;
  const data = callbackQuery.data!;
  const action = callbackQuery.data!;
  const msg = callbackQuery.message!;
  const chatId = msg.chat.id.toString(); // Convert chatId to string
  const messageId = msg.message_id;

  // Reset transfer state if starting a new transfer or if any other button is pressed
  if (data !== "input_amount" && data !== "input_address") {
    transferState[chatId] = {};
  }

  if (data.startsWith("toggle_") || data.startsWith("set_")) {
    const settingsScreen = new SettingsScreen(bot, chatId);
    await settingsScreen.handleButtonPress(data);
    return; // Stop further processing since we handled the settings action
  }

  // Define the logic for each callback data
  switch (data) {
    case "delete_wallet":
      deleteWallet(chatId);
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        console.error('Failed to "fade" message:', error);
      }
      break;
    case "quick_trade_sniper":
      bot.sendMessage(
        chatId,
        "Quick Snipe and Trade functionality will be implemented soon.",
      );
      break;
    case "profile":
      bot.sendMessage(chatId, "Viewing your profile...");
      getProfile(chatId);

      break;
    case "sol_transfer":
      transferState[chatId] = { stage: "input_address_amount" };

      bot.sendMessage(
        chatId,
        "Enter Addresses with Amounts\n" +
        "The address and amount are separated by commas.\n\n" +
        "Example:\n" +
        "EwR1MRLoXEQR8qTn1AF8ydwujqdMZVs53giNbDCxich,0.001",
        {
          reply_markup: JSON.stringify({
            force_reply: true,
          }),
        },
      );

      break;
    case "trades_history":
      bot.sendMessage(
        chatId,
        "Trades History functionality will be implemented soon.",
      );
      break;
    case "newpairs":
      bot.sendMessage(chatId, "Starting to fetch new Solana token pairs...");

      startListeningForNewPairs((newPair: any) => {
        const message = "New pair detected!"; // Placeholder for actual message formatting logic
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      });

      break;
    case "referral_system":
      // Implement Referral System functionality
      bot.sendMessage(
        chatId,
        "Referral System functionality will be implemented soon.",
      );
      break;
    case "close":
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        console.error('Failed to "fade" message:', error);
      }
      break;
    default:
      bot.sendMessage(chatId, "Not sure what you want, try again.");
      break;
  }
});

async function start(chatId: string): Promise<void> {
  console.log("Starting with chatId:", chatId);
  let userWalletDoc = db.collection("userWallets").doc(chatId);
  let doc = await userWalletDoc.get();

  if (!doc.exists) {
    bot.sendMessage(chatId, "🚀 Creating new wallet. 💼 Hold tight.. 🚀");
    const newWallet = Keypair.generate(); 

    // Encoding the secret key with bs58
    const encodedSecretKey = bs58.encode(newWallet.secretKey);

    await userWalletDoc.set({
      publicKey: newWallet.publicKey.toString(),
      secretKey: encodedSecretKey, // Store the bs58 encoded secret key
    });
  }

  const userWalletData = await userWalletDoc.get();
  if (!userWalletData.exists) {
    console.error("Failed to retrieve user wallet data.");
    return;
  }
  const userData = userWalletData.data();
  if (!userData) {
    console.error("User data is undefined.");
    return;
  }
  const publicKey = new PublicKey(userData.publicKey);
  const solBalance = await SolanaService.getSolBalance(publicKey.toString()); // Fixed argument type

  const formattedSolBalance = solBalance.toFixed(6);

  const welcomeMessage =
    `We make Solana trading easy, fast, and secure. 🚀\n\n` +
    `👤 Your Profile\n\n` +
    `💼 <b>Your Wallet Address:</b> <code>${publicKey.toString()}</code>\n`+
    `💰 <b>Current Balance:</b> <code>${formattedSolBalance} SOL</code>\n` +
    `🌐 <a href="https://solscan.io/account/${publicKey.toString()}">View Wallet on Solscan</a>\n\n` +
    `Get started by exploring the menu below. Happy trading!`;

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: JSON.stringify(KeyboardLayouts.getStartMenuKeyboard()),
  });
}

async function getProfile(chatId: string): Promise<void> {
  let userWalletDoc = db.collection("userWallets").doc(chatId);
  let doc = await userWalletDoc.get();

  if (!doc.exists) {
    bot.sendMessage(
      chatId,
      "You don't have a wallet yet. 🛑 Use /start to create one.",
    );
    return;
  }

  const userData = doc.data();
  if (!userData) {
    console.error("User data is undefined.");
    return;
  }
  const publicKey = new solanaWeb3.PublicKey(userData.publicKey);
  const solBalance = await SolanaService.getSolBalance(publicKey.toString()); // Fixed argument type

  const profileMessage =
    `👤 *Your Profile*\n\n` +
    `🔑 *Wallet Address:*\n\`${publicKey.toString()}\`\n\n\n`+
    `💰 *Balance:* \`${solBalance.toFixed(6)} SOL\`\n\n\n`+
    `🔍 [View on Solscan](https://solscan.io/account/${publicKey.toString()})`;

  bot.sendMessage(chatId, profileMessage, {
    parse_mode: "Markdown",
    disable_web_page_preview: true, // Disable URL preview
    reply_markup: JSON.stringify(KeyboardLayouts.getProfileMenuKeyboard()),
  });
}

async function deleteWallet(chatId: string): Promise<void> {
  try {
    await db.collection("userWallets").doc(chatId).delete();
    bot.sendMessage(chatId, "Your wallet has been successfully deleted.");
  } catch (error) {
    console.error("Error deleting wallet:", error);
    bot.sendMessage(
      chatId,
      "An error occurred while trying to delete your wallet. Please try again later.",
    );
  }
}

async function transferSOL(chatId: string, recipientAddress: string, amountSol: number): Promise<void> {
  try {
      if (!chatId) throw new Error('Chat ID is missing or invalid.');
      if (!recipientAddress) throw new Error('Recipient address is missing or invalid.');
      if (typeof amountSol !== 'number' || isNaN(amountSol) || amountSol <= 0) throw new Error('Amount must be a positive number.');

      // Retrieve the document for the user
      let doc = await db.collection('userWallets').doc(chatId.toString()).get();
      if (!doc.exists) throw new Error('Wallet not found for the user.');
      const walletData = doc.data();
      if (!walletData) throw new Error('Wallet data is missing or incomplete.');
      if (!walletData.secretKey) throw new Error('Secret key is missing from wallet data.');

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
