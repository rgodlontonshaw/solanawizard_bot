import { SolanaService } from "./src/solana/SolanaService";
import { KeyboardLayouts } from "./src/ui/KeyboardLayouts";
import * as solanaWeb3 from "@solana/web3.js";
import { transferSOL } from "./src/transactions/solanaTransactions";
import { SettingsScreen } from "./src/settings/Settings.mjs"; // Fixed import path
import bs58 from "bs58";
import TelegramBot from "node-telegram-bot-api";
import db from "./src/db/FirebaseService";
import { Keypair, PublicKey } from "@solana/web3.js";
import { startListeningForNewPairs } from './src/services/NewPairFetcher';
import { HelpScreen } from "./src/help/Help";

interface TransferState {
  [chatId: string]: any;
}

let transferState: TransferState = {};

// Assuming bot is initialized somewhere in the file, if not, it should be initialized as follows:
const token = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

// Handle callback queries from the inline keyboard
bot.on("callback_query", async (callbackQuery: TelegramBot.CallbackQuery) => {
  const message = callbackQuery.message!;
  const data = callbackQuery.data!;
  const action = callbackQuery.data!;
  const msg = callbackQuery.message!;
  const chatId = msg.chat.id;
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
        const message = formatNewPairMessage(newPair);
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
    case "settings":
      if (data.startsWith("toggle_") || data.startsWith("set_")) {
        const settingsScreen = new SettingsScreen(bot, msg.chat.id);
        await settingsScreen.handleButtonPress(data);
        return; // Stop further processing since we handled the settings action
      }
      break;
    case "close":
      try {
        await bot.deleteMessage(msg.chat.id, messageId);
      } catch (error) {
        console.error('Failed to "fade" message:', error);
      }
      break;
    default:
      bot.sendMessage(msg.chat.id, "Not sure what you want, try again.");
      break;
  }
});

async function start(chatId: string): Promise<void> {
  console.log("Starting with chatId:", chatId);
  let userWalletDoc = db.collection("userWallets").doc(chatId.toString());
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
    ...KeyboardLayouts.getStartMenuKeyboard(),
  });
}

async function getProfile(chatId: string): Promise<void> {
  let userWalletDoc = db.collection("userWallets").doc(chatId.toString());
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
    ...KeyboardLayouts.getProfileMenuKeyboard(),
  });
}

async function deleteWallet(chatId: string): Promise<void> {
  try {
    await db.collection("userWallets").doc(chatId.toString()).delete();
    bot.sendMessage(chatId, "Your wallet has been successfully deleted.");
  } catch (error) {
    console.error("Error deleting wallet:", error);
    bot.sendMessage(
      chatId,
      "An error occurred while trying to delete your wallet. Please try again later.",
    );
  }
}

