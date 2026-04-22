require('dotenv').config(); // Load .env from current directory (server/)
const { supabase } = require('./models/db');
const { v4: uuidv4 } = require('uuid');

async function testRefreshToken() {
    try {
        console.log("Checking if users exist...");
        const { data: user, error: userError } = await supabase.from('users').select('*').limit(1).single();
        if (userError) {
             console.error("User fetch error:", userError);
             return;
        }
        
        console.log("Found user:", user.id);

        const token = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        console.log("Attempting to insert refresh token...");
        const { data, error } = await supabase
            .from('refresh_tokens')
            .insert([{
                "userId": user.id,
                "token": token,
                "expiresAt": expiresAt.toISOString(),
                "familyId": uuidv4(),
                "isRevoked": false
            }])
            .select()
            .single();

        if (error) {
            console.error("INSERT ERROR:", error);
        } else {
            console.log("INSERT SUCCESS:", data);
        }
    } catch (e) {
        console.error("CATCH ERROR:", e);
    }
}

testRefreshToken();
