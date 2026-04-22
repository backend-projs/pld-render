const userModel = require('../models/userModel');
const sessionModel = require('../models/sessionModel');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

exports.createSession = async (req, res) => {
    try {
        const { groupName, students, topicIds, customQuestions, createdAt, scheduledTime, major } = req.body; 

        if (!groupName) {
            return res.status(400).json({ error: 'Missing required fields (Group Name)' });
        }

        const hasTopics = Array.isArray(topicIds) && topicIds.length > 0;
        const hasCustom = Array.isArray(customQuestions) && customQuestions.length > 0;

        if (!hasTopics && !hasCustom) {
            return res.status(400).json({ error: 'Missing Topics or Custom Questions' });
        }

        const sessionMajor = major || 'General';

        // Custom questions passed as the last argument
        const session = await sessionModel.createSession(req.user.id, groupName, students || [], topicIds || [], createdAt, scheduledTime, createdAt, sessionMajor, customQuestions || []);
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getMySessions = async (req, res) => {
    try {
        console.log(`[getMySessions] User requesting: ${req.user.username} (${req.user.role})`);
        let sessions;
        if (req.user.role === 'student') {
            const fullUser = await userModel.findUserById(req.user.id);
            if (!fullUser || !fullUser.discordId) {
                return res.json([]);
            }
            sessions = await sessionModel.getSessionsForStudent(fullUser.discordId);
        } else {
            const fullUser = await userModel.findUserById(req.user.id);
            // Split the comma-separated majors, trim whitespace, filter out empty strings
            const rawMajors = fullUser?.major || 'Undeclared';
            const mentorMajors = rawMajors.split(',').map(m => m.trim()).filter(Boolean);

            sessions = await sessionModel.getSessionsByMentor(req.user.id, mentorMajors);
        }
        res.json(sessions);
    } catch (err) {
        console.error('[getMySessions] Error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getJoinableSessions = async (req, res) => {
    try {
        const fullUser = await userModel.findUserById(req.user.id);
        if (!fullUser || !fullUser.discordId) {
            return res.json([]);
        }
        const sessions = await sessionModel.getJoinableSessions(fullUser.discordId);
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.joinSession = async (req, res) => {
    try {
        const { id } = req.params;
        const fullUser = await userModel.findUserById(req.user.id);

        if (!fullUser || !fullUser.discordId) {
            return res.status(400).json({ error: 'Please link your Discord account in your profile first.' });
        }

        const studentData = {
            name: fullUser.fullName || fullUser.username,
            discord: fullUser.discordId,
            major: fullUser.major || ''
        };

        const updatedSession = await sessionModel.joinSession(id, studentData);
        res.json(updatedSession);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getSession = async (req, res) => {
    try {
        const session = await sessionModel.getSessionById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        // Security Check: If student, ensure they are in this session
        if (req.user.role === 'student') {
            const isInSession = session.students.some(s => 
                s.discord === req.user.discordId || s.discord === req.user.username
            );
            if (!isInSession) {
                return res.status(403).json({ error: 'Access denied: You are not in this session.' });
            }
        }

        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateNote = async (req, res) => {
    try {
        const { sessionId, studentId } = req.params;
        const { notes } = req.body;
        const updated = await sessionModel.updateStudentNote(sessionId, studentId, notes);
        if (!updated) return res.status(404).json({ error: 'Student or Session not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateGrade = async (req, res) => {
    try {
        const { sessionId, studentId } = req.params;
        const { grade } = req.body;
        const updated = await sessionModel.updateStudentGrade(sessionId, studentId, grade);
        if (!updated) return res.status(404).json({ error: 'Student or Session not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateQuestions = async (req, res) => {
    try {
        const { sessionId, studentId } = req.params;
        const { answered, incorrect } = req.body;
        const updated = await sessionModel.updateStudentQuestions(sessionId, studentId, { answered, incorrect });
        if (!updated) return res.status(404).json({ error: 'Student or Session not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Saving AI Result - NO LONGER SENDS DM
exports.saveResult = async (req, res) => {
    try {
        const { sessionId, studentId } = req.params;
        const { result } = req.body;
        const updated = await sessionModel.updateStudentResult(sessionId, studentId, result);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.endSession = async (req, res) => {
    try {
        const { id } = req.params;
        await sessionModel.completeSession(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteSession = async (req, res) => {
    try {
        const { id } = req.params;
        await sessionModel.deleteSession(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateSession = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const updated = await sessionModel.updateSession(id, updateData);
        res.json(updated);
    } catch (err) {
        console.error('Error in updateSession:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.removeStudent = async (req, res) => {
    try {
        const { sessionId, studentId } = req.params;
        const updatedSession = await sessionModel.removeStudentFromSession(sessionId, studentId);
        if (!updatedSession) {
            return res.status(404).json({ error: 'Session or Student not found' });
        }
        res.json(updatedSession);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteAllSessions = async (req, res) => {
    try {
        await sessionModel.deleteAllSessions(req.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// Helper to find user and send DM
async function sendDiscordDM(discordClient, username, message) {
    if (!discordClient || !process.env.DISCORD_TOKEN) {
        console.log(`[Demo] Sent DM to ${username}`);
        return { success: true, message: 'Simulated Send (No Bot Token)' };
    }

    try {
        console.log(`Attempting to find user with username: ${username}`);
        let targetUser = null;
        const guilds = discordClient.guilds.cache;

        if (!discordClient.isReady()) {
            return { success: false, error: 'Discord bot is not ready.' };
        }

        for (const [guildId, guild] of guilds) {
            try {
                const members = await guild.members.fetch({ query: username, limit: 1 });
                const member = members.find(m => 
                    m.user.username.toLowerCase() === username.toLowerCase() || 
                    (m.user.tag && m.user.tag.toLowerCase() === username.toLowerCase()) ||
                    (m.user.globalName && m.user.globalName.toLowerCase() === username.toLowerCase())
                );
                if (member) {
                    targetUser = member.user;
                    break;
                }
            } catch (err) {
                console.error(`Error fetching members in guild ${guild.name}:`, err);
            }
        }

        if (!targetUser) {
            console.log(`User ${username} not found in any common guild.`);
            return { success: false, error: `User '${username}' not found in bot servers.` };
        }

        console.log(`Found user: ${targetUser.tag}, sending DM...`);
        
        const messagePayload = {};
        if (typeof message === 'object') {
            if (message.embeds) messagePayload.embeds = message.embeds;
            if (message.files) messagePayload.files = message.files;
            if (message.content) messagePayload.content = message.content;
        } else {
            messagePayload.content = message;
        }

        console.log(`[Discord] Sending payload with ${messagePayload.files?.length || 0} files and ${messagePayload.embeds?.length || 0} embeds`);
        await targetUser.send(messagePayload);
        console.log(`DM sent successfully to ${targetUser.tag}`);
        return { success: true, message: `Sent to ${username}` };

    } catch (err) {
        console.error('Failed to send DM:', err);
        return { success: false, error: `Failed to send to ${username}: ${err.message}` };
    }
}

// Explicit Endpoint for Sending DM
exports.sendFeedback = async (req, res) => {
    try {
        const { sessionId, studentId } = req.params;
        const session = await sessionModel.getSessionById(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const student = session.students.find(s => s.id === studentId);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // If absent, we shouldn't really be sending "feedback", but we might notify them of absence.
        // The toggleStatus endpoint handles absence notification.
        // This endpoint is for AI result feedback.

        if (!student.result) return res.status(400).json({ error: 'No feedback generated to send' });
        if (!student.discord) return res.status(400).json({ error: 'No Discord username provided' });

        const senderId = req.user.id === 'admin' ? (session.mentorId || session.mentor_id) : req.user.id;
        console.log(`[Discord] Looking up avatar for sender ${senderId} (current: ${req.user.id})`);
        const senderInfo = await userModel.findUserById(senderId);
        
        let authorIcon = 'https://cdn.discordapp.com/embed/avatars/0.png';
        const files = [];

        if (senderInfo?.avatar_url) {
            if (senderInfo.avatar_url.startsWith('data:image')) {
                console.log(`[Discord] Avatar is base64 for user ${senderInfo.username || req.user.username}`);
                const parts = senderInfo.avatar_url.split(',');
                if (parts.length > 1) {
                    const base64Data = parts[1];
                    const buffer = Buffer.from(base64Data, 'base64');
                    console.log(`[Discord] Created buffer of size: ${buffer.length} bytes`);
                    const attachment = new AttachmentBuilder(buffer, { name: 'avatar.png' });
                    files.push(attachment);
                    authorIcon = 'attachment://avatar.png';
                    console.log('[Discord] Attachment created and authorIcon set to attachment://avatar.png');
                } else {
                    console.log('[Discord] Invalid base64 format in avatar_url');
                }
            } else if (senderInfo.avatar_url.startsWith('http')) {
                console.log('[Discord] Avatar is external URL');
                authorIcon = senderInfo.avatar_url;
            }
        } else {
            console.log('[Discord] No avatar_url found for sender');
        }

        const embed = new EmbedBuilder()
            .setColor('#2ecc71') // Emerald Green
            .setTitle('📝 PLD Performance Report')
            .setAuthor({
                name: req.user.username || 'Admin',
                iconURL: authorIcon
            })
            .setDescription(student.result)
            .setTimestamp();

        if (student.grade) {
            embed.addFields({ name: 'Grade', value: `**${student.grade}/5**`, inline: true });
        }

        const result = await sendDiscordDM(req.discordClient, student.discord, { 
            embeds: [embed],
            files: files.length > 0 ? files : undefined
        });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }
        res.json(result);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        const { sessionId, studentId } = req.params;
        const { status } = req.body; // 'present' or 'absent'

        const updatedStudent = await sessionModel.updateStudentStatus(sessionId, studentId, status);
        if (!updatedStudent) return res.status(404).json({ error: 'Student or session not found' });

        // Notification is now deferred to "Send All"

        res.json(updatedStudent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Validates and sends to ALL students
exports.sendAllFeedback = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await sessionModel.getSessionById(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const results = [];
        console.log(`[Batch Send] Starting batch for session ${sessionId}`);

        const senderId = req.user.id === 'admin' ? (session.mentorId || session.mentor_id) : req.user.id;
        const senderInfo = await userModel.findUserById(senderId);
        let authorIcon = 'https://cdn.discordapp.com/embed/avatars/0.png';
        const files = [];

        if (senderInfo?.avatar_url) {
            if (senderInfo.avatar_url.startsWith('data:image')) {
                const parts = senderInfo.avatar_url.split(',');
                if (parts.length > 1) {
                    const base64Data = parts[1];
                    const buffer = Buffer.from(base64Data, 'base64');
                    const attachment = new AttachmentBuilder(buffer, { name: 'avatar.png' });
                    files.push(attachment);
                    authorIcon = 'attachment://avatar.png';
                }
            } else if (senderInfo.avatar_url.startsWith('http')) {
                authorIcon = senderInfo.avatar_url;
            }
        }

        for (const student of session.students) {
            console.log(`[Batch Send] Processing student: ${student.name}, Status: ${student.status}`);

            // Check for Absent Status
            if (student.status === 'absent') {
                if (student.discord) {
                    const absentEmbed = new EmbedBuilder()
                        .setColor('#e67e22') // Carrot Orange
                        .setTitle('⚠️ Absence Notification')
                        .setAuthor({
                            name: req.user.username || 'Admin',
                            iconURL: authorIcon
                        })
                        .setDescription(`Hello ${student.name},\n\nYou have been marked as absent for the PLD session **"${session.groupName || 'today'}"**.\nPlease note that you must use your 1 PTO for this absence.`)
                        .setFooter({ text: 'PLD Manager' })
                        .setTimestamp();

                    const result = await sendDiscordDM(req.discordClient, student.discord, { 
                        embeds: [absentEmbed],
                        files: files.length > 0 ? files : undefined
                    });
                    results.push({
                        student: student.name,
                        discord: student.discord,
                        success: result.success,
                        error: result.error,
                        type: 'absent_notification'
                    });
                } else {
                    results.push({
                        student: student.name,
                        success: false,
                        error: 'Absent but no Discord username',
                        type: 'absent_notification'
                    });
                }
                continue; // Move to next student
            }

            // Normal Feedback Logic for Present Students
            if (student.result && student.discord) {
                const feedbackEmbed = new EmbedBuilder()
                    .setColor('#2ecc71') // Emerald Green
                    .setTitle('📝 PLD Performance Report')
                    .setAuthor({
                        name: req.user.username || 'Admin',
                        iconURL: authorIcon
                    })
                    .setDescription(student.result)
                    .setTimestamp();

                if (student.grade) {
                    feedbackEmbed.addFields({ name: 'Grade', value: `**${student.grade}/5**`, inline: true });
                }

                const result = await sendDiscordDM(req.discordClient, student.discord, { 
                    embeds: [feedbackEmbed],
                    files: files.length > 0 ? files : undefined
                });
                results.push({
                    student: student.name,
                    discord: student.discord,
                    success: result.success,
                    error: result.error,
                    type: 'feedback'
                });
            } else {
                results.push({
                    student: student.name,
                    success: false,
                    error: 'Missing result or discord username',
                    type: 'feedback'
                });
            }
        }

        res.json({ summary: results });

    } catch (err) {
        console.error('[Batch Send] Error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const major = req.query.major || null;
        const leaderboard = await sessionModel.getLeaderboard(major);
        res.json(leaderboard);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.submitCode = async (req, res) => {
    try {
        const { sessionId, studentId } = req.params;
        const { code, language, feedback, questionIndex, output } = req.body;

        const session = await sessionModel.getSessionById(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const student = session.students.find(s => s.id === studentId);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // Store the submission for this specific question
        const updatedStudent = await sessionModel.updateStudentSubmission(sessionId, studentId, questionIndex ?? 0, {
            code,
            language,
            output,
            feedback
        });

        res.json({ success: true, feedback: feedback, student: updatedStudent });
    } catch (err) {
        console.error('Error in submitCode:', err);
        res.status(500).json({ error: 'Failed to save code submission: ' + err.message });
    }
};

exports.toggleStudentWorkshopPermission = async (req, res) => {
    try {
        const { sessionId, studentId } = req.params;
        const { hasWorkshopPermission } = req.body;
        
        const updatedStudent = await sessionModel.toggleStudentWorkshopPermission(sessionId, studentId, hasWorkshopPermission);
        if (!updatedStudent) {
            return res.status(404).json({ error: 'Student or session not found' });
        }
        res.json(updatedStudent);
    } catch (err) {
        console.error('Error in toggleStudentWorkshopPermission:', err);
        res.status(500).json({ error: 'Failed to toggle permission: ' + err.message });
    }
};

exports.addStudent = async (req, res) => {
    try {
        const { id } = req.params; // Session ID
        const { identifier } = req.body; // Username or Discord ID
        
        if (!identifier) return res.status(400).json({ error: 'Missing identifier' });

        // 1. Find user in database
        let studentUser = await userModel.findUserByUsername(identifier);
        if (!studentUser) {
            studentUser = await userModel.findUserByDiscordId(identifier);
        }

        if (!studentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (studentUser.role !== 'student') {
            return res.status(400).json({ error: 'Only student users can be added.' });
        }

        // 2. Add to session
        const studentData = {
            name: studentUser.fullName || studentUser.username,
            discord: studentUser.discordId,
            major: studentUser.major || ''
        };

        const updatedSession = await sessionModel.addStudentToSession(id, studentData);
        res.json(updatedSession);
    } catch (err) {
        console.error('Error adding student:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.updateWorkshopCode = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, language, questionIndex, lastEditPos } = req.body;
        
        // Security: only mentor or students with permission can update
        const session = await sessionModel.getSessionById(id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const isMentor = req.user.role === 'mentor' && (session.mentorId === req.user.id || session.mentor_id === req.user.id);
        const student = session.students?.find(s => s.discord === req.user.discordId || s.discord === req.user.username);
        const hasPermission = student?.hasWorkshopPermission === true;

        if (!isMentor && !hasPermission) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to edit this workshop.' });
        }

        let updatedByName = req.user.username; // fallback
        const userRecord = await userModel.findUserById(req.user.id);
        if (userRecord && userRecord.firstName) {
            updatedByName = `${userRecord.firstName} ${userRecord.lastName}`.trim();
        } else if (userRecord) {
            updatedByName = userRecord.username;
        }

        const updated = await sessionModel.updateWorkshopCode(id, {
            code,
            language,
            questionIndex,
            updatedBy: req.user.id,
            updatedByName,
            lastEditPos
        });

        res.json(updated);
    } catch (err) {
        console.error('Error in updateWorkshopCode:', err);
        res.status(500).json({ error: err.message });
    }
};
