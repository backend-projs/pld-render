// client/src/services/aiService.js
import api from '../api';

/**
 * Generates a friendly Discord feedback message via server-side AI
 */
export async function generateFeedback(studentName, projectName, mentorNotes) {
    try {
        const data = await api.post('/api/ai/generate-feedback', { studentName, projectName, mentorNotes });
        return data.feedback || "Failed to generate feedback.";
    } catch (err) {
        console.error("AI Generation Error:", err);
        return "Failed to generate feedback due to network error.";
    }
}

/**
 * AI Tutor chat interface via server-side AI
 */
export async function chatWithTutor(sessionId, studentId, message, mentorReport, studentLevel, chatHistory, sessionData) {
    try {
        // 1. Save student message locally
        await saveMessageToBackend(sessionId, studentId, 'user', message);

        // 2. Get AI response from server
        const data = await api.post('/api/ai/chat-tutor', { 
            message, 
            mentorReport, 
            studentLevel, 
            chatHistory 
        });
        
        const aiText = data.content;

        // 3. Save AI message
        await saveMessageToBackend(sessionId, studentId, 'model', aiText);
        return aiText;
    } catch (error) {
        console.error("Chat Error:", error);
        throw error;
    }
}

/**
 * Persists chat messages to database
 */
async function saveMessageToBackend(sessionId, studentId, role, content) {
    try {
        await api.post('/api/chat/save', { sessionId, studentId, role, content });
    } catch (err) {
        console.error("Backend Save Error:", err);
    }
}

// --- Practice Minigame Functions (Now Server-Side) ---

export async function generatePracticeQuestions(topic, difficulty, count) {
    try {
        const data = await api.post('/api/ai/generate-practice', { topic, difficulty, count });
        return data.questions || null;
    } catch (err) {
        console.error("AI Practice Gen Error:", err);
        return null;
    }
}

export async function evaluatePracticeAnswer(question, answer, topic, difficulty) {
    try {
        return await api.post('/api/ai/evaluate-practice', { question, answer, topic, difficulty });
    } catch (err) {
        console.error("AI Practice Eval Error:", err);
        return null;
    }
}
