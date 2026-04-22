const express = require('express');
const router = express.Router();
const { OpenRouter } = require('@openrouter/sdk');
const authMiddleware = require('../utils/authMiddleware');

const openrouter = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY || ''
});

// --- AI Prompts ---

function getExecutionOnlyPrompt(language) {
  return `You are a ${language} code execution simulator.

Predict EXACTLY what this code would output when executed.

Rules:
- Return ONLY the output exactly as it would appear
- Include all newlines, spaces, formatting precisely
- For errors, show exact compiler/interpreter error messages
- No explanations, no suggestions, just raw output

Respond in this exact JSON format only:
{
  "success": true,
  "output": "exact output here",
  "exitCode": 0,
  "executionTime": 45
}

If there's an error:
{
  "success": false,
  "output": "exact error message here",
  "exitCode": 1,
  "executionTime": 12
}`;
}

function getFullTutorPrompt(language) {
  return `You are an expert ${language} programming tutor and code execution simulator.

Tasks:
1. Predict EXACT output of this code
2. Explain what the code does in beginner-friendly terms
3. Provide improvement suggestions
4. Give hints if there are errors
5. Rate code quality (1-10)

Rules for output:
- Predict output EXACTLY as it would appear (newlines, spaces, formatting)
- For errors, show exact compiler/interpreter error messages

Respond in this exact JSON format only:
{
  "success": true,
  "output": "exact output or error message",
  "exitCode": 0,
  "executionTime": 45,
  "explanation": "beginner-friendly explanation of what code does",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "hints": ["hint if something is wrong"],
  "codeQuality": {
    "score": 8,
    "feedback": "brief quality feedback"
  }
}`;
}

function getTutorOnlyPrompt(language) {
  return `You are an expert ${language} programming tutor.
You are reviewing code that has already been executed securely.

Tasks:
1. Explain what the code does in beginner-friendly terms
2. Provide improvement suggestions
3. Give hints if there are errors in the execution output
4. Rate code quality (1-10)

Respond in this exact JSON format only:
{
  "explanation": "beginner-friendly explanation of what code does",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "hints": ["hint if something is wrong"],
  "codeQuality": {
    "score": 8,
    "feedback": "brief quality feedback"
  }
}`;
}

const BASE_FEEDBACK_PROMPT = `
You are a friendly Teaching Assistant for Peer Learning Days (PLD).
Your job is to write simple, clear feedback messages that will be sent to students via Discord (A2 level English).
Short, clear sentences. Be friendly and encouraging.
Vary the greeting and structure. Don't repeat the same patterns.
Output ONLY the message text.
`;

const TUTOR_SYSTEM_PROMPT = `
You are an AI Tutor inside a Peer Learning Day (PLD) platform.
You help the student understand ONLY the topics mentioned in the mentor’s report.
Explain concepts simply, give examples, and ask 1-2 check questions.
Do NOT grade the student. Do NOT act as a mentor.
`;

// Helper for OpenRouter Chat
const askAI = async (prompt, systemPrompt = '') => {
    if (!process.env.OPENROUTER_API_KEY) return 'AI not configured.';
    
    try {
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const completion = await openrouter.chat.send({
            chatGenerationParams: {
                model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free',
                messages
            }
        });
        return completion.choices?.[0]?.message?.content || completion.message?.content || '';
    } catch (err) {
        console.error('[AI] OpenRouter Error:', err.message);
        throw err;
    }
};

async function evaluateCode(language, code, tutorMode = false, expectedOutput = null, realOutput = null) {
    let systemPrompt;
    if (tutorMode && realOutput !== null) {
        systemPrompt = getTutorOnlyPrompt(language);
    } else if (tutorMode) {
        systemPrompt = getFullTutorPrompt(language);
    } else {
        systemPrompt = getExecutionOnlyPrompt(language);
    }

    let prompt = `Code:\n${code}`;
    if (expectedOutput) {
        prompt += `\n\nExpected Output (for context):\n${expectedOutput}`;
    }
    if (realOutput !== null) {
        prompt += `\n\nActual Execution Output:\n${realOutput}`;
    }

    const responseText = await askAI(prompt, systemPrompt);
    
    try {
        // Find JSON block in the response
        const match = responseText.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        throw new Error("No JSON found in response");
    } catch (err) {
        console.error("Error parsing AI JSON response:", err);
        return {
            success: false,
            output: "Failed to evaluate code.",
            exitCode: 1,
            executionTime: 0,
            rawResponse: responseText
        };
    }
}

const { scanCode } = require('../services/securityScanner');
const { runCode } = require('../services/codeRunner');

