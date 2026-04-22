// server/models/majorModel.js
const { supabase } = require('./db');
const { v4: uuidv4 } = require('uuid');

async function getMajors() {
    const { data, error } = await supabase.from('majors').select('*').order('name');
    if (error) console.error("Error getting majors:", error);
    return data || [];
}

async function addMajor(name) {
    const major = { id: uuidv4(), name: name.trim() };
    const { data, error } = await supabase.from('majors').insert([major]).select().single();
    if (error) {
        console.error("Error adding major:", error);
        throw error;
    }
    return data;
}

async function deleteMajor(id) {
    const { error } = await supabase.from('majors').delete().eq('id', id);
    if (error) console.error("Error deleting major:", error);
    return !error;
}

module.exports = {
    getMajors,
    addMajor,
    deleteMajor
};
