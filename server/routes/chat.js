// server/routes/chat.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../utils/authMiddleware');
const { requireChatAccess } = require('../utils/authzMiddleware');

router.use(authMiddleware);

router.get('/history', requireChatAccess, chatController.getHistory);
router.post('/save', requireChatAccess, chatController.saveMessage);

module.exports = router;
