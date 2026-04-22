// server/models/db.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Ensure SUPABASE_URL and SUPABASE_KEY are provided
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY in environment variables.");
    process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log(`Database connected to Supabase URL: ${supabaseUrl}`);

// Mock lowdb so that things don't break immediately while we refactor.
// This is intentionally left blank since all models should use supabase directly.
const db = {};

module.exports = { supabase, db };
