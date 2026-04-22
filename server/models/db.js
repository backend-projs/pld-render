// server/models/db.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Fix: Force Node 18's native fetch (undici) to use IPv4 to bypass Render's IPv6 blackhole.
// This prevents Supabase requests from hanging indefinitely.
try {
    const { Agent, setGlobalDispatcher } = require('undici');
    setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
} catch (e) {
    console.warn("undici not available, proceeding with default fetch dispatcher.");
}

// Ensure SUPABASE_URL and SUPABASE_KEY are provided
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY in environment variables.");
    process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Create a custom fetch wrapper that incorporates a timeout (e.g. 10 seconds).
// This guarantees we never get a silent 503 hang again if the DB becomes unreachable.
const customFetch = async (url, options) => {
    const timeoutMsg = 'Supabase request timeout after 10000ms';
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(new Error(timeoutMsg)), 10000);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(timeoutMsg);
        }
        throw err;
    } finally {
        clearTimeout(id);
    }
};

const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
        fetch: customFetch
    }
});

console.log(`Database connected to Supabase URL: ${supabaseUrl}`);

// Mock lowdb so that things don't break immediately while we refactor.
// This is intentionally left blank since all models should use supabase directly.
const db = {};

module.exports = { supabase, db };
