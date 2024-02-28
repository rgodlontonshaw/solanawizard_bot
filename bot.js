require('dotenv').config();
const bot = require('./src/bot/TelegramBotService');
const db = require('./src/db/FirebaseService');
const SolanaService = require('./src/solana/SolanaService');
const KeyboardLayouts = require('./src/ui/KeyboardLayouts');
const NewPairFetcher = require('./src/api/NewPairFetcher');
const solanaWeb3 = require('@solana/web3.js');
const { transferSOL } = require('./src/transactions/solanaTransactions');
const pairFetcher = new NewPairFetcher(process.env.DEXTOOLS_API_KEY);
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
require('dotenv').config();

let transferState = {};


bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString(); // Convert chat ID to string for Firestore document ID
  start(msg.chat.id.toString());
});


// Handle callback queries from the inline keyboard
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  // Reset transfer state if starting a new transfer or if any other button is pressed
  if (data !== 'input_amount' && data !== 'input_address') {
    transferState[chatId] = {};
  }

  // Define the logic for each callback data
  switch (data) {

    case 'delete_wallet':
      deleteWallet(chatId);
      try {
        let text = '';
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        console.error('Failed to "fade" message:', error);
      }
    break;
    case 'quick_trade_sniper':
      bot.sendMessage(chatId, 'Quick Snipe and Trade functionality will be implemented soon.');
      break;
    case 'profile':
  
    bot.sendMessage(chatId, 'Viewing your profile...');
    getProfile (chatId);

      break;
    case 'sol_transfer':
      transferState[chatId] = { stage: 'input_address_amount' };

      bot.sendMessage(chatId, 'Enter Addresses with Amounts\n'+
      'The address and amount are separated by commas.\n\n' +
      'Example:\n' +
      'EwR1MRLoXEQR8qTn1AF8ydwujqdMZVs53giNbDCxich,0.001', {
        reply_markup: JSON.stringify({
          force_reply: true,
        }),
      });
   
      break;
    case 'trades_history':
      bot.sendMessage(chatId, 'Trades History functionality will be implemented soon.');
      break;
    case 'newpairs':
      bot.sendMessage(chatId, "Starting to fetch new Solana token pairs...");
      // pairFetcher.startPolling();
      // pairFetcher.on('newPair', (pair) => {
      //   bot.sendMessage(chatId, `New Pair Detected!\nName: ${pair.tokenName}\nAddress: ${pair.tokenAddress}`);
      // });
      break;
    case 'referral_system':
      // Implement Referral System functionality
      bot.sendMessage(chatId, 'Referral System functionality will be implemented soon.');
      break;
    case 'settings':
      // Implement Settings functionality
      bot.sendMessage(chatId, 'Settings functionality will be implemented soon.');
      break;
    case 'close':
      try {
        let text = '';
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        console.error('Failed to "fade" message:', error);
      }
      break;
    default:
      bot.sendMessage(chatId, 'Not sure what you want, try again.');
      break;
  }
});

async function start(chatId) {
  console.log("Starting with chatId:", chatId);
  let userWalletDoc = await db.collection('userWallets').doc(chatId);
  let doc = await userWalletDoc.get();

  if (!doc.exists) {
      bot.sendMessage(chatId, '🚀 Creating new wallet. 💼 Hold tight.. 🚀');
      const newWallet = Keypair.generate(); // Directly using solanaWeb3.Keypair.generate()

      // Encoding the secret key with bs58
      const encodedSecretKey = bs58.encode(newWallet.secretKey);

      await userWalletDoc.set({
          publicKey: newWallet.publicKey.toString(),
          secretKey: encodedSecretKey // Store the bs58 encoded secret key
      });
  }

  const userWalletData = await userWalletDoc.get();
  const publicKey = new solanaWeb3.PublicKey(userWalletData.data().publicKey);
  const solBalance = await SolanaService.getSolBalance(publicKey);

  const formattedSolBalance = solBalance.toFixed(6);

  const welcomeMessage = `We make Solana trading easy, fast, and secure. 🚀\n\n` +
      `🔑 <b>Your Wallet Address:</b> <code>${publicKey.toString()}</code>\n` +
      `💰 <b>Current Balance:</b> <code>${formattedSolBalance} SOL</code>\n` +
      `🌐 <a href="https://solscan.io/account/${publicKey.toString()}">View Wallet on Solscan</a>\n\n` +
      `Get started by exploring the menu below. Happy trading!`;

  bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...KeyboardLayouts.getStartMenuKeyboard()
  });
}


