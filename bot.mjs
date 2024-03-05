import {SolanaService} from './src/solana/SolanaService.mjs';
import { KeyboardLayouts } from './src/ui/KeyboardLayouts.mjs';
import solanaWeb3 from '@solana/web3.js';
import { transferSOL } from './src/transactions/solanaTransactions.mjs';
import { SettingsScreen } from './src/settings/Settings.mjs';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import TelegramBot from 'node-telegram-bot-api';
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
// Importing the entire module as NewPairFetcherModule to access its exported members
import * as NewPairFetcherModule from './src/services/NewPairFetcher.mjs';

let transferState = {};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString(); 
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

  if (data.startsWith('toggle_') || data.startsWith('set_')) {
    const settingsScreen = new SettingsScreen(bot, chatId);
    await settingsScreen.handleButtonPress(data);
    return; // Stop further processing since we handled the settings action
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
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, "Starting to fetch new Solana token pairs...");
    
      try {
        // Using the NewPairFetcherModule to access the getNewPairs function
        const newPairs = await NewPairFetcherModule.getNewPairs(); 
        newPairs.forEach(pair => {
          const message = `🆕 New Pair Detected!\n🪙 Name: ${pair.name}\n📝 Address: ${pair.address}\n💹 Volume: ${pair.volume}`;
          bot.sendMessage(chatId, message);
        });
      } catch (error) {
        console.error('Failed to fetch new pairs:', error);
        bot.sendMessage(chatId, "Failed to fetch new pairs. Please try again later.");
      }
    
      break;
    case 'referral_system':
      // Implement Referral System functionality
      bot.sendMessage(chatId, 'Referral System functionality will be implemented soon.');
      break;
    case 'settings':
      if (data.startsWith('toggle_') || data.startsWith('set_')) {
        const settingsScreen = new SettingsScreen(bot, chatId);
        await settingsScreen.handleButtonPress(data);
        return; // Stop further processing since we handled the settings action
      };
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
