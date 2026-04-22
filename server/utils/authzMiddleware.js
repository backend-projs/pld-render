const sessionModel = require('../models/sessionModel');
const userModel = require('../models/userModel');

function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        return next();
    };
}

function extractSessionId(req) {
    return req?.params?.sessionId
        || req?.params?.id
        || req?.query?.sessionId
        || req?.query?.id
        || req?.body?.sessionId
        || req?.body?.id
        || null;
}

function extractStudentId(req) {
    return req?.params?.studentId
        || req?.query?.studentId
        || req?.body?.studentId
        || null;
}

function normalizeDiscord(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function resolveSessionAccess(req) {
    const sessionId = extractSessionId(req);
    if (!sessionId) {
        return { error: { status: 400, body: { error: 'Session ID is required' } } };
    }

    const session = await sessionModel.getSessionById(sessionId);
    if (!session) {
        return { error: { status: 404, body: { error: 'Session not found' } } };
    }

    const userId = req?.user?.id;
    const isMentorOwner = Boolean(userId && session.mentorId === userId);

    let canonicalDiscordId = '';
    if (!isMentorOwner && userId) {
        const user = await userModel.findUserById(userId);
        canonicalDiscordId = normalizeDiscord(user?.discordId);
    }

    const students = Array.isArray(session.students) ? session.students : [];
    const isStudentMember = Boolean(
        canonicalDiscordId && students.some((student) => {
            const discord = normalizeDiscord(student?.discord);
            return discord === canonicalDiscordId;
        })
    );

    return {
        sessionId,
        session,
        isMentorOwner,
        isStudentMember,
        canonicalDiscordId,
        isSessionMemberOrMentor: isMentorOwner || isStudentMember
    };
}

async function requireSessionMemberOrMentor(req, res, next) {
    const authz = await resolveSessionAccess(req);
    if (authz.error) {
        return res.status(authz.error.status).json(authz.error.body);
    }

    req.authz = authz;

    if (!authz.isSessionMemberOrMentor) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
}

async function requireSessionMentorOwner(req, res, next) {
    const authz = await resolveSessionAccess(req);
    if (authz.error) {
        return res.status(authz.error.status).json(authz.error.body);
    }

    req.authz = authz;

    if (!authz.isMentorOwner) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
}

async function requireChatAccess(req, res, next) {
    const authz = await resolveSessionAccess(req);
    if (authz.error) {
        return res.status(authz.error.status).json(authz.error.body);
    }

    if (!authz.isSessionMemberOrMentor) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const targetStudentId = extractStudentId(req);
    if (!targetStudentId) {
        return res.status(400).json({ error: 'Student ID is required' });
    }

    const students = Array.isArray(authz.session?.students) ? authz.session.students : [];
    const targetStudent = students.find((student) => student?.id === targetStudentId);

    if (!targetStudent) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (authz.isMentorOwner) {
        req.authz = {
            ...authz,
            targetStudentId,
            targetStudent
        };
        return next();
    }

    const targetDiscord = normalizeDiscord(targetStudent.discord);
    if (!targetDiscord || targetDiscord !== authz.canonicalDiscordId) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    req.authz = {
        ...authz,
        targetStudentId,
        targetStudent
    };
    return next();
}

module.exports = {
    requireRole,
    resolveSessionAccess,
    requireSessionMemberOrMentor,
    requireSessionMentorOwner,
    requireChatAccess
};
