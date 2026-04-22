// client/src/api.js
import axios from 'axios';
import { isTokenExpiringSoon } from './utils/tokenUtils';

// In development, we use a Vite proxy to avoid CORS/Cookie issues between ports.
// In production, we use the VITE_API_URL environment variable.
const API_URL = ''; 

// Create Axios instance
const api = axios.create({
    baseURL: API_URL, 
    withCredentials: true, // Crucial for sending/receiving refresh token cookie
    headers: {
        'Content-Type': 'application/json'
    }
});

let accessToken = null; // Internal module state
let isRefreshing = false;
let failedQueue = [];

/**
 * Update the internal access token and axios defaults.
 * Called by AuthContext to keep them in sync.
 */
export const setAccessToken = (token) => {
    accessToken = token;
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }
};

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Request Interceptor: Add Token and Proactive Refresh
api.interceptors.request.use(
    async (config) => {
        // Skip for refresh-token requests to avoid infinite loops
        if (config.url.includes('/auth/refresh-token')) {
            return config;
        }

        const token = accessToken; // Use internal module state
        const wasLoggedIn = localStorage.getItem('wasLoggedIn') === 'true';
        
        const isAdmin = sessionStorage.getItem('adminAuth') === 'true';
        const adminPass = import.meta.env.VITE_ADMIN_PASSWORD;

        if (isAdmin && adminPass) {
            config.headers['x-admin-password'] = adminPass;
        }


        // Proactive Refresh: 
        // 1. If token is missing but user was previously logged in (Optimistic UI case)
        // 2. OR if token exists but is expiring soon
        const needsRefresh = (!token && wasLoggedIn) || (token && isTokenExpiringSoon(token));

        if (needsRefresh && !config._retry) {
            try {
                const newToken = await refreshToken();
                
                if (newToken) {
                    config.headers['Authorization'] = `Bearer ${newToken}`;
                }
            } catch (err) {
                console.warn("[API] Proactive refresh attempt finished:", err.message);
                // If it fails, we let it proceed so the server can return 401 or the response interceptor can handle it.
            }
        } else if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401s Reactively
api.interceptors.response.use(
    (response) => response.data,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/refresh-token')) {
            originalRequest._retry = true;
            
            try {
                // Wait for the queue if a refresh is already in progress
                const newToken = await refreshToken();
                if (!newToken) throw new Error("No access token in refresh response");

                originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
                return api(originalRequest);
            } catch (refreshError) {
                // window.logoutUser?.() will be called internally by refreshToken on 401/403
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// Auth API
export const registerUser = (userData) => api.post('/api/auth/register', userData);
export const loginUser = (credentials) => api.post('/api/auth/login', credentials);

/**
 * Unified Refresh Token Logic
 * Handles locking, queuing, and state updates.
 * Returns the access token string on success.
 */
let refreshPromise = null;

export const refreshToken = async () => {
    if (isRefreshing && refreshPromise) {
        console.log('[AUTH CLIENT] Refresh already in progress. Queueing...');
        return refreshPromise;
    }

    console.log('[AUTH CLIENT] Starting silent refresh attempt...');
    isRefreshing = true;

    refreshPromise = new Promise(async (resolve, reject) => {
        try {
            const response = await api.post('/api/auth/refresh-token', {}, { _retry: true });
            // Handle both standard axios response.data and my interceptor's auto-extraction
            const newToken = response?.accessToken || response?.data?.accessToken;

            if (!newToken) throw new Error("No access token in refresh response");

            console.log('[AUTH CLIENT] Silent refresh SUCCESS.');
            // Sync with internal and React state
            setAccessToken(newToken);
            if (window.setAccessToken) window.setAccessToken(newToken);

            isRefreshing = false;
            refreshPromise = null;
            resolve(newToken); // Return the string!
        } catch (err) {
            isRefreshing = false;
            refreshPromise = null;

            // Break any infinite loop if refresh token itself is invalid
            if (err.response?.status === 401 || err.response?.status === 403) {
                 console.warn('[AUTH CLIENT] Refresh token rejected. Logging out...');
                 if (window.logoutUser) window.logoutUser();
            }

            reject(err);
        }
    });

    return refreshPromise;
};
export const logoutUser = () => api.post('/api/auth/logout');
export const requestPasswordReset = (discordUsername) => api.post('/api/auth/request-password-reset', { discordUsername });
export const resetPassword = (discordUsername, code, newPassword) => api.post('/api/auth/reset-password', { discordUsername, code, newPassword });

// Legacy/Compatibility Discord routes (usually prefix with /api or move them)
export const sendVerificationCode = (discordUsername) => api.post('/register', { discordUsername });
export const verifyDiscordCode = (discordUsername, code) => api.post('/verify', { discordUsername, code });

// Sessions API
export const getSessions = () => api.get('/api/sessions');
export const getSession = (id) => api.get(`/api/sessions/${id}`);
export const getJoinableSessions = () => api.get('/api/sessions/joinable');
export const joinSession = (id) => api.post(`/api/sessions/${id}/join`);
export const createSession = (sessionData) => api.post('/api/sessions', sessionData);
export const updateSession = (id, sessionData) => api.put(`/api/sessions/${id}`, sessionData);
export const deleteSession = (id) => api.delete(`/api/sessions/${id}`);
export const removeSessionStudent = (sessionId, studentId) => api.delete(`/api/sessions/${sessionId}/students/${studentId}`);
export const deleteAllSessions = () => api.delete('/api/sessions/all');
export const endSession = (sessionId) => api.post(`/api/sessions/${sessionId}/end`);
export const saveStudentNotes = (sessionId, studentId, notes) => api.put(`/api/sessions/${sessionId}/students/${studentId}/notes`, { notes });
export const saveStudentGrade = (sessionId, studentId, grade) => api.put(`/api/sessions/${sessionId}/students/${studentId}/grade`, { grade });
export const saveStudentQuestions = (sessionId, studentId, { answered, incorrect }) => api.put(`/api/sessions/${sessionId}/students/${studentId}/questions`, { answered, incorrect });
export const saveStudentResult = (sessionId, studentId, result) => api.put(`/api/sessions/${sessionId}/students/${studentId}/result`, { result });
export const toggleWorkshopPermission = (sessionId, studentId, hasWorkshopPermission) => api.post(`/api/sessions/${sessionId}/students/${studentId}/permission`, { hasWorkshopPermission });
export const updateWorkshopCode = (sessionId, codeData) => api.put(`/api/sessions/${sessionId}/workshop-code`, codeData);
export const submitWorkshopCode = (sessionId, studentId, submissionData) => api.post(`/api/sessions/${sessionId}/students/${studentId}/submit-code`, submissionData);
export const addSessionStudent = (sessionId, identifier) => api.post(`/api/sessions/${sessionId}/students`, { identifier });

// AI API
export const evaluateCode = (payload) => api.post('/api/ai/evaluate', payload);
export const tutorReview = (payload) => api.post('/api/ai/tutor-review', payload);

export const toggleStudentStatus = (sessionId, studentId, status) => api.put(`/api/sessions/${sessionId}/students/${studentId}/status`, { status });
export const sendToDiscord = (sessionId, studentId) => api.post(`/api/sessions/${sessionId}/students/${studentId}/send`);
export const sendAllToDiscord = (sessionId) => api.post(`/api/sessions/${sessionId}/send-all`);

// Students API
export const getMasterStudents = () => api.get('/api/students');
export const addMasterStudent = (studentData) => api.post('/api/students', studentData);
export const bulkAddMasterStudents = (students) => api.post('/api/students/bulk', { students });
export const updateMasterStudent = (id, studentData) => api.put(`/api/students/${id}`, studentData);
export const deleteMasterStudent = (id) => api.delete(`/api/students/${id}`);
export const deleteAllMasterStudents = (ids) => api.delete('/api/students/all', { data: { ids } });

// Questions API
export const getQuestionSets = () => api.get('/api/questions');
export const addQuestionSet = (setData) => api.post('/api/questions', setData);
export const updateQuestionSet = (id, setData) => api.put(`/api/questions/${id}`, setData);
export const shareQuestionSet = (id, targetMentorIds) => api.put(`/api/questions/${id}/share`, { targetMentorIds });
export const getMentors = () => api.get('/api/users/mentors');
export const deleteQuestionSet = (id) => api.delete(`/api/questions/${id}`);
export const deleteAllQuestionSets = () => api.delete('/api/questions/all');

// Leaderboard API
export const getLeaderboard = (major = null) => {
    const url = major
        ? `/api/sessions/stats/leaderboard?major=${encodeURIComponent(major)}`
        : '/api/sessions/stats/leaderboard';
    return api.get(url);
};

// Admin API
export const getAdminUsers = () => api.get('/api/users/admin');
export const deleteUserAccount = (id) => api.delete(`/api/users/admin/${id}`);

// Majors API
export const getMajors = () => api.get('/api/majors');
export const addMajor = (name) => api.post('/api/majors', { name });
export const deleteMajor = (id) => api.delete(`/api/majors/${id}`);

// Profile API
export const getUserProfile = () => api.get('/api/profile');
export const updateUserProfile = (profileData) => api.put('/api/profile', profileData);
export const updateAvatar = (avatar) => api.put('/api/profile/avatar', { avatar });
export const changePassword = (passwords) => api.put('/api/profile/change-password', passwords);

// Announcements API
export const getAnnouncements = () => api.get('/api/announcements');
export const createAnnouncement = (data) => api.post('/api/announcements', data);
export const deleteAnnouncement = (id) => api.delete(`/api/announcements/${id}`);
export const notifyGroups = (payload) => api.post('/api/announcements/notify-groups', payload);

export default api;