async function getProfile(chatId) {
  let userWalletDoc = db.collection('userWallets').doc(chatId.toString());
  let doc = await userWalletDoc.get();

  if (!doc.exists) {
      bot.sendMessage(chatId, "You don't have a wallet yet. 🛑 Use /start to create one.");
      return;
  }

  const publicKey = new solanaWeb3.PublicKey(doc.data().publicKey);
  const solBalance = await SolanaService.getSolBalance(publicKey);

  // Enhancing the profile message with emojis and Markdown for a "funky" look
  const profileMessage = `👤 *Your Profile*\n\n` +
                          `🔑 *Wallet Address:*\n\`${publicKey.toString()}\`\n\n` +
                          `💰 *Balance:* \`${solBalance.toFixed(6)} SOL\`\n\n` +
                          `🔍 [View on Solscan](https://solscan.io/account/${publicKey.toString()})`;

  bot.sendMessage(chatId, profileMessage, { 
      parse_mode: 'Markdown', 
      disable_web_page_preview: true, // Disable URL preview
      ...KeyboardLayouts.getProfileMenuKeyboard() 
  });
}

async function deleteWallet(chatId) {
  try {
    await db.collection('userWallets').doc(chatId.toString()).delete();
    bot.sendMessage(chatId, "Your wallet has been successfully deleted.");
  } catch (error) {
    console.error("Error deleting wallet:", error);
    bot.sendMessage(chatId, "An error occurred while trying to delete your wallet. Please try again later.");
  }
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🪄 Welcome to the Solana Wizard bot! 🧙');
});

// Handle the /quicktrade command
bot.onText(/\/quicktrade/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Using Quick Snipe and Trade feature...');
});

bot.onText(/\/profile/, (msg) => {
  getProfile (msg.chat.id);
});

// Handle the /trades_history command
bot.onText(/\/trades_history/, (msg) => {
  // Your code to handle the trades_history command
  bot.sendMessage(msg.chat.id, 'Viewing your trades history...');
});

// Handle the /newpairs command
bot.onText(/\/newpairs/, (msg) => {
  bot.sendMessage(chatId, "Starting to fetch new Solana token pairs...");

  // Start the polling process within the NewPairFetcher class
  //pairFetcher.startPolling();

  // pairFetcher.on('newPair', (pair) => {
  //   bot.sendMessage(chatId, `New Pair Detected!\nName: ${pair.tokenName}\nAddress: ${pair.tokenAddress}`);
  // });
});


bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  // Handle input for address and amount
  if (transferState[chatId] && transferState[chatId].stage === 'input_address_amount') {
    // Split the input by comma to get the address and amount
    const [address, amountString] = text.split(',');
    const amount = parseFloat(amountString);

    if (address && !isNaN(amount)) {
      // Perform the transfer
      await transferSOL(db, bot, chatId, address.trim(), amount);
      // Reset the transfer state
      transferState[chatId] = {};
    } else {
      // Inform user of incorrect format
      bot.sendMessage(chatId, 'Invalid format. Please enter the address and amount separated by a comma.');
    }
  } else {
    // Handle other non-command messages or default case
    bot.sendMessage(chatId, "I didn't recognize that command. Try /start to see all available commands.");
  }
  transferState[chatId] = {};
});