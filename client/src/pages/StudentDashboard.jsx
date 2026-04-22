// client/src/pages/StudentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { getSessions, getJoinableSessions, joinSession, getAnnouncements, updateUserProfile } from '../api';
import { Calendar, BookOpen, Clock, ChevronRight, Award, Brain, ChevronDown, ChevronUp, CheckCircle, BookMarked, Megaphone } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import './StudentDashboard.css';

export default function StudentDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [joinableSessions, setJoinableSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [expanded, setExpanded] = useState({});
    const toast = useToast();
    const [announcements, setAnnouncements] = useState([]);

    // PLD Preferences State
    const [pldDay, setPldDay] = useState(user?.pld_day || '');
    const [pldTime, setPldTime] = useState(user?.pld_time || '');

    useEffect(() => {
        if (user && user.role === 'student') {
            if (!user.major || user.major === 'Undeclared') {
                navigate('/declare-major');
            } else {
                setPldDay(user.pld_day || '');
                setPldTime(user.pld_time || '');
                fetchData();
            }
        }
    }, [user, navigate]);

    const fetchData = async () => {
        try {
            const [data, joinableData, annData] = await Promise.all([
                getSessions(),
                getJoinableSessions(),
                getAnnouncements()
            ]);

            if (Array.isArray(data)) {
                const sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setSessions(sorted);
            }
            if (Array.isArray(joinableData)) {
                setJoinableSessions(joinableData);
            }
            if (Array.isArray(annData)) {
                setAnnouncements(annData.slice(0, 3));
            }
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (id) => {
        try {
            await joinSession(id);
            toast.success("Successfully joined the session!");
            fetchData(); // Refresh both lists
        } catch (err) {
            toast.error(err.message || "Failed to join session");
        }
    };

    const handleSavePreferences = async () => {
        setSavingPrefs(true);
        try {
            await updateUserProfile({ pldDay, pldTime });
            toast.success("PLD Availability preferences saved!");
        } catch (err) {
            toast.error(err.message || 'Failed to save preferences');
        } finally {
            setSavingPrefs(false);
        }
    };

    const getMyData = (session) => {
        if (!user || !session.students) return null;
        const searchKey = user.discordId || user.username;
        if (!searchKey) return null;
        return session.students.find(s =>
            s.discord && s.discord.toLowerCase() === searchKey.toLowerCase()
        );
    };

    const toggleExpand = (sessionId) => {
        setExpanded(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
    };

    // Computed stats
    const mySessions = sessions.filter(s => getMyData(s));
    const attendedCount = mySessions.filter(s => getMyData(s)?.status === 'present').length;
    const gradesArr = mySessions.map(s => getMyData(s)?.grade).filter(g => g && g > 0);
    const avgGrade = gradesArr.length > 0 ? (gradesArr.reduce((a, b) => a + b, 0) / gradesArr.length).toFixed(1) : '—';
    const topicsCovered = [...new Set(mySessions.map(s => s.topicName).filter(Boolean))];

    // Helper: Check if a time slot has elapsed (plus 1 hour) in the current week.
    // Assuming week starts on Sunday (0).
    const isSlotExpiredForThisWeek = (dayStr, timeStr) => {
        const days = { "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6 };
        const targetDay = days[dayStr];
        const now = new Date();
        const currentDay = now.getDay();

        // If today is Mon or Tue, it's a new week for Wed/Thu sessions, so nothing is expired
        if (currentDay < 3) return false;

        let targetDate = new Date();
        let [hours, minutes] = timeStr.split(':').map(Number);
        targetDate.setHours(hours, minutes, 0, 0);

        let dayDiff = targetDay - currentDay;
        targetDate.setDate(targetDate.getDate() + dayDiff);

        // Add 1 hour to the scheduled time
        targetDate.setHours(targetDate.getHours() + 1);

        // If the calculated target date for THIS week is in the past, it's expired
        return now > targetDate;
    };

    if (loading) {
        return (
            <div className="flex-center" style={{ height: '50vh', flexDirection: 'column' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading your dashboard...</p>
            </div>
        );
    }

    const activeSessions = sessions
        .filter(s => {
            if (s.status === 'completed' || !getMyData(s)) return false;
            // Hide sessions that are older than 1 hour past their scheduled start time
            if (s.scheduled_date) {
                const scheduledTime = new Date(s.scheduled_date).getTime();
                const now = new Date().getTime();
                if (now - scheduledTime > 3600000) { // 3600000 ms = 1 hour
                    return false;
                }
            }
            return true;
        })
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return (
        <div>
            {/* Welcome Banner */}
            <div className="student-welcome-banner">
                <h1>Welcome back, {user?.username}! 👋</h1>
                <p className="student-welcome-subtitle">Ready for some peer learning? Here's your overview.</p>
            </div>

            {/* Stats Row */}
            <div className="student-stats-row">
                <div className="student-stat-card">
                    <div className="stat-icon-wrap blue">
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>{attendedCount}</h3>
                        <p>Sessions Attended</p>
                    </div>
                </div>
                <div className="student-stat-card">
                    <div className="stat-icon-wrap green">
                        <Award size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>{avgGrade}</h3>
                        <p>Average Grade</p>
                    </div>
                </div>
                <div className="student-stat-card">
                    <div className="stat-icon-wrap purple">
                        <BookMarked size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>{topicsCovered.length}</h3>
                        <p>Topics Covered</p>
                    </div>
                </div>
            </div>

            {/* AI Practice Banner */}
            <div className="student-ai-banner" onClick={() => navigate('/practice')}>
                <div className="ai-banner-content">
                    <div className="ai-banner-icon">
                        <Brain size={28} />
                    </div>
                    <div className="ai-banner-text">
                        <h2>AI Practice Mode</h2>
                        <p>Test your knowledge and level up your skills with our AI tutor.</p>
                    </div>
                </div>
                <button className="ai-banner-btn">Start Now</button>
            </div>

            {/* PLD Availability Preferences */}
            <div className="student-prefs-card">
                <div className="prefs-header">
                    <div className="prefs-icon">
                        <Clock size={24} />
                    </div>
                    <div>
                        <h3>Set Your PLD Availability</h3>
                        <p>Select when you are available for Peer Learning Days. Groups will be created based on these preferences.</p>
                    </div>
                </div>

                <div className="prefs-controls">
                    <div className="prefs-select-wrapper">
                        <label>Preferred Session Block</label>
                        <select
                            className="student-prefs-select"
                            value={pldDay && pldTime ? `${pldDay}|${pldTime}` : ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                    const [day, time] = val.split('|');
                                    setPldDay(day);
                                    setPldTime(time);
                                } else {
                                    setPldDay('');
                                    setPldTime('');
                                }
                            }}
                        >
                            <option value="">-- Select Available Time --</option>
                            <option value="Wednesday|10:00" disabled={isSlotExpiredForThisWeek('Wednesday', '10:00')}>
                                Wednesday at 10:00 {isSlotExpiredForThisWeek('Wednesday', '10:00') ? '(Ended)' : ''}
                            </option>
                            <option value="Wednesday|15:30" disabled={isSlotExpiredForThisWeek('Wednesday', '15:30')}>
                                Wednesday at 15:30 {isSlotExpiredForThisWeek('Wednesday', '15:30') ? '(Ended)' : ''}
                            </option>
                            <option value="Thursday|10:00" disabled={isSlotExpiredForThisWeek('Thursday', '10:00')}>
                                Thursday at 10:00 {isSlotExpiredForThisWeek('Thursday', '10:00') ? '(Ended)' : ''}
                            </option>
                            <option value="Thursday|15:30" disabled={isSlotExpiredForThisWeek('Thursday', '15:30')}>
                                Thursday at 15:30 {isSlotExpiredForThisWeek('Thursday', '15:30') ? '(Ended)' : ''}
                            </option>
                        </select>
                    </div>
                    <button
                        className="student-prefs-btn"
                        onClick={handleSavePreferences}
                        disabled={savingPrefs || !pldDay || !pldTime}
                    >
                        {savingPrefs ? 'Saving...' : 'Save Preferences'}
                    </button>
                </div>
                {user?.pld_day && user?.pld_time && (
                    <div className="prefs-active-badge">
                        <CheckCircle size={15} />
                        <span>Current Preference: <strong>{user.pld_day}s at {user.pld_time}</strong></span>
                    </div>
                )}
            </div>

            {/* Announcements Mini Card */}
            {announcements.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h2 className="student-section-heading">
                        <span className="accent-dot" style={{ background: '#ef4444' }}></span>
                        <Megaphone size={17} style={{ marginRight: 6 }} /> Latest Announcements
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {announcements.map(ann => (
                            <div key={ann.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '1rem 1.25rem' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>{ann.title}</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {ann.message.length > 150 ? ann.message.slice(0, 150) + '…' : ann.message}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6, marginTop: 6 }}>— {ann.mentor_name}</div>
                            </div>
                        ))}
                    </div>
                    <Link to="/announcements" style={{ fontSize: '0.85rem', color: '#ef4444', textDecoration: 'none', display: 'inline-block', marginTop: 10 }}>
                        View all announcements →
                    </Link>
                </div>
            )}

            {/* Active & Future Sessions */}
            <div className="student-content-grid">
                {/* Active Sessions */}
                <h2 className="student-section-heading">
                    <span className="accent-dot"></span>
                    Active PLDs
                </h2>

                {activeSessions.length > 0 ? (
                    <div className="student-active-sessions">
                        {activeSessions.map(session => {
                            const isWorkshop = session.groupName && session.groupName.startsWith('[WORKSHOP]');
                            return (
                                <div key={session.id} className="student-session-card">
                                    <h3>{isWorkshop ? session.groupName.replace('[WORKSHOP] ', '') : session.groupName}</h3>
                                    <p className="session-topic">Topic: {session.topicName || (isWorkshop ? 'Interactive Workshop' : 'PLD Session')}</p>
                                    <Link 
                                        to={isWorkshop ? `/workshop/${session.id}` : `/session/${session.id}`} 
                                        className="btn-enter-session"
                                        style={isWorkshop ? { background: 'var(--color-primary)' } : {}}
                                    >
                                        {isWorkshop ? 'Enter Workshop' : 'Enter Session'}
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="student-empty-state">
                        No active sessions found.
                    </div>
                )}

                {/* Joinable Sessions */}
                <h2 className="student-section-heading" style={{ marginTop: '2.5rem' }}>
                    <span className="accent-dot blue-dot"></span>
                    Available Future Sessions
                </h2>
                {joinableSessions.length > 0 ? (
                    <div className="student-joinable-list">
                        {joinableSessions.map(session => (
                            <div key={session.id} className="joinable-session-card">
                                <div className="joinable-info">
                                    <h4>{session.groupName}</h4>
                                    <div className="joinable-meta">
                                        <Calendar size={13} />
                                        <span>{new Date(session.createdAt).toLocaleDateString()} at {session.scheduled_date ? new Date(session.scheduled_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '10:00 AM'}</span>
                                    </div>
                                    <div className="joinable-topics">
                                        {session.topicNames?.map((topic, i) => (
                                            <span key={i} className="tiny-topic">{topic}</span>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    className="btn-join-session"
                                    onClick={() => handleJoin(session.id)}
                                >
                                    Join
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="student-empty-state">
                        No sessions available for joining.
                    </div>
                )}
            </div>
        </div>
    );
}

