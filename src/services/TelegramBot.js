class TelegramBotInteraction {
    constructor(bot) {
      this.bot = bot;
    }
  
    sendMessage(chatId, message, options) {
      this.bot.sendMessage(chatId, message, options);
    }
  

}
module.exports = TelegramBotInteraction;