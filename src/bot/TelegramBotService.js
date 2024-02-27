const TelegramBot = require('node-telegram-bot-api');
//const token = process.env.TELEGRAM_BOT_TOKEN;
const token = '6820995483:AAGHg_jkICyGlzDBy0kAoWgcZPUzQmWhuxo';
const bot = new TelegramBot(token, { polling: true });

module.exports = bot;
