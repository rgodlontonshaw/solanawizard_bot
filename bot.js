const moment = require('moment');
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const solanaWeb3 = require('@solana/web3.js');

// Initialize Solana connection (adjust as necessary for your setup)
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'));

let serviceAccount = require('./firebase/atiani-firebase-adminsdk-25rzh-9816d96174.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const NewPairFetcher = require('./src/api/NewPairFetcher'); // Adjust the path as per your directory structure


const pairFetcher =  new NewPairFetcher(process.env.DEXTOOLS_API_KEY);


const token = '6820995483:AAGHg_jkICyGlzDBy0kAoWgcZPUzQmWhuxo';
const bot = new TelegramBot(token, { polling: true });

const db = admin.firestore();
//
// Function to create a new Solana wallet
async function createSolanaWallet() {
  // Keypair.generate() is synchronous and returns a new keypair, so no need for 'await' here
  const newPair = solanaWeb3.Keypair.generate();
  return newPair;
}

// Function to fetch SOL balance
async function getSolBalance(pubKey) {
  const balance = await connection.getBalance(new solanaWeb3.PublicKey(pubKey));
  return balance / solanaWeb3.LAMPORTS_PER_SOL; 
}

// This function creates an inline keyboard layout for the start menu
function getStartMenuKeyboard() {
  return {
      reply_markup: JSON.stringify({
          inline_keyboard: [
              [{ text: 'Buy & Sell', callback_data: 'buy_sell' }],
              [{ text: 'Token Sniper', callback_data: 'token_sniper' }],
              [{ text: 'Market Maker Bot', callback_data: 'market_maker' }],
              [{ text: 'Profile', callback_data: 'profile' }],
              [{ text: 'Trades', callback_data: 'trades' }],
              [{ text: 'Referral System', callback_data: 'referral_system' }],
              [{ text: 'Transfer SOL', callback_data: 'transfer_sol' }],
              [{ text: 'Settings', callback_data: 'settings' }],
              [{ text: 'Help', callback_data: 'help' }],
              [{ text: 'Close', callback_data: 'close' }],
              [{ text: 'NewPairs', callback_data: 'newpairs' }],
          ],
      }),
  };
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString(); // Firestore document ID must be a string

  let userWalletDoc = db.collection('userWallets').doc(chatId);
  let doc = await userWalletDoc.get();

  let publicKey; // Variable to hold the public key

  if (!doc.exists) {
    // If the user doesn't have a wallet, create a new one and use its public key
    const newWallet = await createSolanaWallet();
    await userWalletDoc.set({
      publicKey: newWallet.publicKey.toString(),
      // Consider the security implications of storing private keys
    });
    publicKey = newWallet.publicKey;
  } else {
    // If the user already has a wallet, retrieve its public key from Firestore
    let walletData = doc.data();
    publicKey = new solanaWeb3.PublicKey(walletData.publicKey);
  }

  // Fetch SOL balance using the public key
  const solBalance = await getSolBalance(publicKey);

  const welcomeMessage = `Solana Wizard Bot: Your Gateway to Solana DeFi Professional Trading\n\n` +
                         `Your Wallet Address\n` +
                         `${publicKey.toString()}\n` +
                         `Balance: ${solBalance.toFixed(6)} SOL\n\n` +
                         `View on Explorer`;

  bot.sendMessage(chatId, welcomeMessage, getStartMenuKeyboard());
});

// Handle callback queries from the inline keyboard
bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = message.chat.id;

  // Here, you should define the logic for each callback data
  switch (data) {
      case 'buy_sell':
          bot.sendMessage(chatId, 'Buy & Sell functionality will be implemented soon.');
          break;
      case 'token_sniper':
          bot.sendMessage(chatId, 'Token Sniper functionality will be implemented soon.');
          break;
      // ... handle other callback data actions
      case 'close':
          bot.sendMessage(chatId, 'Closing the menu.');
          break;
      default:
          bot.sendMessage(chatId, 'Not sure what you want, try again.');
          break;
  }
});





bot.onText(/\/newpairs/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Starting to fetch new Solana token pairs...");

  // Start the polling process within the NewPairFetcher class
  pairFetcher.startPolling();
  
  pairFetcher.on('newPair', (pair) => {
    bot.sendMessage(chatId, `New Pair Detected!\nName: ${pair.tokenName}\nAddress: ${pair.tokenAddress}`);
});
});

// Listen for any other text messages
bot.on('message', (msg) => {
  if (msg.text.startsWith('/')) {
      // Ignore commands (already handled)
      return;
  }
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "I didn't recognize that command. Try /start to see all available commands.");
});



// bot.onText(/\/sniper/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, "Snipe tokens on Solana with precision. Functionality coming soon!");
// });

// bot.onText(/\/copytrade/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, "Copy the trades of seasoned traders. Stay tuned for updates!");
// });

// bot.onText(/\/profile/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, "Here's your portfolio. [Insert dynamic content here]");
// });

// bot.onText(/\/trades/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, "Track and monitor your trades. [Insert user-specific trade data]");
// });

// bot.onText(/\/buysell/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, "Ready to swap tokens? Let's get started. [Insert trade interface]");
// });

// bot.onText(/\/settings/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, "Adjust your auto buy, auto sell, slippage settings here. [Insert settings options]");
// });

// bot.onText(/\/referral/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(chatId, "Use your referral link to invite friends and earn rewards. [Insert referral link]");
// });

// ...