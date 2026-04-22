// server/models/announcementModel.js
const { supabase } = require('./db');

async function createAnnouncement({ mentorId, mentorName, title, message, target, recipients }) {
    const { data: ann, error } = await supabase
        .from('announcements')
        .insert([{ mentor_id: mentorId, mentor_name: mentorName, title, message, target }])
        .select()
        .single();
    if (error) throw error;

    if (target === 'selected' && recipients && recipients.length > 0) {
        const rows = recipients.map(r => ({
            announcement_id: ann.id,
            student_discord: r.discord,
            student_name: r.name
        }));
        await supabase.from('announcement_recipients').insert(rows);
    }

    return ann;
}

async function getAllAnnouncements() {
    const { data, error } = await supabase
        .from('announcements')
        .select('*, announcement_recipients(student_discord, student_name)')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function getAnnouncementsForStudent(discordId) {
    // Get "all" announcements + ones specifically for this student
    const { data: allAnn, error: e1 } = await supabase
        .from('announcements')
        .select('*, announcement_recipients(student_discord, student_name)')
        .eq('target', 'all')
        .order('created_at', { ascending: false });

    const { data: specificAnn, error: e2 } = await supabase
        .from('announcements')
        .select('*, announcement_recipients!inner(student_discord, student_name)')
        .eq('target', 'selected')
        .eq('announcement_recipients.student_discord', discordId)
        .order('created_at', { ascending: false });

    if (e1 || e2) throw e1 || e2;
    const combined = [...(allAnn || []), ...(specificAnn || [])];
    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return combined;
}

async function deleteAnnouncement(id) {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    return true;
}

module.exports = { createAnnouncement, getAllAnnouncements, getAnnouncementsForStudent, deleteAnnouncement };
