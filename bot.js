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

const token = process.env.TELEGRAM_BOT_TOKEN;

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
            [{ text: '⭐️ Strategies', callback_data: 'strategies' }, { text: '🎯 Quick Snipe and Trade', callback_data: 'quick_trade_sniper' }],
            [{ text: '🤖 Rapid Snipe and Sell', callback_data: 'rapid_snipe' }, { text: '👤 Profile', callback_data: 'profile' }],
            [{ text: '💼 Transfer Sol', callback_data: 'sol_transfer' }, { text: '🔄 Trades History', callback_data: 'trades_history' }],
            [{ text: '🔥 New Pairs List', callback_data: 'new_pairs' }, { text: '🆕 New Pairs Volume List', callback_data: 'new_pairs_volume' }],
            [{ text: '🔗 Referral System', callback_data: 'referral_system' }, { text: '⚙️ Settings', callback_data: 'settings' }],
            [{ text: 'ℹ️ Help', callback_data: 'help' }, { text: '❌ Close', callback_data: 'close' }]
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
  const solscanUrl = `https://solscan.io/account/${publicKey.toString()}`; // Construct the Solscan URL
  const welcomeMessage = `Solana Wizard Bot: Your Gateway to Solana DeFi Professional Trading 🤖\n\n` +
                         `Your Wallet Address\n` +
                         `${publicKey.toString()}\n` +
                         `Balance: ${solBalance.toFixed(6)} SOL\n\n` +
                         `View on Explorer: ${solscanUrl}`; 
  

  bot.sendMessage(chatId, welcomeMessage, getStartMenuKeyboard());
});

let transferState = {};

// Handle callback queries from the inline keyboard
bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = message.chat.id;

  // Reset transfer state if starting a new transfer or if any other button is pressed
  if (data !== 'input_amount' && data !== 'input_address') {
    transferState[chatId] = {};
  }

  // Define the logic for each callback data
  switch (data) {
    case 'strategies':
      // Implement strategies functionality
      bot.sendMessage(chatId, 'Strategies functionality will be implemented soon.');
      break;
    case 'quick_trade_sniper':
      // Implement Quick Trade Sniper functionality
      bot.sendMessage(chatId, 'Quick Snipe and Trade functionality will be implemented soon.');
      break;
    case 'rapid_snipe':
      // Implement Rapid Snipe and Sell functionality
      bot.sendMessage(chatId, 'Rapid Snipe and Sell functionality will be implemented soon.');
      break;
    case 'profile':
      // Implement Profile functionality
      bot.sendMessage(chatId, 'Profile functionality will be implemented soon.');
      break;
    case 'sol_transfer':
      transferState[chatId] = { stage: 'input_address' };
      bot.sendMessage(chatId, 'Please enter the recipient SOL address:');
      break;
    case 'trades_history':
      // Implement Trades History functionality
      bot.sendMessage(chatId, 'Trades History functionality will be implemented soon.');
      break;
    case 'new_pairs':
   
      bot.sendMessage(chatId, "Starting to fetch new Solana token pairs...");

      // Start the polling process within the NewPairFetcher class
      pairFetcher.startPolling();
      
      pairFetcher.on('newPair', (pair) => {
        bot.sendMessage(chatId, `New Pair Detected!\nName: ${pair.tokenName}\nAddress: ${pair.tokenAddress}`);});
      break;
    case 'new_pairs_volume':
      // Implement New Pairs Volume List functionality
      bot.sendMessage(chatId, 'New Pairs Volume List functionality will be implemented soon.');
      break;
    case 'referral_system':
      // Implement Referral System functionality
      bot.sendMessage(chatId, 'Referral System functionality will be implemented soon.');
      break;
    case 'settings':
      // Implement Settings functionality
      bot.sendMessage(chatId, 'Settings functionality will be implemented soon.');
      break;
    case 'help':
      // Implement Help functionality
      bot.sendMessage(chatId, 'Help functionality will be implemented soon.');
      break;
    case 'close':
      // Close the inline keyboard or exit the conversation
      bot.sendMessage(chatId, 'Closing the menu.');
      break;
    default:
      bot.sendMessage(chatId, 'Not sure what you want, try again.');
      break;
  }
});