// POST /api/ai/evaluate
router.post('/evaluate', authMiddleware, async (req, res) => {
    try {
        const { language, code, tutorMode, expectedOutput } = req.body;

        if (!language || !code) {
            return res.status(400).json({ 
                success: false, 
                error: 'Language and code are required' 
            });
        }

        if (code.length > 10000) {
            return res.status(400).json({
                success: false,
                error: 'Code too long. Maximum 10,000 characters.'
            });
        }

        // STEP 1: Security scan (<10ms)
        const scan = scanCode(language, code);

        let executionResult;

        if (scan.safe) {
            // ⚡ SAFE → Real execution (fast, <100ms)
            executionResult = runCode(language, code);
            executionResult.executionMode = 'real';
            
            // STEP 2: If tutor mode ON, get AI feedback too
            if (tutorMode) {
                // Code already ran successfully, now get AI feedback ONLY, providing the real output
                const tutorFeedback = await evaluateCode(language, code, true, expectedOutput, executionResult.output);
                executionResult.explanation = tutorFeedback.explanation;
                executionResult.suggestions = tutorFeedback.suggestions;
                executionResult.hints = tutorFeedback.hints;
                executionResult.codeQuality = tutorFeedback.codeQuality;
            }
        } else {
            // 🛡️ DANGEROUS → AI evaluation (safe, 2-3s)
            executionResult = await evaluateCode(language, code, tutorMode || false, expectedOutput);
            executionResult.executionMode = 'ai';
            executionResult.securityWarning = 'Some code patterns were restricted. Output is AI-predicted.';
        }

        return res.json(executionResult);
    } catch (err) {
        console.error('[AI Route Error]:', err);
        res.status(500).json({ 
            success: false,
            error: 'server_error',
            message: err.message || 'An unexpected error occurred'
        });
    }
});

// POST /api/ai/tutor-review
router.post('/tutor-review', authMiddleware, async (req, res) => {
    try {
        const { language, code, expectedOutput, realOutput } = req.body;

        if (!language || !code) {
            return res.status(400).json({ 
                success: false, 
                error: 'Language and code are required' 
            });
        }

        const tutorFeedback = await evaluateCode(language, code, true, expectedOutput, realOutput);
        return res.json(tutorFeedback);
    } catch (err) {
        console.error('[AI Route Error]:', err);
        res.status(500).json({ 
            success: false,
            error: 'server_error',
            message: err.message || 'An unexpected error occurred'
        });
    }
});

// POST /api/ai/generate-practice
router.post('/generate-practice', async (req, res) => {
    try {
        const { topic, difficulty, count } = req.body;
        const prompt = `Generate ${count || 3} practice questions for: ${topic} (${difficulty}). Return ONLY a JSON array of strings. e.g. ["Q1", "Q2"]`;
        
        const content = await askAI(prompt, 'You are an AI Practice Bot.');
        const match = content.match(/\[.*\]/s);
        const questions = match ? JSON.parse(match[0]) : [content];
        
        res.json({ questions });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate questions' });
    }
});

// POST /api/ai/evaluate-practice
router.post('/evaluate-practice', async (req, res) => {
    try {
        const { question, answer, topic, difficulty } = req.body;
        const prompt = `Topic: ${topic}\nDifficulty: ${difficulty}\nQ: ${question}\nStudent: ${answer}\nEvaluate. Return ONLY JSON: {"score": 0-100, "feedback": "...", "correctAnswer": "..."}`;
        
        const content = await askAI(prompt, 'You are an AI Practice Bot.');
        const match = content.match(/\{.*\}/s);
        const evaluation = match ? JSON.parse(match[0]) : { score: 0, feedback: "Format error", correctAnswer: "" };
        
        res.json(evaluation);
    } catch (err) {
        res.status(500).json({ error: 'Failed to evaluate answer' });
    }
});

// POST /api/ai/chat-tutor
router.post('/chat-tutor', async (req, res) => {
    try {
        const { message, mentorReport, studentLevel, chatHistory } = req.body;
        
        const historyText = chatHistory?.map(m => `${m.role}: ${m.content}`).join('\n') || '';
        const prompt = `Report: ${JSON.stringify(mentorReport)}\nLevel: ${studentLevel}\nHistory:\n${historyText}\nStudent: ${message}`;
        
        const response = await askAI(prompt, TUTOR_SYSTEM_PROMPT);
        res.json({ content: response });
    } catch (err) {
        res.status(500).json({ error: 'Tutor unavailable' });
    }
});

// POST /api/ai/generate-feedback (Discord)
router.post('/generate-feedback', async (req, res) => {
    try {
        const { studentName, projectName, mentorNotes } = req.body;
        const prompt = `Student: ${studentName}\nProject: ${projectName}\nNotes: ${mentorNotes}`;
        
        const feedback = await askAI(prompt, BASE_FEEDBACK_PROMPT);
        res.json({ feedback });
    } catch (err) {
        res.status(500).json({ error: 'Feedback failed' });
    }
});

module.exports = router;
