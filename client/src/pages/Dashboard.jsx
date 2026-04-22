// client/src/pages/Dashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Plus, Users, ArrowRight, Trash2, Calendar, MoreHorizontal, FileText, X, Upload, Clock, HelpCircle, Shuffle } from 'lucide-react';
import { getSessions, createSession, deleteSession, getMasterStudents, getQuestionSets, deleteAllSessions } from '../api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import RandomSessionModal from '../components/RandomSessionModal';
import './Dashboard.css';

export default function Dashboard() {
    const { user } = useAuth();
    const toast = useToast();
    const { confirm } = useConfirm();
    const location = useLocation();
    const navigate = useNavigate();

    // Sessions & Master Data
    const [sessions, setSessions] = useState([]);
    const [masterStudents, setMasterStudents] = useState([]);
    const [questionSets, setQuestionSets] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showRandom, setShowRandom] = useState(false);
    const [majors, setMajors] = useState([]);

    // New Session Form State
    const [groupName, setGroupName] = useState('');
    const [sessionMajor, setSessionMajor] = useState('');
    const [topicIds, setTopicIds] = useState([]);
    const [students, setStudents] = useState([{ name: '', discord: '', major: '' }]);
    const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
    const [scheduledTime, setScheduledTime] = useState('10:00');
    const [searchIndex, setSearchIndex] = useState(-1);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const hasFetched = useRef(false);

    const todayStr = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (!user) return; 
        
        if (!hasFetched.current) {
            fetchSessions();
            fetchMajors();
            hasFetched.current = true;
        }

        if (showCreate) fetchMasterData();
    }, [showCreate, user]);

    useEffect(() => {
        if (location.state?.showCreate) {
            setShowCreate(true);
        } else if (location.state?.returnToSessionCreation) {
            setShowCreate(true);
            const saved = localStorage.getItem('sessionFormData');
            if (saved) {
                try {
                    const formData = JSON.parse(saved);
                    setGroupName(formData.groupName || '');
                    setSessionMajor(formData.sessionMajor || '');
                    setTopicIds(formData.topicIds || []);
                    setStudents(formData.students || [{ name: '', discord: '', major: '' }]);
                    if (formData.scheduledDate) setScheduledDate(formData.scheduledDate);
                    localStorage.removeItem('sessionFormData');
                } catch (err) { console.error('Restore form:', err); }
            }
        } else if (location.state?.scheduledDate) {
            setShowCreate(true);
            setScheduledDate(location.state.scheduledDate >= todayStr ? location.state.scheduledDate : todayStr);
        } else {
            // Reset everything when navigating home without state
            setShowCreate(false);
            setGroupName('');
            setSessionMajor('');
            setTopicIds([]);
            setStudents([{ name: '', discord: '', major: '' }]);
            setScheduledDate(todayStr);
        }
    }, [location]);

    const fetchSessions = async () => {
        try {
            console.log('Fetching sessions...');
            // if (sessions.length === 0) setLoading(true); // Don't block UI if we already have them
            const data = await getSessions();
            console.log('Sessions received:', data?.length);
            if (Array.isArray(data)) setSessions(data.reverse());
            else console.error('Sessions data is not an array:', data);
        } catch (err) { console.error('Fetch sessions failed:', err); }
    };

    const fetchMasterData = async () => {
        try {
            console.log('Fetching master data (students/questions)...');
            const [studentsData, setsData] = await Promise.all([getMasterStudents(), getQuestionSets()]);
            console.log('Master data received:', { students: studentsData?.length, questions: setsData?.length });
            if (Array.isArray(studentsData)) setMasterStudents(studentsData);
            if (Array.isArray(setsData)) setQuestionSets(setsData);
        } catch (err) {
            console.error('Fetch master data failed:', err);
            toast.error("Failed to load students or question sets. Please refresh.");
        }
    };

    const fetchMajors = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/majors`);
            const data = await res.json();
            if (Array.isArray(data)) setMajors(data);
        } catch (err) {
            console.error('Fetch majors error:', err);
        }
    };

    // Calculate performance data from sessions
    const getPerformanceData = () => {
        const completedSessions = sessions.filter(s => s.status === 'completed');

        // Get last 5 sessions (or less if fewer exist)
        const recentSessions = completedSessions.slice(0, 5);

        // Calculate average grade for each session
        const sessionData = recentSessions.map(session => {
            const gradedStudents = session.students?.filter(s => s.grade > 0 && s.status !== 'absent') || [];
            const avgGrade = gradedStudents.length > 0
                ? gradedStudents.reduce((sum, s) => sum + s.grade, 0) / gradedStudents.length
                : 0;
            return {
                name: session.groupName?.substring(0, 10) || 'Session',
                avgGrade: Math.round(avgGrade),
                studentCount: session.students?.length || 0
            };
        }).reverse(); // Oldest to newest

        // Calculate overall stats
        const allGradedStudents = completedSessions.flatMap(s =>
            s.students?.filter(st => st.grade > 0 && st.status !== 'absent') || []
        );
        const overallAvg = allGradedStudents.length > 0
            ? Math.round(allGradedStudents.reduce((sum, s) => sum + s.grade, 0) / allGradedStudents.length)
            : 0;
        const totalStudents = completedSessions.reduce((sum, s) => sum + (s.students?.length || 0), 0);

        return { sessionData, overallAvg, totalStudents, totalSessions: completedSessions.length };
    };

    const performanceData = getPerformanceData();

    // Student handlers
    const handleAddStudentRow = () => setStudents([...students, { name: '', discord: '', major: '' }]);
    const handleRemoveStudentRow = idx => setStudents(students.filter((_, i) => i !== idx).length ? students.filter((_, i) => i !== idx) : [{ name: '', discord: '', major: '' }]);
    const handleStudentChange = (idx, field, value) => {
        const newStudents = [...students];
        newStudents[idx][field] = value;
        setStudents(newStudents);
        if (field === 'name') {
            const filtered = value.trim() ? masterStudents.filter(s => s.name.toLowerCase().includes(value.toLowerCase())) : [];
            setFilteredStudents(filtered);
            setSearchIndex(value.trim() ? idx : -1);
        }
    };
    const selectStudent = (idx, student) => {
        const newStudents = [...students];
        newStudents[idx] = { name: student.name, discord: student.discord, major: student.major || '' };
        setStudents(newStudents);
        setFilteredStudents([]);
        setSearchIndex(-1);
    };

    // Create session handler
    const handleCreateSession = async e => {
        e.preventDefault();
        const isFuture = scheduledDate > todayStr;

        if (!groupName || !topicIds.length || !sessionMajor) {
            return toast.error("Select Group Name, Session Major, and at least one topic first");
        }

        const validStudents = students.filter(s => s.name.trim() && s.discord.trim());
        if (!isFuture && !validStudents.length) {
            return toast.error("Add at least one student for today's session");
        }

        try {
            console.log('Creating session:', { groupName, sessionMajor, topicIds, scheduledDate, scheduledTime });
            const newSession = await createSession({
                groupName,
                major: sessionMajor,
                students: validStudents,
                topicIds,
                createdAt: scheduledDate,
                scheduledTime
            });
            console.log('Session created successfully:', newSession);
            setSessions([newSession, ...sessions]);
            setShowCreate(false);
            setGroupName('');
            setSessionMajor('');
            setTopicIds([]);
            setStudents([{ name: '', discord: '', major: '' }]);
            setScheduledDate(todayStr);
            setScheduledTime('10:00');

            if (!isFuture) {
                navigate(`/session/${newSession.id}`);
            } else {
                toast.success("Future session scheduled successfully!");
            }
        } catch (err) {
            console.error('Create session failed:', err);
            toast.error(err.message || "Failed to create session");
        }
    };

    // CSV upload handler
    const handleCsvUpload = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const text = event.target.result;
                const lines = text.split('\n');
                const seenDiscords = new Set();
                const newStudents = [];
                const startIdx = (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('discord')) ? 1 : 0;
                for (let i = startIdx; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const parts = line.includes(';') ? line.split(';') : line.split(',');
                    const name = parts[0]?.trim();
                    const discord = parts[1]?.trim() || '';
                    const major = parts[2]?.trim() || '';
                    if (discord && seenDiscords.has(discord)) continue;
                    if (name) newStudents.push({ name, discord, major });
                    if (discord) seenDiscords.add(discord);
                }
                if (newStudents.length) {
                    setStudents(newStudents);
                    toast.success(`Loaded ${newStudents.length} students`);
                } else toast.error('No valid data found');
            } catch (err) { toast.error('CSV parse error'); }
            finally { e.target.value = ''; }
        };
        reader.readAsText(file);
    };

    const handleDeleteSession = async id => {
        const isConfirmed = await confirm("Delete this session?");
        if (!isConfirmed) return;
        try {
            await deleteSession(id);
            setSessions(sessions.filter(s => s.id !== id));
        } catch (err) { toast.error("Error deleting session"); }
    };

    const handleDeleteAllSessions = async () => {
        const isConfirmed = await confirm("Delete all sessions?");
        if (!isConfirmed) return;
        try {
            await deleteAllSessions();
            setSessions([]);
        } catch (err) { toast.error("Error deleting sessions"); }
    };

    // Topic selection handler
    const handleTopicSelect = (e) => {
        const selectedId = e.target.value;
        if (selectedId && !topicIds.includes(selectedId)) {
            setTopicIds([...topicIds, selectedId]);
        }
        e.target.value = '';
    };

    const removeTopic = (id) => {
        setTopicIds(topicIds.filter(t => t !== id));
    };

    // Get ongoing and next sessions sorted by date
    const activeSessionsSorted = (sessions || [])
        .filter(s => s && s.status !== 'completed')
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    const ongoingSession = activeSessionsSorted.find(s => s.createdAt && typeof s.createdAt === 'string' && s.createdAt.startsWith(todayStr));
    const nextSession = activeSessionsSorted.find(s => s.createdAt && s.createdAt > todayStr) || (ongoingSession ? activeSessionsSorted[1] : activeSessionsSorted[0]);

    const handleCancel = () => {
        if (location.state?.scheduledDate || location.state?.returnToSessionCreation) {
            navigate('/calendar');
        } else {
            setShowCreate(false);
        }
    };

    return (
        <div className="dashboard-main">
            {/* Cancel Button - Top Right */}
            {showCreate && (
                <div className="cancel-btn-wrapper">
                    <button
                        className="btn-cancel-top"
                        onClick={handleCancel}
                    >
                        <Plus size={18} className="cancel-icon" />
                        Cancel
                    </button>
                </div>
            )}

            {/* Create New Session Form */}
            {showCreate && (
                <div className="create-session-card">
                    <div className="create-session-header">
                        <h3>Create New Group</h3>
                        <button
                            type="button"
                            onClick={() => {
                                localStorage.setItem('sessionFormData', JSON.stringify({ groupName, sessionMajor, topicIds, students, scheduledDate }));
                                navigate('/questions', { state: { from: 'session-creation' } });
                            }}
                            className="btn-manage-questions"
                        >
                            <HelpCircle size={14} />
                            Manage Question Bank
                        </button>
                    </div>

                    <form onSubmit={handleCreateSession}>
                        {/* Group Name & Major */}
                        <div className="form-grid-2col">
                            <div className="form-group">
                                <label>Group Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Alpha Squad - Week 5"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Session Major</label>
                                <select
                                    className="form-input"
                                    value={sessionMajor}
                                    onChange={(e) => setSessionMajor(e.target.value)}
                                >
                                    <option value="" disabled>Select Major</option>
                                    <option value="General">General / Foundational</option>
                                    {majors.map(m => (
                                        <option key={m.id} value={m.name}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Scheduled Date & Time */}
                        <div className="form-grid-2col">
                            <div className="form-group">
                                <label>Scheduled Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div className="form-group">
                                <label>Time (e.g. 3 AM)</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Select Topics */}
                        <div className="form-group">
                            <label>Select Topics</label>
                            <select
                                className="form-input form-select"
                                onChange={handleTopicSelect}
                                defaultValue=""
                            >
                                <option value="" disabled>Select a topic to add...</option>
                                {questionSets.map(set => (
                                    <option key={set.id} value={set.id} disabled={topicIds.includes(set.id)}>
                                        {set.topic}
                                    </option>
                                ))}
                            </select>
                            {topicIds.length > 0 ? (
                                <div className="selected-topics">
                                    {topicIds.map(id => {
                                        const topicItem = questionSets.find(s => s.id === id);
                                        return topicItem ? (
                                            <span key={id} className="topic-tag">
                                                {topicItem.topic}
                                                <button type="button" onClick={() => removeTopic(id)}>
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            ) : (
                                <p className="no-topics-msg">No topics selected. Please select at least one.</p>
                            )}
                        </div>

                        {/* Students */}
                        <div className="form-group">
                            <label>Students</label>
                            {students.map((student, idx) => (
                                <div key={idx} className="student-row">
                                    <div className="student-input-wrapper">
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Student Name"
                                            value={student.name}
                                            onChange={(e) => handleStudentChange(idx, 'name', e.target.value)}
                                        />
                                        {searchIndex === idx && filteredStudents.length > 0 && (
                                            <div className="student-suggestions">
                                                {filteredStudents.slice(0, 5).map(s => (
                                                    <div
                                                        key={s.id}
                                                        className="suggestion-item"
                                                        onClick={() => selectStudent(idx, s)}
                                                    >
                                                        {s.name} <code>{s.discord}</code>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Major (e.g. CS)"
                                        value={student.major}
                                        onChange={(e) => handleStudentChange(idx, 'major', e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Discord"
                                        value={student.discord}
                                        onChange={(e) => handleStudentChange(idx, 'discord', e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="btn-remove-student"
                                        onClick={() => handleRemoveStudentRow(idx)}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add Student & Import CSV */}
                        <div className="student-actions">
                            <button type="button" className="btn-add-student" onClick={handleAddStudentRow}>
                                <Plus size={16} />
                                Add Student
                            </button>
                            <label className="btn-import-csv">
                                <Upload size={16} />
                                Import CSV
                                <input type="file" accept=".csv" onChange={handleCsvUpload} hidden />
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button type="submit" className="btn-start-session">
                            Start Session Setup
                        </button>
                    </form>
                </div>
            )}

            {/* Dashboard Content - Hidden when creating session */}
            {!showCreate && (
                <>
                    {/* Top Cards Row */}
                    <div className="top-cards-grid">
                        {/* Welcome Card */}
                        <div className="welcome-card">
                            <span className="welcome-label">Dashboard</span>
                            <h1 className="welcome-title">Welcome</h1>
                            <p className="welcome-subtitle">{user?.username || 'Mentor'}</p>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button
                                    className="btn-new-pld-welcome"
                                    onClick={() => setShowCreate(true)}
                                >
                                    <Plus size={18} />
                                    New PLD Session
                                </button>
                                <button
                                    className="btn-new-pld-welcome"
                                    style={{ background: 'rgba(99,102,241,0.35)' }}
                                    onClick={() => setShowRandom(true)}
                                >
                                    <Shuffle size={18} />
                                    Create Random
                                </button>
                            </div>
                        </div>

                        {/* Performance Overview Card */}
                        <div className="performance-card">
                            <div className="performance-header">
                                <h3 className="performance-title">Performance Overview</h3>
                                <div className="legend-item">
                                    <span className="legend-dot"></span>
                                    <span>Average Grade</span>
                                </div>
                            </div>
                            <div className="chart-wrapper">
                                <div className="y-axis-labels">
                                    <span>5</span>
                                    <span>2.5</span>
                                    <span>0</span>
                                </div>
                                <svg className="performance-chart" viewBox="0 0 500 120" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#22c55e" />
                                            <stop offset="100%" stopColor="#4ade80" />
                                        </linearGradient>
                                        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="rgba(34, 197, 94, 0.35)" />
                                            <stop offset="100%" stopColor="rgba(34, 197, 94, 0)" />
                                        </linearGradient>
                                    </defs>


                                    {performanceData.sessionData.length > 0 ? (
                                        <>
                                            <path
                                                d={`M ${performanceData.sessionData.map((s, i) => {
                                                    const x = (i / Math.max(performanceData.sessionData.length - 1, 1)) * 480 + 10;
                                                    const y = 110 - (s.avgGrade * 20); // Scale: 5 max = 100px height
                                                    return `${x},${y}`;
                                                }).join(' L ')} L ${(performanceData.sessionData.length - 1) / Math.max(performanceData.sessionData.length - 1, 1) * 480 + 10},120 L 10,120 Z`}
                                                fill="url(#areaGradient)"
                                            />
                                            <path
                                                d={`M ${performanceData.sessionData.map((s, i) => {
                                                    const x = (i / Math.max(performanceData.sessionData.length - 1, 1)) * 480 + 10;
                                                    const y = 110 - (s.avgGrade * 20); // Scale: 5 max = 100px height
                                                    return `${x},${y}`;
                                                }).join(' L ')}`}
                                                fill="none"
                                                stroke="url(#lineGradient)"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            {performanceData.sessionData.map((s, i) => {
                                                const x = (i / Math.max(performanceData.sessionData.length - 1, 1)) * 480 + 10;
                                                const y = 110 - (s.avgGrade * 20); // Scale: 5 max = 100px height
                                                return <circle key={i} cx={x} cy={y} r="5" fill="#22c55e" stroke="#fff" strokeWidth="2" />;
                                            })}
                                        </>
                                    ) : (
                                        <text x="250" y="65" textAnchor="middle" fill="var(--text-secondary)" fontSize="14">No data yet</text>
                                    )}
                                </svg>
                                <div className="x-axis-labels">
                                    {performanceData.sessionData.length > 0 ? (
                                        performanceData.sessionData.map((s, i) => (
                                            <span key={i}>{s.name.substring(0, 6)}</span>
                                        ))
                                    ) : (
                                        <>
                                            <span>Session 1</span>
                                            <span>Session 2</span>
                                            <span>Session 3</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Current Session Section */}
                    <h2 className="section-heading">Current Session</h2>
                    <div className="session-cards-grid">
                        {/* Ongoing Session Card */}
                        <div className="ongoing-session-card">
                            <div className="session-card-header">
                                <h3 className="session-card-title">Ongoing Session</h3>
                            </div>
                            {ongoingSession ? (
                                <>
                                    <div className="ongoing-content">
                                        <div className="circular-progress">
                                            <svg viewBox="0 0 100 100">
                                                <defs>
                                                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor="#3b82f6" />
                                                        <stop offset="100%" stopColor="#22d3ee" />
                                                    </linearGradient>
                                                </defs>
                                                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                                                {(() => {
                                                    const totalQuestions = (ongoingSession.questions?.length || 0) * (ongoingSession.students?.length || 0);
                                                    const answeredCount = ongoingSession.students?.reduce((sum, s) => sum + (s.answeredQuestions?.length || 0), 0) || 0;
                                                    const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
                                                    const dashOffset = 251.2 - (251.2 * progress) / 100;
                                                    return (
                                                        <circle
                                                            cx="50" cy="50" r="40"
                                                            fill="none"
                                                            stroke="url(#progressGrad)"
                                                            strokeWidth="8"
                                                            strokeLinecap="round"
                                                            strokeDasharray="251.2"
                                                            strokeDashoffset={dashOffset}
                                                            transform="rotate(-90 50 50)"
                                                        />
                                                    );
                                                })()}
                                            </svg>
                                            <span className="progress-value">
                                                {Math.round(((ongoingSession.students?.reduce((sum, s) => sum + (s.answeredQuestions?.length || 0), 0) || 0) / ((ongoingSession.questions?.length || 1) * (ongoingSession.students?.length || 1))) * 100)}%
                                            </span>
                                        </div>
                                        <div className="session-stats">
                                            <div className="stat-row">
                                                <span className="stat-indicator blue"></span>
                                                <span>Points Scored</span>
                                            </div>
                                            <div className="stat-row">
                                                <span className="stat-indicator yellow"></span>
                                                <span>Streaks - 8 | 13</span>
                                            </div>
                                            <p className="ray-time-text">Ray Time now 84:30</p>
                                        </div>
                                    </div>
                                    <button
                                        className="btn-go-session-ongoing"
                                        onClick={() => navigate(`/session/${ongoingSession.id}`)}
                                    >
                                        Go to Session
                                    </button>
                                </>
                            ) : (
                                <div className="ongoing-content">
                                    <div className="circular-progress">
                                        <svg viewBox="0 0 100 100">
                                            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                                        </svg>
                                        <span className="progress-value">0%</span>
                                    </div>
                                    <div className="session-stats">
                                        <div className="stat-row">
                                            <span className="stat-indicator blue"></span>
                                            <span>Points Scored</span>
                                        </div>
                                        <div className="stat-row">
                                            <span className="stat-indicator yellow"></span>
                                            <span>Streaks - 0 | 0</span>
                                        </div>
                                        <p className="ray-time-text">No active session</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Next Session Card */}
                        <div className="next-session-card">
                            <div className="session-card-header">
                                <h3 className="session-card-title">Next Session</h3>
                            </div>
                            <div className="next-session-info">
                                {nextSession ? (
                                    <>
                                        <div className="next-session-main">
                                            <div className="next-session-date-box">
                                                <span className="next-month">{new Date(nextSession.createdAt).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
                                                <span className="next-day">{new Date(nextSession.createdAt).getDate()}</span>
                                            </div>
                                            <div className="next-session-details">
                                                <h4 className="next-group-name">{nextSession.groupName}</h4>
                                                <div className="next-time-row">
                                                    <Clock size={14} className="time-ico" />
                                                    <span>{nextSession.scheduled_date ? new Date(nextSession.scheduled_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '10:00 AM'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="next-session-stats-row">
                                            <div className="next-stat">
                                                <Users size={14} />
                                                <span>{nextSession.students?.length || 0} Joined</span>
                                            </div>
                                            <div className="next-days-tag">
                                                {(() => {
                                                    const diff = new Date(nextSession.createdAt) - new Date(todayStr);
                                                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                    return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
                                                })()}
                                            </div>
                                        </div>

                                        <div className="next-topics-scroll">
                                            {(nextSession.topicNames || []).map((name, i) => (
                                                <span key={i} className="next-topic-badge">{name}</span>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="no-sessions-empty">
                                        <Calendar size={32} className="empty-ico" />
                                        <p>No upcoming sessions</p>
                                    </div>
                                )}
                            </div>
                            <button className="btn-view-calendar" onClick={() => navigate('/calendar')}>
                                View Calendar
                            </button>
                        </div>
                    </div>
                </>
            )}
            {/* Random Session Modal */}
            {showRandom && (
                <RandomSessionModal onClose={() => setShowRandom(false)} />
            )}


        </div>
    );
}

