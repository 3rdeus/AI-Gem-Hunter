/**
 * Test Telegram Bot API Endpoint
 * Sends test messages to verify bot is working
 */

import { sendTestMessage } from '../lib/telegram-bot.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('Sending test message to Telegram...');
    
    const result = await sendTestMessage();
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Test message sent successfully!',
        messageId: result.messageId,
        chatId: process.env.TELEGRAM_CHAT_ID
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to send test message'
      });
    }
  } catch (error) {
    console.error('Test telegram error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
