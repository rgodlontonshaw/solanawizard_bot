const SolanaService = require("./src/solana/SolanaService.js");
const KeyboardLayouts = require("./src/ui/KeyboardLayouts.js");
const solanaWeb3 = require("@solana/web3.js");
const { transferSOL } = require("./src/transactions/solanaTransactions.js");
const SettingsScreen = require("./src/settings/Settings.js");
const bs58 = require("bs58");
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const db = require("./src/db/FirebaseService.js");
const { Connection, Keypair, Transaction, sendAndConfirmTransaction, PublicKey, VersionedTransaction, getProgramAccounts,clusterApiUrl } = solanaWeb3;
const fetchNewPairs = require("./src/services/NewPairFetcher.js");
const HelpScreen = require("./src/help/Help.js");
const fetch = require("node-fetch");
const { newPairEmitter, runListener } = require("./src/services/NewPairFetcher.js");
const { Metadata } = require('@metaplex-foundation/mpl-token-metadata');
const connection = new Connection(clusterApiUrl('mainnet-beta'));
const telegramBotInteraction = require('./src/services/TelegramBot.js');
const userWalletManagement = require('./src/managers/walletmanager.js');
const fetchCross = require('cross-fetch');
const { Wallet } = require('@project-serum/anchor');
const TRANSACTION_FEE_PAYER_COUNT = 1;
const { VersionedMessage } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID } = require("@project-serum/anchor/dist/cjs/utils/token.js");
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

let solBalanceMain = '';
let tokenAddress = "";
let transferState = {};
let chatStates = {};

let accountStates = {};

function setAccountState(chatId, key, value) {
  if (!accountStates[chatId]) {
    accountStates[chatId] = {};
  }
  accountStates[chatId][key] = value;
}

function getAccountState(chatId, key) {
  return accountStates[chatId] ? accountStates[chatId][key] : null;
}

function startListeningForNewPairs(chatId) {
  runListener();
  newPairEmitter.on('newPair', (tokenData) => {
    const message = `🆕 New Pair Detected!\n🪙 Name: ${tokenData.name}\n📝 Symbol: ${tokenData.symbol}\n🌐 Website: ${tokenData.web}\n🐦 Twitter: ${tokenData.twitter}\n📱 Telegram: ${tokenData.telegram}`;
    bot.sendMessage(chatId, message);
  });
}

