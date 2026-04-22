// server/routes/students.js
const express = require('express');
const router = express.Router();
const studentModel = require('../models/studentModel');
const userModel = require('../models/userModel');
const authMiddleware = require('../utils/authMiddleware');

router.use(authMiddleware);

/**
 * Check if a discord username is present in any guild the bot is in.
 * Returns true if found (student is in the server), false otherwise.
 */
async function checkDiscordMembership(discordClient, discordUsername) {
    if (!discordUsername || !discordClient || !discordClient.isReady()) return false;
    try {
        const name = discordUsername.toLowerCase();
        for (const guild of discordClient.guilds.cache.values()) {
            const results = await guild.members.search({ query: discordUsername, limit: 10 }).catch(() => []);
            const found = results.find(m =>
                m.user.username.toLowerCase() === name ||
                m.user.tag?.toLowerCase() === name ||
                m.user.globalName?.toLowerCase() === name
            );
            if (found) return true;
        }
    } catch (e) {
        console.error(`[Discord] Membership check failed for ${discordUsername}:`, e.message);
    }
    return false;
}

router.get('/', async (req, res) => {
    try {
        const students = await studentModel.getStudents(req.user.id);

        // Send response immediately so the page doesn't hang
        res.json(students);

        // Auto-verify anyone who is still unverified but has joined the Discord server in the background
        students.forEach(async (student) => {
            if (student.discord && !student.discord_verified) {
                try {
                    const isInServer = await checkDiscordMembership(req.discordClient, student.discord);
                    if (isInServer) {
                        await studentModel.updateStudent(student.id, { discord_verified: true });
                    }
                } catch (e) {
                    console.error("Auto-verify background update error:", e);
                }
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST / — add a single student and auto-verify via Discord bot
router.post('/', async (req, res) => {
    try {
        const { name, discord, major } = req.body;
        const student = await studentModel.addStudent(req.user.id, name, discord, major);

        // Auto-verify: check Discord membership immediately
        if (student && discord) {
            const isInServer = await checkDiscordMembership(req.discordClient, discord);
            if (isInServer && !student.discord_verified) {
                const updated = await studentModel.updateStudent(student.id, { discord_verified: true });
                return res.json(updated);
            }
        }

        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /bulk — bulk add students and auto-verify via Discord bot
router.post('/bulk', async (req, res) => {
    try {
        const { students } = req.body;
        if (!Array.isArray(students)) {
            return res.status(400).json({ error: 'Data must be an array of students' });
        }
        const created = await studentModel.bulkAddStudents(req.user.id, students);

        // Auto-verify: check Discord membership for each student (in parallel, max 5 at a time)
        const results = [];
        const batchSize = 5;
        for (let i = 0; i < created.length; i += batchSize) {
            const batch = created.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(async (student) => {
                if (!student.discord) return student;
                const isInServer = await checkDiscordMembership(req.discordClient, student.discord);
                if (isInServer) {
                    return await studentModel.updateStudent(student.id, { discord_verified: true }).catch(() => student);
                }
                return student;
            }));
            results.push(...batchResults);
        }

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const student = await studentModel.updateStudent(req.params.id, req.body);
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/all', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No student IDs provided' });
        }
        await studentModel.deleteAllStudents(ids);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await studentModel.deleteStudent(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
