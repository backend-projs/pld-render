// server/routes/users.js
const express = require('express');
const router = express.Router();
const userModel = require('../models/userModel');
const authMiddleware = require('../utils/authMiddleware');

router.use(authMiddleware);

router.get('/mentors', async (req, res) => {
    try {
        const mentors = await userModel.getMentors();
        res.json(mentors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin only routes (Ideally protected, but relying on authMiddleware atm)
router.get('/admin', async (req, res) => {
    try {
        const users = await userModel.getAllUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/admin/:id', async (req, res) => {
    try {
        await userModel.deleteUser(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
