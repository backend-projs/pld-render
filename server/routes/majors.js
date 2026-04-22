// server/routes/majors.js
const express = require('express');
const router = express.Router();
const majorModel = require('../models/majorModel');
const authMiddleware = require('../utils/authMiddleware');

router.get('/', async (req, res) => {
    try {
        const majors = await majorModel.getMajors();
        res.json(majors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Major name is required' });

        // Admin check could go here if we had robust roles, but we'll accept it for now
        const major = await majorModel.addMajor(name);
        res.json(major);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await majorModel.deleteMajor(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
