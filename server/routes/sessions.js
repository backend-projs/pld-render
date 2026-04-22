// server/routes/sessions.js
const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const authMiddleware = require('../utils/authMiddleware');
const { requireRole, requireSessionMentorOwner } = require('../utils/authzMiddleware');

router.use(authMiddleware);

router.post('/', requireRole('mentor'), sessionController.createSession);
router.get('/', sessionController.getMySessions);
router.get('/joinable', sessionController.getJoinableSessions);
router.post('/:id/join', sessionController.joinSession);
router.post('/:id/students', requireSessionMentorOwner, sessionController.addStudent);
router.get('/:id', sessionController.getSession);
router.put('/:id', requireSessionMentorOwner, sessionController.updateSession);
router.delete('/:sessionId/students/:studentId', sessionController.removeStudent);
router.put('/:sessionId/students/:studentId/notes', requireSessionMentorOwner, sessionController.updateNote);
router.put('/:sessionId/students/:studentId/result', requireSessionMentorOwner, sessionController.saveResult);
router.put('/:sessionId/students/:studentId/grade', requireSessionMentorOwner, sessionController.updateGrade);
router.put('/:sessionId/students/:studentId/questions', requireSessionMentorOwner, sessionController.updateQuestions);
router.put('/:sessionId/students/:studentId/status', requireSessionMentorOwner, sessionController.toggleStatus);
router.post('/:sessionId/students/:studentId/send', requireSessionMentorOwner, sessionController.sendFeedback);
router.post('/:sessionId/send-all', requireSessionMentorOwner, sessionController.sendAllFeedback);
router.delete('/all', requireRole('mentor'), sessionController.deleteAllSessions);
router.delete('/:id', requireSessionMentorOwner, sessionController.deleteSession);
router.post('/:id/end', requireSessionMentorOwner, sessionController.endSession);
router.post('/:sessionId/students/:studentId/submit-code', sessionController.submitCode);
router.post('/:sessionId/students/:studentId/permission', requireSessionMentorOwner, sessionController.toggleStudentWorkshopPermission);
router.get('/stats/leaderboard', sessionController.getLeaderboard);
router.put('/:id/workshop-code', sessionController.updateWorkshopCode);

module.exports = router;
