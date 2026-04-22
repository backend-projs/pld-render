// server/routes/profile.js
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../utils/authMiddleware');

router.use(authMiddleware);

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.put('/avatar', profileController.updateAvatar);
router.put('/change-password', profileController.changePassword);

module.exports = router;
