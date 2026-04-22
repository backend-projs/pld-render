require('dotenv').config();
const { supabase } = require('./models/db');

async function check() {
    const { data: users, error: errU } = await supabase.from('users').select('*');
    if (users) {
        console.log(`USERS:`);
        users.forEach(u => console.log(`- ${u.username} (${u.role}): ${u.id}`));
    }

    const { data: students, error: errS } = await supabase.from('students').select('*');
    if (students && students.length > 0) {
        const uniqueMentors = [...new Set(students.map(s => s.mentorId))];
        console.log(`\nSTUDENTS belong to mentor IDs: ${uniqueMentors.join(', ')}`);
        console.log(`Total students: ${students.length}`);
    }

    const { data: questions, error: errQ } = await supabase.from('questions').select('*');
    if (questions && questions.length > 0) {
        const uniqueMentors = [...new Set(questions.map(q => q.mentorId))];
        console.log(`\nQUESTIONS belong to mentor IDs: ${uniqueMentors.join(', ')}`);
        console.log(`Total question sets: ${questions.length}`);
    }

    process.exit(0);
}

check();