// Listen for messages to handle different stages of the transfer process
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Check if we are in the 'input_address' stage for this chatId
  if (transferState[chatId] && transferState[chatId].stage === 'input_address') {
    // Save the address and prompt for the amount
    transferState[chatId] = { stage: 'input_amount', address: text };
    bot.sendMessage(chatId, 'Please enter the amount of SOL to transfer:');
  } else if (transferState[chatId] && transferState[chatId].stage === 'input_amount') {
    // We have the address and the amount, perform the transfer
    const amount = parseFloat(text);
    if (isNaN(amount)) {
      bot.sendMessage(chatId, 'Invalid amount. Please enter a number.');
    } else {
      // Call the function to perform the transfer (to be implemented)
      transferSOL(chatId, transferState[chatId].address, amount);
      // Reset the transfer state
      transferState[chatId] = {};
    }
  }
});

async function transferSOL(chatId, recipientAddress, amount) {
  try {
    // Connect to the Solana cluster
    const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'));

    // Get the sender's wallet keypair
    const senderWallet = getSenderWallet(); // Implement this function to retrieve the sender's wallet keypair

    // Construct the transfer instruction
    const instruction = solanaWeb3.SystemProgram.transfer({
      fromPubkey: senderWallet.publicKey,
      toPubkey: new solanaWeb3.PublicKey(recipientAddress),
      lamports: solanaWeb3.LAMPORTS_PER_SOL * amount, // Amount in SOL (convert to lamports)
    });

    // Sign and send the transaction
    const transaction = new solanaWeb3.Transaction().add(instruction);
    const signature = await solanaWeb3.sendAndConfirmTransaction(
      connection,
      transaction,
      [senderWallet], // Array of signing keypairs
      { commitment: 'confirmed' } // Wait for the transaction to be confirmed
    );

    // Transaction successful
    console.log('Transaction successful:', signature);
    bot.sendMessage(chatId, `Successfully transferred ${amount} SOL to ${recipientAddress}`);
  } catch (error) {
    // Transaction failed
    console.error('Transaction failed:', error);
    bot.sendMessage(chatId, 'Failed to transfer SOL. Please try again later.');
  }
}

// Handle the /start command
bot.onText(/\/start/, (msg) => {
  // Your code to handle the start command
  bot.sendMessage(msg.chat.id, 'Welcome to the bot! Choose an option from the menu.');
});

// Handle the /strategies command
bot.onText(/\/strategies/, (msg) => {
  // Your code to handle the strategies command
  bot.sendMessage(msg.chat.id, 'Accessing trading strategies...');
});

// Handle the /quicktrade command
bot.onText(/\/quicktrade/, (msg) => {
  // Your code to handle the quicktrade command
  bot.sendMessage(msg.chat.id, 'Using Quick Snipe and Trade feature...');
});

// Handle the /rapidsnipe command
bot.onText(/\/rapidsnipe/, (msg) => {
  // Your code to handle the rapidsnipe command
  bot.sendMessage(msg.chat.id, 'Using Rapid Snipe and Sell feature...');
});

// Handle the /profile command
bot.onText(/\/profile/, (msg) => {
  // Your code to handle the profile command
  bot.sendMessage(msg.chat.id, 'Viewing your profile...');
});

// Handle the /soltransfer command
bot.onText(/\/soltransfer/, (msg) => {
  // Your code to handle the soltransfer command
  bot.sendMessage(msg.chat.id, 'Preparing to transfer SOL tokens...');
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
  pairFetcher.startPolling();
  
  pairFetcher.on('newPair', (pair) => {
    bot.sendMessage(chatId, `New Pair Detected!\nName: ${pair.tokenName}\nAddress: ${pair.tokenAddress}`);});
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

