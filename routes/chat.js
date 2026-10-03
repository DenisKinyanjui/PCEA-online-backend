const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { sendChatMessage } = require('../controllers/chatController');

// Public and unauthenticated, and every message costs a MiMo call —
// keep the per-visitor limit tight.
const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: { success: false, message: "You're sending messages quickly. Please wait a few minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', chatLimiter, sendChatMessage);

module.exports = router;
