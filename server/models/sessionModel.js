// server/models/sessionModel.js
const { supabase } = require('./db');
const { v4: uuidv4 } = require('uuid');

async function createSession(mentorId, groupName, studentsData = [], topicIds = [], customDate = null, scheduledTime = null, scheduledDate = null, sessionMajor = 'General', customQuestions = []) {
    // studentsData = [{ name, discord }]
    const students = (studentsData || []).map(s => ({
        id: uuidv4(),
        name: s.name,
        discord: s.discord,
        major: s.major || '',
        notes: '',
        grade: 0, // Default grade
        status: 'present', // Default status
        result: null, // AI result
        submissions: {}, // Per-question submissions { [index]: { code, language, output, feedback } }
        answeredQuestions: [], // Tracking covered questions IDs
        incorrectQuestions: [] // Tracking incorrect questions IDs
    }));

    // topicIds is expected to be an array
    const ids = Array.isArray(topicIds) ? topicIds.filter(Boolean) : [topicIds].filter(Boolean);

    let allQuestions = [];
    let topicNames = [];

    if (ids.length > 0) {
        // Fetch snapshot of questions from all selected topic sets
        const { data: selectedSets } = await supabase.from('questions').select('*').in('id', ids);

        // Aggregate questions and topic names
        (selectedSets || []).forEach(set => {
            if (set.questions) {
                // Add topic context to each question for better UI inside the session
                const contextQuestions = set.questions.map(q => ({
                    ...(typeof q === 'string' ? { text: q } : q),
                    topicName: set.topic
                }));
                allQuestions = [...allQuestions, ...contextQuestions];
            }
            topicNames.push(set.topic);
        });
    }

    if (customQuestions && customQuestions.length > 0) {
        const mappedCustom = customQuestions.map(q => ({
            text: q.body || q.text || '',
            topicName: q.title || 'Custom Task'
        }));
        allQuestions = [...allQuestions, ...mappedCustom];
        topicNames.push('Custom');
    }

    // Build the scheduled_date by combining date + time
    let finalScheduledDate = null;
    if (scheduledDate) {
        finalScheduledDate = scheduledDate; // Already an ISO string from random groups
    } else if (customDate && scheduledTime) {
        // Manual creation: combine date string + time string  
        const dateObj = new Date(customDate);
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            dateObj.setHours(hours, minutes, 0, 0);
        }
        finalScheduledDate = dateObj.toISOString();
    } else if (customDate) {
        finalScheduledDate = new Date(customDate).toISOString();
    } else {
        finalScheduledDate = new Date().toISOString();
    }

    const session = {
        id: uuidv4(),
        mentorId,
        groupName,
        topicIds: ids,
        topicNames: topicNames, // Array of selected topic names
        topicName: topicNames.join(', '), // Comma separated string for backward compatibility/simpler display
        major: sessionMajor, // Store the explicitly passed major
        questions: allQuestions, // Combined snapshot of questions
        status: 'active', // active, completed
        createdAt: customDate || new Date().toISOString(),
        scheduled_date: finalScheduledDate,
        notified: false,
        students,
        workshop_data: {
            code: '# Write Python here\n',
            language: 'python',
            updatedAt: new Date().toISOString(),
            updatedBy: mentorId,
            questionIndex: 0
        }
    };

    const { data, error } = await supabase.from('sessions').insert([session]).select().single();
    if (error) {
        console.error("Error creating session:", error);
        throw error;
    }
    return data;
}

async function joinSession(sessionId, studentData) {
    const { data: session, error: getError } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (getError || !session) throw new Error('Session not found');

    // Check if student already joined (by discord handle)
    const students = session.students || [];
    const exists = students.find(s => s.discord && s.discord.toLowerCase() === studentData.discord.toLowerCase());
    if (exists) return session;

    const newStudent = {
        id: uuidv4(),
        name: studentData.name,
        discord: studentData.discord,
        major: studentData.major || '',
        notes: '',
        grade: 0,
        status: 'present',
        result: null,
        submissions: {},
        answeredQuestions: [],
        incorrectQuestions: []
    };

    students.push(newStudent);

    const { data, error } = await supabase.from('sessions').update({ students }).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error joining session:", error);
        throw error;
    }
    return data;
}

