const { supabase } = require('./db');

// Read current db.json data directly, use file sync lowdb
const path = require('path');
const fs = require('fs');
const dbPath = path.join(__dirname, '..', 'db.json');
const rawData = fs.readFileSync(dbPath);
const data = JSON.parse(rawData);

async function migrate() {
    console.log("Starting migration to Supabase...");

    // 1. Users
    if (data.users && data.users.length > 0) {
        console.log(`Migrating ${data.users.length} users...`);
        const { error } = await supabase.from('users').upsert(
            data.users.map(u => ({
                id: u.id,
                username: u.username,
                password: u.password,
                discordId: u.discordId,
                role: u.role,
                major: u.major,
                createdAt: u.createdAt,
                avatar_url: u.avatar || null
            }))
        );
        if (error) console.error("Error migrating users:", error);
    }

    // 2. Students
    if (data.students && data.students.length > 0) {
        console.log(`Migrating ${data.students.length} students...`);
        const { error } = await supabase.from('students').upsert(
            data.students.map(s => ({
                id: s.id,
                mentorId: s.mentorId,
                name: s.name,
                discord: s.discord,
                major: s.major,
                createdAt: s.createdAt || new Date().toISOString()
            }))
        );
        if (error) console.error("Error migrating students:", error);
    }

    // 3. Questions
    if (data.questions && data.questions.length > 0) {
        console.log(`Migrating ${data.questions.length} question sets...`);
        const { error } = await supabase.from('questions').upsert(
            data.questions.map(q => ({
                id: q.id,
                mentorId: q.mentorId,
                topic: q.topic,
                questions: q.questions,
                createdAt: q.createdAt || new Date().toISOString()
            }))
        );
        if (error) console.error("Error migrating questions:", error);
    }

    // 4. Sessions
    if (data.sessions && data.sessions.length > 0) {
        console.log(`Migrating ${data.sessions.length} sessions...`);

        // Ensure student IDs are processed as jsonb properly
        for (const session of data.sessions) {
            const { error } = await supabase.from('sessions').upsert({
                id: session.id,
                mentorId: session.mentorId,
                groupName: session.groupName,
                topicIds: session.topicIds,
                topicNames: session.topicNames,
                topicName: session.topicName,
                questions: session.questions,
                status: session.status,
                createdAt: session.createdAt || new Date().toISOString(),
                students: session.students || []
            });
            if (error) console.error("Error migrating session:", session.id, error);
        }
    }

    // 5. Chats
    if (data.chats && data.chats.length > 0) {
        console.log(`Migrating ${data.chats.length} chats...`);
        for (const chat of data.chats) {
            const { error } = await supabase.from('chats').upsert({
                id: chat.id,
                sessionId: chat.sessionId,
                studentId: chat.studentId,
                messages: chat.messages || [],
                createdAt: chat.createdAt || new Date().toISOString(),
                updatedAt: chat.updatedAt || new Date().toISOString()
            });
            if (error) console.error("Error migrating chat:", chat.id, error);
        }
    }

    console.log("Migration complete!");
}

migrate();
