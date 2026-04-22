require('dotenv').config();
const { supabase } = require('./models/db');

async function fix() {
    const oldMentorId = 'a62ec445-cbee-407f-98c3-6c3a9c4a893b';
    const newMentorId = 'c8827ffe-90f8-4039-ad99-e841ef1e19af';

    console.log('Fixing students...');
    const { data: sData, error: sErr } = await supabase
        .from('students')
        .update({ mentorId: newMentorId })
        .eq('mentorId', oldMentorId);

    if (sErr) console.error(sErr);
    else console.log('Students updated successfully.');

    console.log('Fixing questions...');
    const { data: qData, error: qErr } = await supabase
        .from('questions')
        .update({ mentorId: newMentorId })
        .eq('mentorId', oldMentorId);

    if (qErr) console.error(qErr);
    else console.log('Questions updated successfully.');

    process.exit(0);
}

fix();
