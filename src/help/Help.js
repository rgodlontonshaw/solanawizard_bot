class HelpScreen {
  constructor(bot, chatId) {
    this.bot = bot;
    this.chatId = chatId;
  }

  async showHelp() {
    const helpMessage = 
      `*Help:*\n\n` +
      `*Which tokens can I trade?*\n` +
      `Any SPL token that is a Sol pair, on Raydium, Orca, and Jupiter. We pick up raydium pairs instantly, and Jupiter will pick up non sol pairs within around 15 minutes.\n\n` +
      `*How can I see how much money I've made from referrals?*\n` +
      `Check the referrals button or type /referrals to see your payment in Bonk!\n\n` +
      `*I want to create a new wallet on Solana Wizard Bot.*\n` +
      `Click the Wallet button or type /wallet, and you will be able to configure your new wallets.\n\n` +
      `*Is Sol Wizard bot free? How much do i pay for transactions?*\n` +
      `Sol Wizard bot is completely free! We charge 1% on transactions, and keep the bot free so that anyone can use it. We also charge a fee of 0.5 Sol a month for premium trading strategies and volume alerts on secured tokens with certain security checks for more serious and advanced traders.\n\n` +
      `*Why is My Net Profit Lower Than Expected?*\n` +
      `Your Net Profit is calculated after deducting all associated costs, including Price Impact, Transfer Tax, Dex Fees, and a 1% Solana Wizard bot fee. This ensures the figure you see is what you actually receive, accounting for all transaction-related expenses.\n\n` +
      `*Is there a difference between @solanawizardbot and the other Solana trading bots?*\n` +
      `Yes, our bot does trading for you with certain strategies.\n\n` +
      `Further questions? Join our Telegram group: https://t.me/SolWizardBotAlpha`;

    const options = {
      parse_mode: 'Markdown',
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: 'Close', callback_data: 'close_help' }]
        ]
      })
    };

    await this.bot.sendMessage(this.chatId, helpMessage, options);
  }
}

module.exports = HelpScreen;
