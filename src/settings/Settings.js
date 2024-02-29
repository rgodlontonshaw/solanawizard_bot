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
  
        // Save the message ID of the settings message
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
            [{ text: `Show Birdseye Preview: ${this.settings.showBirdEyePreview ? '✅ ON' : '❌ OFF'}`, callback_data: 'toggle_birdseye_preview' }],
            //
        ];
    }
  
    async handleButtonPress(action) {
        // Toggling settings based on the action
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
            // ... other toggles
        }

        // Call a method to update the inline keyboard
        await this.updateSettingsKeyboard();
    }

    async updateSettingsKeyboard() {
        if (this.settingsMessageId === null) {
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

        // Edit the message with the new keyboard
        await this.bot.editMessageReplyMarkup(options.reply_markup, { chat_id: options.chat_id, message_id: options.message_id });
    }
}

module.exports = SettingsScreen;