// Handle callback queries from the inline keyboard
bot.on("callback_query", async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  // Clear chatStates[chatId] when "Close" is tapped or for other actions as needed
  if (data === "close") {
    delete chatStates[chatId];
    try {
      await bot.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error('Failed to "fade" message:', error);
    }
    return; // Stop further processing
  } else {
    delete chatStates[chatId];
  }

  if (data.startsWith("toggle_") || data.startsWith("set_")) {
    const settingsScreen = new SettingsScreen(bot, chatId);
    await settingsScreen.handleButtonPress(data);
    return; // Stop further processing since we handled the settings action
  }

  if (data.startsWith("sell_100_")) {
    console.log(`sell hit for chatId: ${chatId}`);
    const tokenSymbol = data.split("sell_100_")[1];
    await sellToken(chatId, tokenSymbol);
    return; // Stop further processing
  }

  // Define the logic for each callback data
  switch (data) {
    case 'buy':
      // Call your function to handle buying
      await handleBuy(chatId);
      break;
    case 'sell':
      // Call your function to handle selling
      await handleSell(chatId);
      break;
    case "delete_wallet":
      deleteWallet(chatId);
      try {
        let text = "";
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        console.error('Failed to "fade" message:', error);
      }
      break;
    case "quick_trade_sniper":
      bot.sendMessage(
        chatId,
        "🧙 Quick Snipe and Trade functionality will be implemented soon.",
      );
      break;
    case "profile":
      bot.sendMessage(chatId, "🧙 Viewing your profile...");
      getProfile(chatId);

      break;
    case "sol_transfer":
      transferState[chatId] = { stage: "input_address_amount" };

      bot.sendMessage(
        chatId,
        "🧙 Enter Addresses with Amounts\n" +
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
        "🧙 Trades History functionality will be implemented soon.",
      );
      break;
    case "newpairs":
      bot.sendMessage(chatId, "🧙Starting to fetch new Solana token pairs...");
      startListeningForNewPairs(chatId);
      break;
    case "referral_system":
      // Implement Referral System functionality
      bot.sendMessage(
        chatId,
        "🧙 Referral System functionality will be implemented soon.",
      );
      break;
    case "settings":
      bot.sendMessage(
        chatId,
        "🧙 Settings functionality will be implemented soon.",
      );
      const settingsScreen = new SettingsScreen(bot, chatId);
      await settingsScreen.showSettings();
      break;
    case 'sell_100_':
      console.log(`sell hit for chatId: ${chatId}`);
      const tokenMintAddress = data.split("sell_100_")[1];
      await sellToken(chatId, tokenMintAddress);
    break;
    case "close":
      try {
        let text = "";
        await bot.deleteMessage(msg.chat.id, messageId);
      } catch (error) {
        console.error('Failed to "fade" message:', error);
      }
    case "custom_sol":
      chatStates[chatId] = { state: 'input_amount' };
      // Prompt the user to enter an amount
      bot.sendMessage(chatId, `Please enter the amount of SOL you want to buy (0-${solBalanceMain}):`, {
        reply_markup: JSON.stringify({
          force_reply: true,
        }),
      },);
      break;
    default:
      bot.sendMessage(msg.chat.id, "🧙 Not sure what you want, try again.");
      break;
  }
});

async function start(chatId) {
  console.log("Starting with chatId:", chatId);
  let userWalletDoc = await db.collection("userWallets").doc(chatId.toString());
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
  const publicKey = new PublicKey(userWalletData.data().publicKey);
  const solBalance = await SolanaService.getSolBalance(publicKey);

  const formattedSolBalance = solBalance.toFixed(6);
  solBalanceMain = formattedSolBalance

  const welcomeMessage =
    `We make Solana trading easy, fast, and secure. 🚀\n\n` +
    `👤 Your Profile\n\n` +
    `💼 <b>Your Wallet Address:</b> <code>${publicKey.toString()}</code>\n` +
    `💰 <b>Current Balance:</b> <code>${formattedSolBalance} SOL</code>\n` +
    `🌐 <a href="https://solscan.io/account/${publicKey.toString()}">View Wallet on Solscan</a>\n\n` +
    `Get started by exploring the menu below. Happy trading!`;

  getTokenHoldings(chatId);

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...KeyboardLayouts.getStartMenuKeyboard(),
  });
}

async function getProfile(chatId) {
  let userWalletDoc = db.collection("userWallets").doc(chatId.toString());
  let doc = await userWalletDoc.get();

  if (!doc.exists) {
    bot.sendMessage(
      chatId,
      "🧙 You don't have a wallet yet. 🛑 Use /start to create one.",
    );
    return;
  }

  const publicKey = new solanaWeb3.PublicKey(doc.data().publicKey);
  const solBalance = await SolanaService.getSolBalance(publicKey);

  const profileMessage =
    `👤 *Your Profile*\n\n` +
    `🔑 *Wallet Address:*\n\`${publicKey.toString()}\`\n\n\n` +
    `💰 *Balance:* \`${solBalance.toFixed(6)} SOL\`\n\n\n` +
    `🔍 [View on Solscan](https://solscan.io/account/${publicKey.toString()})`;

  getTokenHoldings(msg.chat.id);

  bot.sendMessage(chatId, profileMessage, {
    parse_mode: "Markdown",
    disable_web_page_preview: true, // Disable URL preview
    ...KeyboardLayouts.getProfileMenuKeyboard(),
  });
}

