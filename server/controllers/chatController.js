// server/controllers/chatController.js
const chatModel = require('../models/chatModel');
const sessionModel = require('../models/sessionModel');

const getHistory = async (req, res) => {
    try {
        const { sessionId, studentId } = req.query;
        if (!sessionId || !studentId) {
            return res.status(400).json({ error: 'Session ID and Student ID are required' });
        }
        const history = await chatModel.getChatHistory(sessionId, studentId);
        res.json(history);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
};

const saveMessage = async (req, res) => {
    try {
        const { sessionId, studentId, role, content } = req.body;

        if (!sessionId || !studentId || !role || !content) {
            return res.status(400).json({ error: 'Session ID, Student ID, Role, and Content are required' });
        }

        const message = await chatModel.addMessage(sessionId, studentId, role, content);
        res.json({ success: true, message });

    } catch (error) {
        console.error('Error saving chat message:', error);
        res.status(500).json({ error: 'Failed to save chat message' });
    }
};

module.exports = { getHistory, saveMessage };
