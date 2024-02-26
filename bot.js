const moment = require('moment');
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const solanaWeb3 = require('@solana/web3.js');
const { PublicKey } = require('@solana/web3.js');

// Initialize Solana connection (adjust as necessary for your setup)
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'));

let serviceAccount = require('./firebase/atiani-firebase-adminsdk-25rzh-9816d96174.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const NewPairFetcher = require('./src/api/NewPairFetcher'); // Adjust the path as per your directory structure


const pairFetcher = new NewPairFetcher(process.env.DEXTOOLS_API_KEY);

const token = '6820995483:AAGHg_jkICyGlzDBy0kAoWgcZPUzQmWhuxo';

const bot = new TelegramBot(token, { polling: true });

const db = admin.firestore();

let publicKey;
let solBalance;
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

function getProfileMenuKeyboard() {
  return {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: '❌ Close', callback_data: 'close' }]
      ],
    }),
  };
}

function clearStartMenuKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: []  // This effectively removes the keyboard
    }
  };
}

function encryptPrivateKey(privateKey, encryptionKey) {
  const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// Function to decrypt the private key
function decryptPrivateKey(encryptedPrivateKey, encryptionKey) {
  const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
  let decrypted = decipher.update(encryptedPrivateKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString(); // Firestore document ID must be a string

  let userWalletDoc = db.collection('userWallets').doc(chatId);
  let doc = await userWalletDoc.get();

  let decryptedPrivateKey;

  if (!doc.exists) {
    // If the user doesn't have a wallet, create a new one and use its public key
    const newWallet = await createSolanaWallet();
    // Encrypt the private key before storing it
    const encryptedPrivateKey = encryptPrivateKey(newWallet.secretKey.toString('base64'), yourEncryptionKey);

    await userWalletDoc.set({
      publicKey: newWallet.publicKey.toString(),
      privateKey: encryptedPrivateKey, // Store the encrypted private key
    });

    publicKey = newWallet.publicKey;
  } else {
    // If the user already has a wallet, retrieve its public key from Firestore
    let walletData = doc.data();
    publicKey = new solanaWeb3.PublicKey(walletData.publicKey);
    // decryptedPrivateKey = decryptPrivateKey(walletData.privateKey, yourEncryptionKey);
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
  
    bot.sendMessage(chatId, 'Viewing your profile...');
    getProfile (chatId);

      break;
    case 'sol_transfer':
      transferState[chatId] = { stage: 'input_address_amount' };
      bot.sendMessage(chatId, 'Enter Addresses with Amounts\n' +
        'The address and amount are separated by commas.\n\n' +
        'Example:\n' +
        'EwR1MRLoXEQR8qTn1AF8ydwujqdMZVs53giNbDCxich,0.001');
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
        bot.sendMessage(chatId, `New Pair Detected!\nName: ${pair.tokenName}\nAddress: ${pair.tokenAddress}`);
      });
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
      // await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      //   chat_id: chatId,
      //   message_id: messageId
      // }).catch((error) => {
      //   console.error('Failed to edit message reply markup:', error);
      // });
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


function getSenderWallet() {
  // Ensure that the SENDER_PRIVATE_KEY environment variable is set
  if (!process.env.SENDER_PRIVATE_KEY) {
    throw new Error('Sender private key is not set in the environment variables');
  }

  // The private key should be stored as a base58 encoded string
  const privateKeyBase58 = decryptedPrivateKey;

  // Convert base58 private key to Uint8Array
  const privateKey = Uint8Array.from(Buffer.from(privateKeyBase58, 'base58'));

  // Create a keypair from the secret key
  const keypair = solanaWeb3.Keypair.fromSecretKey(privateKey);

  return keypair;
}


async function transferSOL(chatId, recipientAddress, amount) {
  try {
    // Connect to the Solana cluster
    const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'));

    // Get the sender's wallet keypair
    const senderWallet = getSenderWallet(); // Replace with your function to securely retrieve the sender's wallet keypair

    // Construct the transfer instruction
    const instruction = solanaWeb3.SystemProgram.transfer({
      fromPubkey: senderWallet.publicKey,
      toPubkey: new solanaWeb3.PublicKey(recipientAddress),
      lamports: solanaWeb3.LAMPORTS_PER_SOL * amount, // Convert amount to lamports
    });

    // Sign and send the transaction
    const transaction = new solanaWeb3.Transaction().add(instruction);
    const signature = await solanaWeb3.sendAndConfirmTransaction(
      connection,
      transaction,
      [senderWallet], // Array of signing keypairs
      { commitment: 'confirmed' }
    );

    // Transaction successful
    console.log('Transaction successful:', signature);
    // Use your actual bot instance to send a message
    bot.sendMessage(chatId, `Successfully transferred ${amount} SOL to ${recipientAddress}`);
  } catch (error) {
    // Transaction failed
    console.error('Transaction failed:', error);
    // Use your actual bot instance to send a message
    bot.sendMessage(chatId, `Failed to transfer SOL: ${error.message}. Please try again later.`);
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
  getProfile (msg.chat.id);
});

// Handle the /soltransfer command
bot.onText(/\/soltransfer/, (msg) => {
  transferState[chatId] = { stage: 'input_address_amount' };
  bot.sendMessage(chatId, 'Enter Addresses with Amounts\n' +
    'The address and amount are separated by commas.\n\n' +
    'Example:\n' +
    'EwR1MRLoXEQR8qTn1AF8ydwujqdMZVs53giNbDCxich,0.001');
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
    bot.sendMessage(chatId, `New Pair Detected!\nName: ${pair.tokenName}\nAddress: ${pair.tokenAddress}`);
  });
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
      await transferSOL(chatId, address.trim(), amount);
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

async function getProfile (chatId) {
  let userWalletDoc = db.collection('userWallets').doc(chatId.toString());
  let doc = await userWalletDoc.get();

  if (!doc.exists) {
    // If the user doesn't have a wallet, create a new one and use its public key
    const newWallet = await createSolanaWallet();
    const encryptedPrivateKey = encryptPrivateKey(newWallet.secretKey.toString('base64'), yourEncryptionKey);

    await userWalletDoc.set({
      publicKey: newWallet.publicKey.toString(),
      privateKey: encryptedPrivateKey, // Store the encrypted private key
    });

    publicKey = newWallet.publicKey;
    solBalance = await getSolBalance(publicKey); // You should define getSolBalance() to fetch the balance
  } else {
    // If the user already has a wallet, retrieve its public key
    let walletData = doc.data();
    publicKey = new PublicKey(walletData.publicKey);
    solBalance = await getSolBalance(publicKey); // You should define getSolBalance() to fetch the balance
  }

  const solscanUrl = `https://solscan.io/account/${publicKey.toString()}`; // Construct the Solscan URL

  const profileMessage = `👤 PROFILE

  --------------------------------------------------
  Balance ◎: ${solBalance.toFixed(6)} SOL
  --------------------------------------------------
  Wallet Address: [${publicKey.toString()}](${solscanUrl})`;
  await bot.sendMessage(chatId, profileMessage, {
    parse_mode: 'Markdown',
    ...getProfileMenuKeyboard() // Assuming getStartMenuKeyboard is defined and returns the keyboard object
  });
}
