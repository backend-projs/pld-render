require('dotenv').config();
const { supabase } = require('./models/db');

async function check() {
    console.log('Checking users...');
    const { data: users, error: errU } = await supabase.from('users').select('*');
    if (errU) console.error("users error:", errU);
    else console.log(`Users count: ${users.length}`);

    console.log('Checking students...');
    const { data: students, error: errS } = await supabase.from('students').select('*');
    if (errS) console.error("students error:", errS);
    else console.log(`Students count: ${students.length}`);

    console.log('Checking questions...');
    const { data: questions, error: errQ } = await supabase.from('questions').select('*');
    if (errQ) console.error("questions error:", errQ);
    else console.log(`Questions count: ${questions.length}`);

    process.exit(0);
}

check();