async function addStudentToSession(sessionId, studentData) {
    const { data: session, error: getError } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (getError || !session) throw new Error('Session not found');

    const students = session.students || [];
    const exists = students.find(s => s.discord && s.discord.toLowerCase() === studentData.discord.toLowerCase());
    if (exists) throw new Error('Student already in session');

    const newStudent = {
        id: uuidv4(),
        name: studentData.name,
        discord: studentData.discord,
        major: studentData.major || '',
        notes: '',
        grade: 0,
        status: 'present',
        result: null,
        submissions: {},
        hasWorkshopPermission: false,
        answeredQuestions: [],
        incorrectQuestions: []
    };

    students.push(newStudent);

    const { data, error } = await supabase.from('sessions').update({ students }).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error adding student to session:", error);
        throw error;
    }
    return data;
}

async function getSessionsByMentor(mentorId, mentorMajors) {
    if (!mentorMajors || mentorMajors.length === 0) {
        // Fallback for mentors without assigned majors
        const { data, error } = await supabase.from('sessions').select('*').eq('mentorId', mentorId);
        if (error) console.error("Error getting sessions by mentor:", error);
        return data || [];
    }

    // Two queries are safer for Supabase OR logic when using .in()
    const { data: mine, error: err1 } = await supabase.from('sessions').select('*').eq('mentorId', mentorId);
    if (err1) console.error("Error getting sessions by mentor (mine):", err1);

    const { data: shared, error: err2 } = await supabase.from('sessions').select('*').in('major', mentorMajors);
    if (err2) console.error("Error getting sessions by mentor (shared majors):", err2);

    // Merge and deduplicate
    const allSessions = [...(mine || []), ...(shared || [])];
    const uniqueSessionsMap = new Map();
    allSessions.forEach(s => uniqueSessionsMap.set(s.id, s));

    return Array.from(uniqueSessionsMap.values());
}

async function getSessionsForStudent(username) {
    const { data: sessions, error } = await supabase.from('sessions').select('*');
    if (error) {
        console.error("Error getting sessions for student:", error);
        return [];
    }

    return sessions.filter(session => (session.students || []).some(s => s.discord && s.discord.toLowerCase() === username.toLowerCase()));
}

async function getJoinableSessions(username, studentMajor) {
    const now = new Date();
    const { data: sessions, error } = await supabase.from('sessions').select('*');
    if (error) {
        console.error("Error getting joinable sessions:", error);
        return [];
    }

    return sessions.filter(session => {
        const isFuture = new Date(session.createdAt) >= new Date(now.setHours(0, 0, 0, 0));
        const isCompleted = session.status === 'completed';
        const alreadyJoined = (session.students || []).some(s => s.discord && s.discord.toLowerCase() === username.toLowerCase());

        let majorMatches = true;
        if (studentMajor && studentMajor !== 'Undeclared') {
            // Allow joining if session major is general/unspecified, or matches student's major
            majorMatches = !session.major || session.major === 'General' || session.major === studentMajor;
        }

        return isFuture && !isCompleted && !alreadyJoined && majorMatches;
    });
}

async function getSessionById(id) {
    const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
    if (error) console.error("Error getting session by id:", error);
    return data;
}

async function updateStudentNote(sessionId, studentId, noteContent) {
    const { data: session, error: fetchErr } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (fetchErr || !session) return null;

    const students = session.students || [];
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex === -1) return null;

    students[studentIndex].notes = noteContent;

    const { data, error } = await supabase.from('sessions').update({ students }).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error updating student note:", error);
        return null;
    }
    return students[studentIndex];
}

async function updateStudentResult(sessionId, studentId, resultSummary) {
    const { data: session, error: fetchErr } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (fetchErr || !session) return null;

    const students = session.students || [];
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex === -1) return null;

    students[studentIndex].result = resultSummary;

    const { data, error } = await supabase.from('sessions').update({ students }).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error updating student result:", error);
        return null;
    }
    return students[studentIndex];
}

async function updateStudentSubmission(sessionId, studentId, questionIndex, submissionData) {
    const { data: session, error: fetchErr } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (fetchErr || !session) return null;

    const students = session.students || [];
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex === -1) return null;

    if (!students[studentIndex].submissions) {
        students[studentIndex].submissions = {};
    }

    students[studentIndex].submissions[questionIndex] = {
        ...(students[studentIndex].submissions[questionIndex] || {}),
        ...submissionData
    };

    // Also update the global result if feedback is provided (for backward compatibility/mentor view)
    if (submissionData.feedback) {
        students[studentIndex].result = submissionData.feedback;
    }

    const { data, error } = await supabase.from('sessions').update({ students }).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error updating student submission:", error);
        return null;
    }
    return students[studentIndex];
}

