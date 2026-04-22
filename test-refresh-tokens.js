// test-refresh-tokens.js
require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
    console.log("Testing refresh_tokens table...");
    const { data, error } = await supabase.from('refresh_tokens').select('*').limit(1);
    if (error) {
        console.error("Error selecting from refresh_tokens:", error);
    } else {
        console.log("Success selecting from refresh_tokens:", data);
    }

    console.log("\nTesting insert with camelCase keys (userId)...");
    const { error: insertError } = await supabase.from('refresh_tokens').insert([{
        userId: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        token: 'test-token-' + Date.now(),
        expiresAt: new Date().toISOString(),
        familyId: '00000000-0000-0000-0000-000000000000',
        isRevoked: false
    }]);

    if (insertError) {
        console.error("Insert failed with camelCase:", insertError);
    } else {
        console.log("Insert succeeded with camelCase!");
    }
}

test();