async function deleteWallet(chatId) {
  try {
    await db.collection("userWallets").doc(chatId.toString()).delete();
    bot.sendMessage(chatId, "Your wallet has been successfully deleted.");
  } catch (error) {
    console.error("Error deleting wallet:", error);
    bot.sendMessage(
      chatId,
      " 🪄 An error occurred while trying to delete your wallet. Please try again later.",
    );
  }
}

bot.onText(/\/home/, (msg) => {
  bot.sendMessage(msg.chat.id, "🧙 Welcome to the Sol Wizard Bot! 🪄 ");
  start(msg.chat.id)
});

// Handle the /quicktrade command
bot.onText(/\/quicktrade/, (msg) => {
  bot.sendMessage(msg.chat.id, "🧙 Using Quick Snipe and Trade feature...");
});

bot.onText(/\/profile/, (msg) => {
  getProfile(msg.chat.id);
});

// Handle the /trades_history command
bot.onText(/\/trades_history/, (msg) => {
  // Your code to handle the trades_history command
  bot.sendMessage(msg.chat.id, "Viewing your trades history...");
});

// Handle the /newpairs command
bot.onText(/\/newpairs/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "🧙 Starting to fetch new Solana token pairs...");
  startListeningForNewPairs(chatId);
});

bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;
  const settingsScreen = new SettingsScreen(bot, chatId);
  await settingsScreen.showSettings();
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpScreen = new HelpScreen(bot, chatId);
  helpScreen.showHelp();
});

bot.onText(/([A-HJ-NP-Za-km-z1-9]{44})/, async (msg, match) => {
  const chatId = msg.chat.id;
  tokenAddress = String(match[1]);
  setAccountState(chatId, 'tokenAddress', tokenAddress);

  const tokenDetailsMessage = await fetchTokenDetails(tokenAddress);
  const opts = {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Swap', callback_data: 'swap' }, { text: '🪄 Limit', callback_data: 'limit' }, { text: '🪄 DCA', callback_data: 'dca' }],
        [{ text: ' 🪄 Buy 0.5 SOL', callback_data: '0.5_sol' }, { text: '1 SOL', callback_data: '1_sol' }, { text: '🪄 Buy 3 SOL', callback_data: '3_sol' }],
        [{ text: '🪄 Buy 5 SOL', callback_data: '5_sol' }, { text: '10 SOL', callback_data: '10_sol' }, { text: '🪄 Buy X SOL', callback_data: 'custom_sol' }],
        [{ text: '🪄 15% Slippage', callback_data: '15_slippage' }, { text: '🪄 X Slippage', callback_data: 'custom_slippage' }],
        [{ text: '❌ Close', callback_data: 'close' }]
      ]
    }
  };
  bot.sendMessage(chatId, tokenDetailsMessage, opts);
});

