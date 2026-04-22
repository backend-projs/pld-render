const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const authzMiddlewarePath = path.join(__dirname, '..', 'utils', 'authzMiddleware.js');
const sessionModelPath = path.join(__dirname, '..', 'models', 'sessionModel.js');
const userModelPath = path.join(__dirname, '..', 'models', 'userModel.js');

function loadAuthzMiddleware({ getSessionById, findUserById }) {
    delete require.cache[authzMiddlewarePath];
    require.cache[sessionModelPath] = {
        id: sessionModelPath,
        filename: sessionModelPath,
        loaded: true,
        exports: { getSessionById }
    };
    require.cache[userModelPath] = {
        id: userModelPath,
        filename: userModelPath,
        loaded: true,
        exports: { findUserById }
    };
    return require(authzMiddlewarePath);
}

function createResponseTracker() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

async function invokeMiddleware(middleware, req) {
    const res = createResponseTracker();
    let nextCalled = false;
    await middleware(req, res, () => {
        nextCalled = true;
    });
    return { res, nextCalled };
}

test('requireRole(admin) returns 403 when user role is not admin', async () => {
    const { requireRole } = loadAuthzMiddleware({
        getSessionById: async () => null,
        findUserById: async () => null
    });

    const req = { user: { role: 'mentor' } };
    const { res, nextCalled } = await invokeMiddleware(requireRole('admin'), req);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
});

test('requireSessionMemberOrMentor allows owner and member student, blocks outsiders', async () => {
    const session = {
        id: 'session-1',
        mentorId: 'mentor-1',
        students: [{ id: 'student-row-1', discord: 'member-discord' }]
    };
    const { requireSessionMemberOrMentor } = loadAuthzMiddleware({
        getSessionById: async () => session,
        findUserById: async (id) => (id === 'student-1' ? { id, discordId: 'member-discord' } : { id, discordId: 'outsider-discord' })
    });

    const mentorReq = { params: { sessionId: 'session-1' }, user: { id: 'mentor-1' } };
    const mentorResult = await invokeMiddleware(requireSessionMemberOrMentor, mentorReq);
    assert.equal(mentorResult.nextCalled, true);
    assert.equal(Boolean(mentorReq.authz), true);

    const studentReq = { params: { sessionId: 'session-1' }, user: { id: 'student-1' } };
    const studentResult = await invokeMiddleware(requireSessionMemberOrMentor, studentReq);
    assert.equal(studentResult.nextCalled, true);
    assert.equal(Boolean(studentReq.authz), true);

    const outsiderReq = { params: { sessionId: 'session-1' }, user: { id: 'outsider-1' } };
    const outsiderResult = await invokeMiddleware(requireSessionMemberOrMentor, outsiderReq);
    assert.equal(outsiderResult.nextCalled, false);
    assert.equal(outsiderResult.res.statusCode, 403);
});

test('requireSessionMentorOwner blocks non-owner users for session write access', async () => {
    const session = {
        id: 'session-1',
        mentorId: 'mentor-1',
        students: [{ id: 'student-row-1', discord: 'member-discord' }]
    };
    const { requireSessionMentorOwner } = loadAuthzMiddleware({
        getSessionById: async () => session,
        findUserById: async () => ({ id: 'student-1', discordId: 'member-discord' })
    });

    const nonOwnerReq = { params: { sessionId: 'session-1' }, user: { id: 'student-1' } };
    const nonOwnerResult = await invokeMiddleware(requireSessionMentorOwner, nonOwnerReq);

    assert.equal(nonOwnerResult.nextCalled, false);
    assert.equal(nonOwnerResult.res.statusCode, 403);
});
