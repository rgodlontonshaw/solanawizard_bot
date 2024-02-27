class KeyboardLayouts {
    static getStartMenuKeyboard() {
        return {
            reply_markup: JSON.stringify({
              inline_keyboard: [
        [{ text: '🎯 Quick Snipe and Trade', callback_data: 'quick_trade_sniper' }],
        [{ text: '💼  Delete Wallet', callback_data: 'delete_wallet' }, { text: '👤 Profile', callback_data: 'profile' }],
        [{ text: '💼 Transfer Sol', callback_data: 'sol_transfer' }, { text: '🔄 Trades History', callback_data: 'trades_history' }], // Added missing comma here
        [{ text: '🔗 Referral System', callback_data: 'referral_system' }, { text: '⚙️ Settings', callback_data: 'settings' }],
        [{ text: 'ℹ️ Help', callback_data: 'help' }, { text: '❌ Close', callback_data: 'close' }]
    ],
        }),     
        };
    }
  
    static getProfileMenuKeyboard() {
        return {
            reply_markup: JSON.stringify({
              inline_keyboard: [
        [{ text: '❌ Close', callback_data: 'close' }]
    ],
        }),     
        };
    }
  }
  
  module.exports = KeyboardLayouts;