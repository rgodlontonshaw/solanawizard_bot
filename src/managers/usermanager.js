class UserStateManagement {
    constructor() {
      this.chatStates = {};
      this.transferStates = {};
    }
  
    setChatState(chatId, state) {
      this.chatStates[chatId] = state;
    }
  
    getChatState(chatId) {
      return this.chatStates[chatId];
    }
  
    // Similar methods for transferStates
}
module.exports = UserStateManagement;  