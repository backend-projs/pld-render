require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function testInsert() {
    console.log("Testing insert with mentorId null...");
    const { error } = await supabase.from('students').insert([{
        id: require('uuid').v4(),
        mentorId: null,
        name: 'Test Student',
        discord: 'testuser',
        major: 'Undeclared',
        discord_verified: true,
        createdAt: new Date().toISOString()
    }]);

    if (error) {
        console.error("Insert failed:", error.message, error.details, error.hint);
    } else {
        console.log("Insert succeeded!");
        // cleanup
        await supabase.from('students').delete().eq('discord', 'testuser');
    }
}

testInsert();