async function updateStudentQuestions(sessionId, studentId, { answered, incorrect }) {
    const { data: session, error: fetchErr } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (fetchErr || !session) return null;

    const students = session.students || [];
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex === -1) return null;

    if (answered) students[studentIndex].answeredQuestions = answered;
    if (incorrect) students[studentIndex].incorrectQuestions = incorrect;

    const { data, error } = await supabase.from('sessions').update({ students }).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error updating student questions:", error);
        return null;
    }
    return students[studentIndex];
}

async function completeSession(sessionId) {
    const { data, error } = await supabase.from('sessions').update({ status: 'completed' }).eq('id', sessionId).select().single();
    if (error) console.error("Error completing session:", error);
    return data;
}

async function deleteSession(sessionId) {
    const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
    if (error) console.error("Error deleting session:", error);
    return !error;
}

async function deleteAllSessions(mentorId) {
    const { error } = await supabase.from('sessions').delete().eq('mentorId', mentorId);
    if (error) console.error("Error deleting all sessions:", error);
    return !error;
}

async function updateStudentStatus(sessionId, studentId, status) {
    const { data: session, error: fetchErr } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (fetchErr || !session) return null;

    const students = session.students || [];
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex === -1) return null;

    students[studentIndex].status = status;

    const { data, error } = await supabase.from('sessions').update({ students }).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error updating student status:", error);
        return null;
    }
    return students[studentIndex];
}

async function updateStudentGrade(sessionId, studentId, grade) {
    const { data: session, error: fetchErr } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (fetchErr || !session) return null;

    const students = session.students || [];
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex === -1) return null;

    students[studentIndex].grade = grade;

    const { data, error } = await supabase.from('sessions').update({ students }).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error updating student grade:", error);
        return null;
    }
    return students[studentIndex];
}

async function removeStudentFromSession(sessionId, studentId) {
    const { data: session, error: fetchErr } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (fetchErr || !session) return null;

    const students = session.students || [];
    const newStudents = students.filter(s => s.id !== studentId);

    // If no students left, maybe we shouldn't delete the session, but just leave it empty.
    const { data, error } = await supabase.from('sessions').update({ students: newStudents }).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error removing student from session:", error);
        return null;
    }
    return data;
}

async function getSessionsToNotify(thresholdISOString) {
    // Find sessions that are scheduled between now and the threshold (now + 5 min)
    // This prevents notifying sessions whose time has long passed
    const nowISO = new Date().toISOString();
    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'active')
        .eq('notified', false)
        .gte('scheduled_date', nowISO)          // scheduled_date >= now (hasn't started yet)
        .lte('scheduled_date', thresholdISOString);  // scheduled_date <= now + 5 min
    if (error) {
        console.error("Error fetching sessions to notify:", error);
        return [];
    }
    return data || [];
}

async function markSessionNotified(sessionId) {
    const { data, error } = await supabase
        .from('sessions')
        .update({ notified: true })
        .eq('id', sessionId);
    if (error) {
        console.error("Error marking session notified:", error);
    }
    return data;
}

async function getLeaderboard(major = null) {
    const { data: sessions, error } = await supabase.from('sessions').select('students, major').eq('status', 'completed');
    if (error) {
        console.error("Error getting leaderboard sessions:", error);
        return [];
    }

    const studentStats = {};

    sessions.forEach(session => {
        if (!session.students) return;

        // If major filter is provided, only include sessions matching that major
        if (major && session.major && session.major.toLowerCase() !== major.toLowerCase()) return;

        session.students.forEach(student => {
            if (!student.discord || student.status === 'absent') return;
            const grade = student.grade || 0;
            if (grade === 0) return; // Skip ungraded

            // If major filter provided, also filter by student's own major
            if (major && student.major && student.major.toLowerCase() !== major.toLowerCase()) return;

            const key = student.discord.toLowerCase();
            if (!studentStats[key]) {
                studentStats[key] = {
                    name: student.name,
                    discord: student.discord,
                    major: student.major || session.major || 'General',
                    totalGrade: 0,
                    sessionsCount: 0,
                    grades: []
                };
            }
            studentStats[key].totalGrade += grade;
            studentStats[key].sessionsCount += 1;
            studentStats[key].grades.push(grade);
        });
    });

    const leaderboardStudents = Object.values(studentStats);

    // Calculate global metrics for Bayesian Average
    let totalGlobalGrade = 0;
    let totalGlobalSessions = 0;

    leaderboardStudents.forEach(s => {
        totalGlobalGrade += s.totalGrade;
        totalGlobalSessions += s.sessionsCount;
    });

    // C = global average grade across all students and sessions
    const C = totalGlobalSessions > 0 ? (totalGlobalGrade / totalGlobalSessions) : 0;

    // m = average number of sessions per student
    const m = leaderboardStudents.length > 0 ? (totalGlobalSessions / leaderboardStudents.length) : 0;

    const leaderboard = leaderboardStudents
        .map(s => {
            const v = s.sessionsCount;
            const R = v > 0 ? (s.totalGrade / v) : 0;

            // Bayesian Average Formula: (v / (v + m)) * R + (m / (v + m)) * C
            const bayesianAverage = (v + m) > 0
                ? ((v / (v + m)) * R) + ((m / (v + m)) * C)
                : 0;

            return {
                name: s.name,
                discord: s.discord,
                major: s.major,
                averageGrade: bayesianAverage.toFixed(2),
                sessionsCount: s.sessionsCount,
                totalGrade: s.totalGrade
            };
        })
        .sort((a, b) => parseFloat(b.averageGrade) - parseFloat(a.averageGrade));

    return leaderboard;
}

