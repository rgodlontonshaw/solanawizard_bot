
const moment = require('moment');

const TelegramBot = require('node-telegram-bot-api');
const NewPairFetcher = require('./src/api/NewPairFetcher');

const pairFetcher = new NewPairFetcher(process.env.DEXTOOLS_API_KEY);


// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with the actual token you received from BotFather
//const token = process.env.TELEGRAM_BOT_TOKEN;
const token = process.env.TELEGRAM_BOT_TOKEN;

// Create a bot instance that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });
// This function creates an inline keyboard layout for the start menu
function getStartMenuKeyboard() {
  return {
      reply_markup: JSON.stringify({
          inline_keyboard: [
              [{ text: 'Buy & Sell', callback_data: 'buy_sell' }],
              [{ text: 'Token Sniper', callback_data: 'token_sniper' }],
              [{ text: 'Market Maker Bot', callback_data: 'market_maker' }],
              [{ text: 'Profile', callback_data: 'profile' }],
              [{ text: 'Wallets', callback_data: 'wallets' }],
              [{ text: 'Trades', callback_data: 'trades' }],
              [{ text: 'Copy Trades', callback_data: 'copy_trades' }],
              [{ text: 'Referral System', callback_data: 'referral_system' }],
              [{ text: 'Transfer SOL', callback_data: 'transfer_sol' }],
              [{ text: 'Settings', callback_data: 'settings' }],
              [{ text: 'New Pair Bot', callback_data: 'new_pair_bot' }],
              [{ text: 'New Token Bot', callback_data: 'new_token_bot' }],
              [{ text: 'Help', callback_data: 'help' }],
              [{ text: 'Close', callback_data: 'close' }],
          ],
      }),
  };
}

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `SolTradingBot: Your Gateway to Solana DeFi\n\n` +
                         `SOL: $103.45\n\n` +
                         `Your First Wallet\n` +
                         `AhQiBepj6UK36VDwutwnHRpt7NnFWF73RA5Go1zkC3EW\n` +
                         `Balance: 0.46394658 SOL\n\n` +
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





bot.onText(/\/new/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Starting to fetch new Solana token pairs...");

  // Start the polling process within the NewPairFetcher class
  pairFetcher.startPolling();

  // Optionally, you can listen for new pairs from the NewPairFetcher and send updates to the chat
  // This requires NewPairFetcher to have some event emitter for new pairs
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