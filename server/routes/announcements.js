// server/routes/announcements.js
const express = require('express');
const router = express.Router();
const announcementModel = require('../models/announcementModel');
const studentModel = require('../models/studentModel');
const authMiddleware = require('../utils/authMiddleware');

router.use(authMiddleware);

// POST /api/announcements — mentor creates announcement
router.post('/', async (req, res) => {
    try {
        const { title, message, target, recipientDiscords } = req.body;
        if (!title || !message || !target) {
            return res.status(400).json({ error: 'title, message, and target are required' });
        }

        let recipients = [];
        if (target === 'selected' && Array.isArray(recipientDiscords) && recipientDiscords.length > 0) {
            // Fetch full student info to get names
            const allStudents = await studentModel.getStudents(req.user.id);
            recipients = allStudents.filter(s => recipientDiscords.includes(s.discord));
        }

        const ann = await announcementModel.createAnnouncement({
            mentorId: req.user.id,
            mentorName: req.user.username,
            title,
            message,
            target,
            recipients
        });

        // Send Discord DMs — only to verified students
        const discordClient = req.discordClient;
        if (discordClient && discordClient.isReady()) {
            let targetStudents = target === 'all'
                ? await studentModel.getStudents(req.user.id)
                : recipients;

            // Only DM verified students
            targetStudents = targetStudents.filter(s => s.discord_verified);

            const userModel = require('../models/userModel');
            const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
            const senderInfo = await userModel.findUserById(req.user.id);
            let authorIcon = 'https://cdn.discordapp.com/embed/avatars/0.png';
            const files = [];

            if (senderInfo?.avatar_url) {
                if (senderInfo.avatar_url.startsWith('data:image')) {
                    const base64Data = senderInfo.avatar_url.split(',')[1];
                    const buffer = Buffer.from(base64Data, 'base64');
                    const attachment = new AttachmentBuilder(buffer, { name: 'avatar.png' });
                    files.push(attachment);
                    authorIcon = 'attachment://avatar.png';
                } else if (senderInfo.avatar_url.startsWith('http')) {
                    authorIcon = senderInfo.avatar_url;
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`📢 ${title}`)
                .setDescription(message)
                .setAuthor({
                    name: req.user.username || 'Admin',
                    iconURL: authorIcon
                })
                .setTimestamp();

            for (const student of targetStudents) {
                if (!student.discord) continue;
                try {
                    const guilds = discordClient.guilds.cache;
                    let sent = false;
                    for (const guild of guilds.values()) {
                        if (sent) break;
                        const results = await guild.members.search({ query: student.discord, limit: 10 }).catch(() => []);
                        const member = results.find(m =>
                            m.user.username.toLowerCase() === student.discord.toLowerCase() ||
                            m.user.tag?.toLowerCase() === student.discord.toLowerCase() ||
                            m.user.globalName?.toLowerCase() === student.discord.toLowerCase()
                        );
                        if (member) { 
                            await member.send({ 
                                embeds: [embed],
                                files: files.length > 0 ? files : undefined
                            }).catch(() => { }); 
                            sent = true; 
                        }
                    }
                } catch (e) {
                    console.error(`Discord DM failed for ${student.discord}:`, e.message);
                }
            }
        }

        res.json(ann);
    } catch (err) {
        console.error('Create announcement error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/announcements — mentor gets all, student gets their own
router.get('/', async (req, res) => {
    try {
        if (req.user.role === 'mentor' || req.user.role === 'admin') {
            const data = await announcementModel.getAllAnnouncements();
            return res.json(data);
        }
        // Student: get by discordId
        const discordId = req.user.discordId || '';
        const data = await announcementModel.getAnnouncementsForStudent(discordId);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/announcements/:id — mentor deletes their announcement
router.delete('/:id', async (req, res) => {
    try {
        await announcementModel.deleteAnnouncement(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/announcements/notify-groups — creates sessions + sends personalized group notifications
router.post('/notify-groups', async (req, res) => {
    try {
        const { groups, topicIds, groupTimes, scheduledDates } = req.body;
        if (!Array.isArray(groups) || groups.length === 0) {
            return res.status(400).json({ error: 'groups array is required' });
        }

        const mentorId = req.user.id;
        const mentorName = req.user.username;
        const sessionModel = require('../models/sessionModel');
        const createdSessions = [];

        console.log('[notify-groups] Received scheduledDates:', JSON.stringify(scheduledDates));
        console.log('[notify-groups] Received groupTimes:', JSON.stringify(groupTimes));

        for (let gi = 0; gi < groups.length; gi++) {
            const group = groups[gi];
            if (!group.students || group.students.length === 0) continue;

            // Retrieve the time and date for this group (if any)
            const scheduledTime = (groupTimes && groupTimes[gi]) ? groupTimes[gi] : null;
            const scheduledDate = (scheduledDates && scheduledDates[gi]) ? scheduledDates[gi] : null;

            console.log(`[notify-groups] Group ${gi}: scheduledTime=${scheduledTime}, scheduledDate=${scheduledDate}`);

            // 1. Create a PLD session for this group
            let session = null;
            if (Array.isArray(topicIds) && topicIds.length > 0) {
                try {
                    session = await sessionModel.createSession(
                        mentorId,
                        group.name,
                        group.students,
                        topicIds,
                        null,           // customDate
                        scheduledTime,  // scheduledTime (kept for DM text, not stored in DB)
                        scheduledDate,  // scheduledDate -> stored as scheduled_date
                        group.major || 'General'  // sessionMajor
                    );
                    createdSessions.push(session);
                    console.log(`[notify-groups] Session created: ${session.id}, scheduled_date=${session.scheduled_date}`);
                } catch (e) {
                    console.error(`Session creation failed for ${group.name}:`, e.message);
                }
            }
            // NOTE: Announcements and Discord DMs are handled by the cron job
            // 5 minutes before the scheduled session time
        } // End of groups loop

        const totalStudents = groups.reduce((sum, g) => sum + (g.students ? g.students.length : 0), 0);
        res.json({
            success: true,
            sessions: createdSessions.length,
            notified: totalStudents
        });

    } catch (err) {
        console.error('Notify groups error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
