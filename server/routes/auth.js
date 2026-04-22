// server/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

console.log('[AUTH ROUTER] Initializing auth routes...');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);
router.post('/discord/callback', authController.discordCallback);

module.exports = router;
