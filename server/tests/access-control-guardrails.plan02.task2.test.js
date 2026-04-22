const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

const sessionsRoutePath = path.join(__dirname, '..', 'routes', 'sessions.js');
const sessionControllerPath = path.join(__dirname, '..', 'controllers', 'sessionController.js');
const authMiddlewarePath = path.join(__dirname, '..', 'utils', 'authMiddleware.js');
const authzMiddlewarePath = path.join(__dirname, '..', 'utils', 'authzMiddleware.js');

function loadSessionsRouterWithMocks() {
    delete require.cache[sessionsRoutePath];

    require.cache[sessionControllerPath] = {
        id: sessionControllerPath,
        filename: sessionControllerPath,
        loaded: true,
        exports: {
            createSession: async (req, res) => res.status(200).json({ ok: true, action: 'createSession', role: req.user?.role ?? null }),
            getMySessions: async (req, res) => res.status(200).json({ ok: true, action: 'getMySessions' }),
            getJoinableSessions: async (req, res) => res.status(200).json({ ok: true, action: 'getJoinableSessions' }),
            joinSession: async (req, res) => res.status(200).json({ ok: true, action: 'joinSession' }),
            getSession: async (req, res) => res.status(200).json({ ok: true, action: 'getSession' }),
            updateNote: async (req, res) => res.status(200).json({ ok: true, action: 'updateNote' }),
            saveResult: async (req, res) => res.status(200).json({ ok: true, action: 'saveResult' }),
            updateGrade: async (req, res) => res.status(200).json({ ok: true, action: 'updateGrade' }),
            updateQuestions: async (req, res) => res.status(200).json({ ok: true, action: 'updateQuestions' }),
            toggleStatus: async (req, res) => res.status(200).json({ ok: true, action: 'toggleStatus' }),
            sendFeedback: async (req, res) => res.status(200).json({ ok: true, action: 'sendFeedback' }),
            sendAllFeedback: async (req, res) => res.status(200).json({ ok: true, action: 'sendAllFeedback' }),
            deleteAllSessions: async (req, res) => res.status(200).json({ ok: true, action: 'deleteAllSessions' }),
            deleteSession: async (req, res) => res.status(200).json({ ok: true, action: 'deleteSession' }),
            endSession: async (req, res) => res.status(200).json({ ok: true, action: 'endSession' }),
            getLeaderboard: async (req, res) => res.status(200).json({ ok: true, action: 'getLeaderboard' })
        }
    };

    require.cache[authMiddlewarePath] = {
        id: authMiddlewarePath,
        filename: authMiddlewarePath,
        loaded: true,
        exports: (req, res, next) => {
            const header = req.headers.authorization;
            if (!header) {
                return res.status(401).json({ error: 'No token provided' });
            }

            const token = header.split(' ')[1];
            if (token === 'mentor-owner') {
                req.user = { id: 'mentor-owner', role: 'mentor' };
            } else if (token === 'mentor-other') {
                req.user = { id: 'mentor-other', role: 'mentor' };
            } else {
                req.user = { id: 'student-1', role: 'student' };
            }

            return next();
        }
    };

    require.cache[authzMiddlewarePath] = {
        id: authzMiddlewarePath,
        filename: authzMiddlewarePath,
        loaded: true,
        exports: {
            requireRole: (role) => (req, res, next) => {
                if (!req.user || req.user.role !== role) {
                    return res.status(403).json({ error: 'Forbidden' });
                }
                return next();
            },
            requireSessionMentorOwner: (req, res, next) => {
                if (req.user?.id !== 'mentor-owner') {
                    return res.status(403).json({ error: 'Forbidden' });
                }
                return next();
            }
        }
    };

    return require(sessionsRoutePath);
}

async function makeRequest(router, method, routePath, token, body) {
    const app = express();
    app.use(express.json());
    app.use('/api/sessions', router);

    const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
    });

    const { port } = server.address();
    const headers = { Authorization: `Bearer ${token}` };
    if (body) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(`http://127.0.0.1:${port}${routePath}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        return response.status;
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function testSessionMutationOwnership() {
    const router = loadSessionsRouterWithMocks();
    const mutationEndpoints = [
        ['PUT', '/api/sessions/session-1/students/student-1/notes', { notes: 'n' }],
        ['PUT', '/api/sessions/session-1/students/student-1/result', { result: 'r' }],
        ['PUT', '/api/sessions/session-1/students/student-1/grade', { grade: '5' }],
        ['PUT', '/api/sessions/session-1/students/student-1/questions', { answered: 1, incorrect: 0 }],
        ['PUT', '/api/sessions/session-1/students/student-1/status', { status: 'present' }],
        ['POST', '/api/sessions/session-1/students/student-1/send'],
        ['POST', '/api/sessions/session-1/send-all'],
        ['DELETE', '/api/sessions/session-1'],
        ['POST', '/api/sessions/session-1/end']
    ];

    for (const [method, routePath, body] of mutationEndpoints) {
        const outsiderStatus = await makeRequest(router, method, routePath, 'mentor-other', body);
        assert.equal(outsiderStatus, 403, `${method} ${routePath} should reject non-owner mentor`);

        const ownerStatus = await makeRequest(router, method, routePath, 'mentor-owner', body);
        assert.equal(ownerStatus, 200, `${method} ${routePath} should allow owner mentor`);
    }
}

async function testReadAndJoinAccessSemantics() {
    const router = loadSessionsRouterWithMocks();

    const readStatus = await makeRequest(router, 'GET', '/api/sessions/session-1', 'student-member');
    assert.equal(readStatus, 200);

    const joinStatus = await makeRequest(router, 'POST', '/api/sessions/session-1/join', 'student-member');
    assert.equal(joinStatus, 200);
}

async function testMentorOnlyActions() {
    const router = loadSessionsRouterWithMocks();

    const studentCreateStatus = await makeRequest(router, 'POST', '/api/sessions', 'student-member', { groupName: 'g', topicIds: ['t1'] });
    assert.equal(studentCreateStatus, 403);

    const mentorCreateStatus = await makeRequest(router, 'POST', '/api/sessions', 'mentor-owner', { groupName: 'g', topicIds: ['t1'] });
    assert.equal(mentorCreateStatus, 200);

    const studentDeleteAllStatus = await makeRequest(router, 'DELETE', '/api/sessions/all', 'student-member');
    assert.equal(studentDeleteAllStatus, 403);

    const mentorDeleteAllStatus = await makeRequest(router, 'DELETE', '/api/sessions/all', 'mentor-owner');
    assert.equal(mentorDeleteAllStatus, 200);
}

async function run() {
    await testSessionMutationOwnership();
    await testReadAndJoinAccessSemantics();
    await testMentorOnlyActions();
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
