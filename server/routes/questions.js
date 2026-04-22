// server/routes/questions.js
const express = require('express');
const router = express.Router();
const questionModel = require('../models/questionModel');
const authMiddleware = require('../utils/authMiddleware');

router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        const sets = await questionModel.getQuestionSets(req.user.id);
        res.json(sets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { topic, questions, major } = req.body;
        if (!topic || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'Topic and questions array are required' });
        }
        const set = await questionModel.addQuestionSet(req.user.id, topic, questions, major);
        res.json(set);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const set = await questionModel.updateQuestionSet(req.params.id, req.body);
        res.json(set);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/share', async (req, res) => {
    try {
        const { targetMentorIds } = req.body;
        if (!Array.isArray(targetMentorIds)) {
            return res.status(400).json({ error: 'targetMentorIds must be an array' });
        }
        const set = await questionModel.shareQuestionSet(req.params.id, req.user.id, targetMentorIds);
        res.json(set);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/all', async (req, res) => {
    try {
        await questionModel.deleteAllQuestionSets(req.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await questionModel.deleteQuestionSet(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
