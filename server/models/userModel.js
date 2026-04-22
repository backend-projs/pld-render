// server/models/userModel.js
const { supabase } = require('./db');
const { v4: uuidv4 } = require('uuid');

async function createUser(username, password, discordId, role = 'student', major = '', firstName = '', lastName = '') {
    const user = {
        "id": uuidv4(),
        "username": username,
        "password": password,
        "discordId": discordId,
        "firstName": firstName,
        "lastName": lastName,
        "avatar_url": '',
        "role": role,
        "major": major,
        "createdAt": new Date().toISOString()
    };

    const { data, error } = await supabase.from('users').insert([user]).select().single();
    if (error) {
        console.error("Error creating user:", error);
        throw error;
    }
    return data;
}

async function findUserByUsername(username) {
    const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
    if (error) console.error("Error finding user by username:", error);
    return data;
}

async function findUserById(id) {
    if (!id || id === 'admin') return null;
    const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    if (error) console.error("Error finding user by id:", error);
    return data;
}

async function findUserByDiscordId(discordId) {
    if (!discordId) return null;
    const { data, error } = await supabase.from('users').select('*').eq('discordId', discordId).maybeSingle();
    if (error) console.error("Error finding user by discord id:", error);
    return data;
}

async function getAllStudentUsers() {
    const { data, error } = await supabase.from('users').select('*').eq('role', 'student');
    if (error) console.error("Error getting all student users:", error);
    return data || [];
}

async function getMentors() {
    const { data, error } = await supabase.from('users').select('id, username').eq('role', 'mentor');
    if (error) console.error("Error getting mentors:", error);
    return data || [];
}

async function getAllUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) console.error("Error getting all users:", error);
    return data || [];
}

async function deleteUser(id) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) console.error("Error deleting user:", error);
    return !error;
}

async function updateUserPasswordByUserId(userId, newPassword) {
    const { data, error } = await supabase.from('users').update({ password: newPassword }).eq('id', userId).select().single();
    if (error) console.error("Error updating user password:", error);
    return data;
}

async function updateUserProfile(userId, updates) {
    const allowed = ['username', 'firstName', 'lastName', 'discordId', 'avatar_url', 'major'];
    // Handle avatar mapping
    if (updates.avatar && !updates.avatar_url) {
        updates.avatar_url = updates.avatar;
    }
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
        if (allowed.includes(key)) filteredUpdates[key] = updates[key];
    });

    const { data, error } = await supabase.from('users').update(filteredUpdates).eq('id', userId).select().single();
    if (error) console.error("Error updating user profile:", error);
    return data;
}

module.exports = {
    createUser,
    findUserByUsername,
    findUserById,
    findUserByDiscordId,
    updateUserPassword: updateUserPasswordByUserId,
    updateUserProfile,
    getAllStudentUsers,
    getAllUsers,
    deleteUser,
    getMentors
};