async function toggleStudentWorkshopPermission(sessionId, studentId, hasPermission) {
    const { data: session, error: fetchErr } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (fetchErr || !session) return null;

    const students = session.students || [];
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex === -1) return null;

    students[studentIndex].hasWorkshopPermission = hasPermission;

    const { data, error } = await supabase.from('sessions').update({ students }).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error updating student workshop permission:", error);
        return null;
    }
    return students[studentIndex];
}

async function updateSession(sessionId, updateData) {
    // If topicIds or customQuestions are updated, we might need to re-generate the questions list
    // However, for simplicity and to avoid overwriting student progress, 
    // we should probably only allow updating basic info or specific fields.
    // The requirement says: "edit an existing workshop session's details (title, description, coding challenges, instructions, expected output, difficulty level, etc.)"
    
    const { data: currentSession, error: fetchErr } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
    if (fetchErr || !currentSession) throw new Error('Session not found');

    const updateFields = {};
    if (updateData.groupName) updateFields.groupName = updateData.groupName;
    if (updateData.major) updateFields.major = updateData.major;
    if (updateData.status) updateFields.status = updateData.status;
    
    // If they want to update questions/challenges
    if (updateData.questions) {
        updateFields.questions = updateData.questions;
    }
    
    if (updateData.topicNames) {
        updateFields.topicNames = updateData.topicNames;
        updateFields.topicName = updateData.topicNames.join(', ');
    }

    if (updateData.scheduled_date) {
        updateFields.scheduled_date = updateData.scheduled_date;
    }

    const { data, error } = await supabase.from('sessions').update(updateFields).eq('id', sessionId).select().single();
    if (error) {
        console.error("Error updating session:", error);
        throw error;
    }
    return data;
}

module.exports = {
    createSession,
    joinSession,
    getSessionsByMentor,
    getSessionsForStudent,
    getJoinableSessions,
    getSessionById,
    updateStudentNote,
    updateStudentResult,
    updateStudentQuestions,
    completeSession,
    deleteSession,
    deleteAllSessions,
    updateStudentStatus,
    updateStudentGrade,
    getLeaderboard,
    removeStudentFromSession,
    getSessionsToNotify,
    markSessionNotified,
    toggleStudentWorkshopPermission,
    updateStudentSubmission,
    addStudentToSession,
    updateWorkshopCode,
    updateSession
};

async function updateWorkshopCode(sessionId, { code, language, questionIndex, updatedBy, updatedByName, lastEditPos }) {
    // Fetch the current session to merge workshop_data
    const { data: currentSession, error: fetchError } = await supabase
        .from('sessions')
        .select('workshop_data')
        .eq('id', sessionId)
        .single();

    if (fetchError) {
        console.error("Error fetching session for workshop code update:", fetchError);
        throw fetchError;
    }

    const existingData = currentSession.workshop_data || {};
    const submissions = existingData.submissions || {};

    const updateData = {
        workshop_data: {
            ...existingData,
            code,
            language,
            questionIndex,
            updatedBy,
            updatedByName,
            lastEditPos,
            updatedAt: new Date().toISOString(),
            submissions: {
                ...submissions,
                [questionIndex]: {
                    code,
                    language,
                    updatedBy,
                    updatedByName,
                    lastEditPos,
                    updatedAt: new Date().toISOString()
                }
            }
        }
    };

    const { data, error } = await supabase
        .from('sessions')
        .update(updateData)
        .eq('id', sessionId)
        .select()
        .single();

    if (error) {
        console.error("Error updating workshop code:", error);
        throw error;
    }
    return data;
}