async function sellToken(chatId, tokenAddress) {
  try {

    const tokenMintAddress = tokenAddress

    const userWalletDoc = await db.collection("userWallets").doc(chatId.toString()).get();
    if (!userWalletDoc.exists) {
      throw new Error("Wallet not found.");
    }
    const userWalletData = userWalletDoc.data();
    const secretKey = bs58.decode(userWalletData.secretKey);
    const wallet = solanaWeb3.Keypair.fromSecretKey(secretKey);


    const quoteResponse = await fetch(`https://quote-api.jup.ag/v1/quote?inputMint=${tokenMintAddress}&outputMint=So11111111111111111111111111111111111111112&amount=YOUR_TOKEN_AMOUNT_IN_LAMPORTS&slippage=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => response.json());

    if (!quoteResponse || !quoteResponse.data) {
      throw new Error("Failed to fetch quote from Jupiter.");
    }

    // Execute the swap
    const swapResponse = await fetch('https://quote-api.jup.ag/v1/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        wallet: wallet.publicKey.toString(),
        route: quoteResponse.data.route,
        userPublicKey: wallet.publicKey.toString(),
        wrapUnwrapSOL: true
      }),
    }).then(response => response.json());

    if (!swapResponse || !swapResponse.transaction) {
      throw new Error("Failed to execute swap on Jupiter.");
    }

    // Sign and send the transaction
    const transaction = new solanaWeb3.Transaction().add(solanaWeb3.Transaction.from(swapResponse.transaction));
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    transaction.sign(wallet);

    const serializedTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(serializedTransaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    console.log(`Swap successful with transaction ID: ${txid}`);
    bot.sendMessage(chatId, `✅ Successfully sold ${tokenSymbol}. Transaction ID: ${txid}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in sellToken:', error);
    bot.sendMessage(chatId, `❌ Sell failed: ${error.message}`);
  }
}

async function resolveTokenMintAddress(tokenSymbol) {
  const url = `https://api.jup.ag/v1/tokens/${tokenSymbol}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch token information for ${tokenSymbol}`);
    }
    const tokenData = await response.json();
    return tokenData?.mint || null; // Check for existence of mint property
  } catch (error) {
    console.error('Error fetching token mint address:', error);
    return null;
  }
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  if (
    transferState[chatId] &&
    transferState[chatId].stage === "input_address_amount"
  ) {
    // Split the input by comma to get the address and amount
    const [address, amountString] = text.split(",");
    const amount = parseFloat(amountString);

    if (address && !isNaN(amount)) {
      // Perform the transfer
      await transferSOL(db, bot, chatId, address.trim(), amount);
      // Reset the transfer state
      transferState[chatId] = {};
    } else {
      // Inform user of incorrect format
      bot.sendMessage(
        chatId,
        "🧙 Invalid format. Please enter the address and amount separated by a comma.",
      );
    }
  }
  transferState[chatId] = {};

  if (chatStates[chatId] && chatStates[chatId].state === 'input_amount') {
    // Process the input as the amount
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "Invalid amount. Please enter a positive number.");
    } else {
      // Here, you would call your function to handle the amount, e.g., to initiate a token purchase
      console.log(`Amount entered by user: ${amount} SOL`);
      // Reset the state
      chatStates[chatId] = {};
      // Confirm the action to the user
      bot.sendMessage(chatId, `⚡ 🟣 You've entered ${amount} SOL. Proceeding with the purchase...`);
      // Call your function to handle the purchase
      await purchaseToken(chatId, amount);
    }
  }
});


async function handleBuy(chatId) {
  bot.sendMessage(chatId, "🧙 Paste a token contract address to buy a token. " + String.fromCodePoint(0x21C4));
}

async function handleSell(chatId) {

  let tokens = await getUserTokens(chatId);
  let inline_keyboard = [];
  
  for (const token of tokens) {
    inline_keyboard.push([
      { text: `${token.name}`, callback_data: 'do_nothing' }
    ]);
    inline_keyboard.push([
      { text: `Sell X% ${token.symbol}`, callback_data: `sell_x_${token.mintAddress}` },
      { text: `Sell 100% ${token.symbol}`, callback_data: `sell_100_${token.mintAddress}` },
    ]);
  }
  
  
  inline_keyboard.push(
    [{ text: '❌ Close', callback_data: 'close' }]
  );

  const sellOptions = {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: inline_keyboard }
  };

  bot.sendMessage(chatId, "Select sell options:", sellOptions);
  console.log(`Handling sell for chatId: ${chatId}`);
}

async function getUserTokens(chatId) {
  // Retrieve the user's public key from the database
  let userWalletDoc = await db.collection("userWallets").doc(chatId.toString());
  let userWalletData = await userWalletDoc.get();
  const publicKey = userWalletData.data().publicKey; 
  
  const response = await fetch(`https://api.shyft.to/sol/v1/wallet/all_tokens?network=mainnet-beta&wallet=${publicKey}`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'x-api-key': '-ZMCvwqQpkEEYUvd',
    }
  });

  const responseData = await response.json();
  
  if (responseData.success && responseData.result) {
    // Transform the response data into an array of token objects with symbol and balance.
    return responseData.result.map(token => ({
      symbol: token.info.symbol,
      balance: token.balance,
      name: token.info.name,
      mintAddress: token.info.mintAddress,
    }));
  } else {
    // Handle errors or no tokens found
    console.error('Failed to fetch token holdings:', responseData.message);
    return [];
  }
}


