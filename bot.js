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
const { Connection,Keypair, PublicKey } = solanaWeb3;
const fetchNewPairs = require("./src/services/NewPairFetcher.js");
const HelpScreen = require("./src/help/Help.js");
const fetch = require("node-fetch");
const { newPairEmitter, runListener } = require("./src/services/NewPairFetcher.js");
const { Metadata } = require('@metaplex-foundation/mpl-token-metadata');
const connection = new Connection('https://api.mainnet-beta.solana.com');
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');


let transferState = {};

function startListeningForNewPairs(chatId) {
  runListener();
  newPairEmitter.on('newPair', (tokenData) => {
      const message = `🆕 New Pair Detected!\n🪙 Name: ${tokenData.name}\n📝 Symbol: ${tokenData.symbol}\n🌐 Liquidity: ${tokenData.liquidity}\n Website: ${tokenData.web}\n🐦 Twitter: ${tokenData.twitter}\n📱 Telegram: ${tokenData.telegram}`;
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
    case "close":
      try {
        let text = "";
        await bot.deleteMessage(msg.chat.id, messageId);
      } catch (error) {
        console.error('Failed to "fade" message:', error);
      }
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
    `🔑 *Wallet Address:*\n\`${publicKey.toString()}\`\n\n\n`+
    `💰 *Balance:* \`${solBalance.toFixed(6)} SOL\`\n\n\n`+
    `🔍 [View on Solscan](https://solscan.io/account/${publicKey.toString()})`;

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
  bot.sendMessage(msg.chat.id, "🧙 Welcome to the Solana Wizard bot! 🪄 ");
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
  let tokenAddress = String(match[1]); 
  const tokenDetailsMessage = await fetchTokenDetails(tokenAddress);
  bot.sendMessage(chatId, tokenDetailsMessage);
});


bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  // Handle input for address and amount
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
});

// Handling callback queries for the help screen
bot.on("callback_query", async (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;

  if (data === 'close_help') {
    // Close the help message or remove the keyboard
    await bot.deleteMessage(chatId, callbackQuery.message.message_id);
  }
  // Other callback data handling...
});

async function handleBuy(chatId) {
  bot.sendMessage(chatId, "🧙 Paste a token contract address to buy a token." + String.fromCodePoint(0x21C4));
}

async function handleSell(chatId) {
  // Implement your selling logic here
  console.log(`Handling sell for chatId: ${chatId}`);
  // Example: bot.sendMessage(chatId, "Selling...");
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
        [Buffer.from('metadata'),  METAPLEX_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        METAPLEX_PROGRAM_ID
      );
      resolve(pdaAddress);
    });
    return pda;
  } catch (error) {
    console.error('Error in getMetadataPDA:', error);
    // Include more details in the thrown error if the initial validation fails
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
      `Token Details Found:`,
      `Name: ${metadata.name}`,
      `Symbol: ${metadata.symbol}`,
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
