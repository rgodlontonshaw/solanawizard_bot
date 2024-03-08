class SettingsScreen {
    constructor(bot, chatId) {
        this.bot = bot;
        this.chatId = chatId;
        this.settingsMessageId = null; // This will store the settings message id
        this.settings = {
            autoBuy: false,
            autoSell: false,
            antiMEV: true,
            slippageBuySell: 50,
            slippageSniper: 1200,
            tipSOL: 0.0008,
            wsolSnipe: false,
            showBirdEyePreview: false
        };
    }
  
    async showSettings() {
        const options = {
            reply_markup: JSON.stringify({
                inline_keyboard: this.generateInlineKeyboard()
            })
        };
  
        const sentMessage = await this.bot.sendMessage(this.chatId, "Settings:", options);
        this.settingsMessageId = sentMessage.message_id;
    }
  
    generateInlineKeyboard() {
        return [
            [{ text: `Auto Buy: ${this.settings.autoBuy ? '✅ Active - 0.1 SOL' : '❌ Inactive'}`, callback_data: 'toggle_auto_buy' }],
            [{ text: `Auto Sell: ${this.settings.autoSell ? '✅ Active - 30%' : '❌ Inactive'}`, callback_data: 'toggle_auto_sell' }],
            [{ text: `ANTI-MEV: ${this.settings.antiMEV ? '✅ ON - 50%' : '❌ OFF'}`, callback_data: 'toggle_anti_mev' }],
            [{ text: `WSOL Snipe: ${this.settings.wsolSnipe ? '✅ ON - 1200%' : '❌ OFF'}`, callback_data: 'toggle_wsol_snipe' }],
            [{ text: `Slippage Buy/Sell: ${this.settings.slippageBuySell}%`, callback_data: 'set_slippage_buy_sell' }],
            [{ text: `Slippage Sniper: ${this.settings.slippageSniper}%`, callback_data: 'set_slippage_sniper' }],
            [{ text: `Tip SOL: ${this.settings.tipSOL}`, callback_data: 'set_tip_sol' }],
            [{ text: '💼  Delete Wallet', callback_data: 'delete_wallet' },{ text: 'ℹ️ Help', callback_data: 'help' }],
            [{ text: `Show Birdseye Preview: ${this.settings.showBirdEyePreview ? '✅ ON' : '❌ OFF'}`, callback_data: 'toggle_birdseye_preview' }],
        ];
    }
  
    async handleButtonPress(action) {
        switch (action) {
            case 'toggle_auto_buy':
                this.settings.autoBuy = !this.settings.autoBuy;
                break;
            case 'toggle_auto_sell':
                this.settings.autoSell = !this.settings.autoSell;
                break;
            case 'toggle_anti_mev':
                this.settings.antiMEV = !this.settings.antiMEV;
                break;
            case 'toggle_wsol_snipe':
                this.settings.wsolSnipe = !this.settings.wsolSnipe;
                break;
            case 'toggle_birdseye_preview':
                this.settings.showBirdEyePreview = !this.settings.showBirdEyePreview;
                break;
            case 'set_slippage_buy_sell':
                // Assume logic to set slippage for buy/sell is implemented elsewhere
                break;
            case 'set_slippage_sniper':
                // Assume logic to set sniper slippage is implemented elsewhere
                break;
            case 'set_tip_sol':
                // Assume logic to set tip SOL is implemented elsewhere
                break;
            // Additional cases for other settings as needed
        }

        await this.updateSettingsKeyboard();
    }

    async updateSettingsKeyboard() {
        if (!this.settingsMessageId) {
            console.error('Settings message ID not set. Cannot update the message.');
            return;
        }

        const options = {
            chat_id: this.chatId,
            message_id: this.settingsMessageId,
            reply_markup: JSON.stringify({
                inline_keyboard: this.generateInlineKeyboard()
            })
        };

        await this.bot.editMessageReplyMarkup(options.reply_markup, { chat_id: options.chat_id, message_id: options.message_id });
    }
}

module.exports = SettingsScreen;