async function getMetadataPDA(mintAddress) {
  try {
    // Validate the mintAddress before proceeding
    if (typeof mintAddress !== 'string' || mintAddress.length !== 44) {
      throw new Error(`Invalid mint address format. Type: ${typeof mintAddress}, Length: ${mintAddress.length}`);
    }
    const mint = new PublicKey(mintAddress);
    // Check if the mint address is on curve to avoid assertion failure
    if (!PublicKey.isOnCurve(mint.toBuffer())) {
      throw new Error('Mint address is not on curve');
    }
    const pda = await new Promise((resolve) => {
      const [pdaAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), METAPLEX_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        METAPLEX_PROGRAM_ID
      );
      resolve(pdaAddress);
    });
    return pda;
  } catch (error) {
    console.error('Error in getMetadataPDA:', error);
 
    if (error.message.includes('Invalid mint address format')) {
      throw new Error(`Invalid mint address: Type: ${typeof mintAddress}, Length: ${mintAddress ? mintAddress.length : 'N/A'}, Value: ${mintAddress}`);
    } else {
      throw new Error('Invalid mint address');
    }
  }
}

async function fetchTokenMetadata(mintAddress) {
  try {
    const pda = await getMetadataPDA(mintAddress);
    const metadata = await Metadata.fromAccountAddress(connection, pda);
    return metadata.data;
  } catch (error) {
    console.error('Error in fetchTokenMetadata:', error);
    throw error;
  }
}

async function fetchTokenDetails(tokenAddress) {
  try {

    const isValid = await validateTokenAddress(tokenAddress);
    if (!isValid) {
      return 'Invalid token address';
    }

    console.log("fetchTokenDetails tokenAddress:", tokenAddress, "Type:", typeof tokenAddress);

    const metadata = await fetchTokenMetadata(tokenAddress);

    const message = [
      `${metadata.name}\n${metadata.symbol}\n<code>${tokenAddress.toString()}</code>\n`,
      `URI: ${metadata.uri}`,
      `Seller fee basis points: ${metadata.sellerFeeBasisPoints}`,
      `Creators: ${metadata.creators ? metadata.creators.map(creator => `${creator.address} (${creator.share}%)`).join(', ') : 'None'}`,
    ].join('\n');

    return message;
  } catch (error) {
    console.error('Error:', error);
    if (error.message === 'Invalid token address') {
      return "The token address provided is invalid. Please check and try again.";
    }
    return "The token's metadata could not be fetched. The token may not exist or the address may be invalid.";
  }
}


async function validateTokenAddress(address) {
  try {
    const publicKey = new solanaWeb3.PublicKey(address);
    const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');
    const accountInfo = await connection.getAccountInfo(publicKey);
    return accountInfo !== null;
  } catch (error) {
    return false;
  }
}


