// server/routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../utils/authMiddleware');
const { requireRole } = require('../utils/authzMiddleware');

router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/users', adminController.getUsers);
router.delete('/users/:id', adminController.removeUser);

module.exports = router;
