// server/cron.js
const { getSessionsToNotify, markSessionNotified } = require('./models/sessionModel');
const studentModel = require('./models/studentModel');
const { supabase } = require('./models/db');
const userModel = require('./models/userModel');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

async function sendDiscordDM(discordClient, username, message) {
    if (!discordClient || !process.env.DISCORD_TOKEN) {
        console.log(`[Cron Demo] Simulated Send to ${username}`);
        return true;
    }

    try {
        let targetUser = null;
        const guilds = discordClient.guilds.cache;

        if (!discordClient.isReady()) return false;

        for (const [guildId, guild] of guilds) {
            try {
                const members = await guild.members.fetch({ query: username, limit: 1 });
                const member = members.find(m =>
                    m.user.username.toLowerCase() === username.toLowerCase() ||
                    m.user.tag?.toLowerCase() === username.toLowerCase() ||
                    m.user.globalName?.toLowerCase() === username.toLowerCase()
                );
                if (member) {
                    targetUser = member.user;
                    break;
                }
            } catch (err) { }
        }

        if (targetUser) {
            if (typeof message === 'object' && message.embeds) {
                await targetUser.send(message);
            } else {
                await targetUser.send(message);
            }
            console.log(`[Cron] DM sent successfully to ${targetUser.tag}`);
            return true;
        }
        return false;
    } catch (err) {
        console.error('[Cron] Failed to send DM:', err.message);
        return false;
    }
}

/* ── Weekly PLD Preference Reset ──────────────────────── */
let lastResetWeek = null; // Track which ISO week we last reset

async function resetWeeklyPldPreferences() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 5=Fri
    const hour = now.getHours();

    // Only run after midnight on Friday (day === 5, hour >= 0)
    if (day !== 5) return;

    // Calculate ISO week number to avoid running more than once per week
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-W${weekNumber}`;

    if (lastResetWeek === weekKey) return; // Already reset this week

    console.log(`[Cron] Resetting PLD preferences for all students (week: ${weekKey})...`);

    try {
        // Reset pld_day and pld_time on the users table (registered students)
        const { error: usersError } = await supabase
            .from('users')
            .update({ pld_day: null, pld_time: null })
            .eq('role', 'student')
            .not('pld_day', 'is', null);

        if (usersError) {
            console.error('[Cron] Error resetting users PLD preferences:', usersError);
        }

        // Reset pld_day and pld_time on the students table (master student roster)
        const { error: studentsError } = await supabase
            .from('students')
            .update({ pld_day: null, pld_time: null })
            .not('pld_day', 'is', null);

        if (studentsError) {
            console.error('[Cron] Error resetting students PLD preferences:', studentsError);
        }

        lastResetWeek = weekKey;
        console.log(`[Cron] ✅ PLD preferences reset successfully for week ${weekKey}.`);
    } catch (err) {
        console.error('[Cron] Error in weekly PLD reset:', err);
    }
}

function startCronJob(discordClient) {
    console.log('[Cron] Background notification job started.');

    // Run every minute (60,000 ms) — session notification check
    setInterval(async () => {
        try {
            // Find threshold date: Now + 5 minutes
            const threshold = new Date(Date.now() + 5 * 60000);
            const thresholdISO = threshold.toISOString();

            const sessions = await getSessionsToNotify(thresholdISO);

            for (const session of sessions) {
                console.log(`[Cron] Preparing to notify session: ${session.groupName}, scheduled_date: ${session.scheduled_date}`);

                const mentorId = session.mentorId || session.mentor_id;

                // Format session time for display
                const timeDisplay = session.scheduled_date
                    ? new Date(session.scheduled_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    : '';
                const scheduledTimeStr = timeDisplay ? `\n⏰ **Session Time:** ${timeDisplay}` : '';

                const senderInfo = mentorId ? await userModel.findUserById(mentorId) : null;

                // Send Discord DMs to ALL students in the session
                for (const student of (session.students || [])) {
                    if (!student.discord) continue;

                    const otherTeammates = session.students.filter(s => s.id !== student.id).map(s => s.name);
                    const teammatesStr = otherTeammates.length > 0 ? otherTeammates.join(', ') : 'None';

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

                    const reminderEmbed = new EmbedBuilder()
                        .setColor('#9b59b6') // Amethyst Purple
                        .setTitle('👥 PLD Session Reminder')
                        .setAuthor({
                            name: senderInfo?.username || 'PLD System',
                            iconURL: authorIcon
                        })
                        .setDescription(`Hey **${student.name}**! Your PLD session **"${session.groupName}"** is starting soon (in about 5 minutes)!`)
                        .addFields(
                            { name: 'Time', value: timeDisplay || 'Starting now', inline: true },
                            { name: 'Teammates', value: teammatesStr, inline: true }
                        )
                        .setFooter({ text: 'Get ready to join!' })
                        .setTimestamp();

                    await sendDiscordDM(discordClient, student.discord, { 
                        embeds: [reminderEmbed],
                        files: files.length > 0 ? files : undefined
                    });
                }

                // Create in-app announcement for students (appears at the same time as Discord DM)
                try {
                    const announcementModel = require('./models/announcementModel');
                    const teammateNames = (session.students || []).map(s => s.name).join(', ');
                    const timeStr = timeDisplay ? `\n**Session Time:** ${timeDisplay}` : '';
                    const annMessage = `Your PLD session **${session.groupName}** starts in 5 minutes!${timeStr}\n\n**Your teammates:** ${teammateNames}`;

                    await announcementModel.createAnnouncement({
                        mentorId: mentorId || 'system',
                        mentorName: 'PLD System',
                        title: `PLD Reminder — ${session.groupName}`,
                        message: annMessage,
                        target: 'selected',
                        recipients: session.students || []
                    });
                    console.log(`[Cron] In-app announcement created for ${session.groupName}`);
                } catch (annErr) {
                    console.error(`[Cron] Failed to create announcement for ${session.groupName}:`, annErr.message);
                }

                // Mark as notified in DB
                await markSessionNotified(session.id);
                console.log(`[Cron] Marked session ${session.id} as notified.`);
            }

        } catch (err) {
            console.error('[Cron] Error in background job:', err);
        }
    }, 60000);

    // Run every 5 minutes — weekly PLD preference reset check
    setInterval(async () => {
        try {
            await resetWeeklyPldPreferences();
        } catch (err) {
            console.error('[Cron] Error in weekly reset check:', err);
        }
    }, 5 * 60000);

    // Also run once on startup in case the server started on a Friday
    setTimeout(() => resetWeeklyPldPreferences(), 5000);
}

module.exports = { startCronJob };