async function purchaseToken(chatId, amount) {

  try {

    if (!tokenAddress || !isValidPublicKey(tokenAddress)) {
      console.error(`Invalid token address: "${tokenAddress}"`);
      bot.sendMessage(chatId, "❌ Buy failed: Invalid token address.");
      return;
    }

    const userWalletDoc = await db.collection("userWallets").doc(chatId.toString()).get();
    const userWalletData = userWalletDoc.data();

    if (!userWalletDoc.exists) {
      bot.sendMessage(chatId, "❌ Buy failed: Wallet not found.");
      return;
    }

    const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');
   

    const feePercentage = 0.005; // 0.5%
    const purchaseAmountInLamports = amount * solanaWeb3.LAMPORTS_PER_SOL;
    const recentBlockhash = await connection.getRecentBlockhash();
    const { feeCalculator } = recentBlockhash;
    const feeAmountInLamports = Math.ceil(purchaseAmountInLamports * feePercentage); // Calculate the fee, always round up to not undercharge
    const txFeeInSOL = (feeCalculator.lamportsPerSignature + feeAmountInLamports) * TRANSACTION_FEE_PAYER_COUNT / solanaWeb3.LAMPORTS_PER_SOL;
    console.log(`Transaction fee per signature: ${feeCalculator.lamportsPerSignature}`);
    console.log(`Amount for purchase in Lamports: ${purchaseAmountInLamports}`);
    console.log(`Calculated fee amount in Lamports: ${feeAmountInLamports}`);
    const totalAmount = purchaseAmountInLamports + feeAmountInLamports;
    const secretKey = bs58.decode(userWalletData.secretKey);
    const wallet = solanaWeb3.Keypair.fromSecretKey(secretKey);
    const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenAddress}&amount=${totalAmount}&slippageBps=50`).then(response => response.json());
    const requestBody = {
      quoteResponse, 
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
      inputMint: 'So11111111111111111111111111111111111111112', 
      outputMint: tokenAddress, 
    };

    // Step 1: Perform the swap request and handle the response
    const response = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { swapTransaction } = await response.json();

    if (!swapTransaction) {
      throw new Error('swapTransaction is undefined');
    }
 
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    console.log(transaction);
    transaction.sign([wallet]);
  
    try {
      // Serialize the transaction
      const serializedTransaction = transaction.serialize();
  
      // Send the serialized transaction
      const txid = await connection.sendRawTransaction(serializedTransaction, {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
      });
  
      console.log(`Transaction successful with ID: ${txid}`);
      console.log(`Swap successful: https://solscan.io/tx/${txid}`);
      bot.sendMessage(chatId, `✅ Purchase successful: [View Transaction](https://solscan.io/tx/${txid})`, { parse_mode: 'Markdown' });
   
    } catch (error) {
        console.error('Error sending transaction:', error);
    }

 } catch (error) {
    console.error('Error in purchaseToken:', error);
    bot.sendMessage(chatId, "❌ Purchase failed: " + error.message);
  }
}


function createPurchaseInstruction(walletPublicKey, tokenAddress, amount) {
  const lamports = amount * solanaWeb3.LAMPORTS_PER_SOL;

  const instruction = solanaWeb3.SystemProgram.transfer({
    fromPubkey: new solanaWeb3.PublicKey(walletPublicKey),
    toPubkey: new solanaWeb3.PublicKey(tokenAddress),
    lamports,
  });

  return instruction;
}

function isValidPublicKey(key) {
  try {
    new PublicKey(key);
    return true;
  } catch (e) {
    return false;
  }
}

async function getTokenHoldings(chatId) {

  let userWalletDoc = await db.collection("userWallets").doc(chatId.toString());
  let userWalletData = await userWalletDoc.get();

  const publicKey = new PublicKey(userWalletData.data().publicKey);
  const solBalance = await SolanaService.getSolBalance(publicKey);
  const formattedSolBalance = solBalance.toFixed(6);
  solBalanceMain = formattedSolBalance;

  const response = await fetch(`https://api.shyft.to/sol/v1/wallet/all_tokens?network=mainnet-beta&wallet=${publicKey}`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'x-api-key': '-ZMCvwqQpkEEYUvd' 
    }
  });

  const responseData = await response.json();

  if (responseData.success) {
    let message = "Your holdings:\n";
    message += `SOL: ${formattedSolBalance}\n`;

    for (const token of responseData.result) {
      message += `Token: ${token.info.name} (${token.info.symbol}), Amount: ${parseFloat(token.balance).toFixed(token.info.decimals)}\n`;
    }

    // Send the consolidated message to the user
    bot.sendMessage(chatId, message);
  } else {
    console.error('Failed to fetch token holdings:', responseData.message);
    bot.sendMessage(chatId, "Sorry, we couldn't fetch your token holdings at this time.");
  }
}

