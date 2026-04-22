// server/models/chatModel.js
const { supabase } = require('./db');
const { v4: uuidv4 } = require('uuid');

async function getChatHistory(sessionId, studentId) {
    const { data: chat, error } = await supabase
        .from('chats')
        .select('messages')
        .eq('sessionId', sessionId)
        .eq('studentId', studentId)
        .maybeSingle();

    if (error) console.error("Error getting chat history:", error);
    return chat ? chat.messages : [];
}

async function addMessage(sessionId, studentId, role, content) {
    const timestamp = new Date().toISOString();
    const newMessage = { role, content, timestamp };

    const { data: chat, error: fetchErr } = await supabase
        .from('chats')
        .select('*')
        .eq('sessionId', sessionId)
        .eq('studentId', studentId)
        .maybeSingle();

    if (fetchErr) console.error("Error fetching chat to add message:", fetchErr);

    if (!chat) {
        // Create new chat entry if it doesn't exist
        const newChat = {
            id: uuidv4(),
            sessionId,
            studentId,
            messages: [newMessage],
            createdAt: timestamp,
            updatedAt: timestamp
        };
        const { error: insertErr } = await supabase.from('chats').insert([newChat]);
        if (insertErr) console.error("Error inserting chat:", insertErr);
    } else {
        // Append message to existing chat
        const updatedMessages = [...(chat.messages || []), newMessage];
        const { error: updateErr } = await supabase
            .from('chats')
            .update({ messages: updatedMessages, updatedAt: timestamp })
            .eq('id', chat.id);

        if (updateErr) console.error("Error updating chat:", updateErr);
    }

    return newMessage;
}

async function clearChat(sessionId, studentId) {
    const { error } = await supabase.from('chats').delete().eq('sessionId', sessionId).eq('studentId', studentId);
    if (error) console.error("Error clearing chat:", error);
    return !error;
}

module.exports = { getChatHistory, addMessage, clearChat };
