import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Code, Plus, Play, X, Edit, Trash2, Calendar, RefreshCw } from 'lucide-react';
import { getSessions, deleteSession, updateSession, createSession } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import './Workshops.css';

export default function Workshops() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const { confirm } = useConfirm();

    // Create/Edit Workshop State
    const [showCreate, setShowCreate] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [sessionMajors, setSessionMajors] = useState([]);
    const [customQuestions, setCustomQuestions] = useState([{ title: '', body: '' }]);

    // Derive mentor's majors from their profile
    const mentorMajorsList = (user?.major || '').split(',').map(m => m.trim()).filter(Boolean);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            if (sessions.length === 0) setLoading(true);
            const data = await getSessions();
            if (Array.isArray(data)) {
                const sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setSessions(sorted);
            }
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            toast.error("Failed to load workshop sessions.");
        } finally {
            setLoading(false);
        }
    };

    const handleEditWorkshop = (session) => {
        setEditingSession(session);
        setGroupName(session.groupName.replace('[WORKSHOP] ', ''));
        setSessionMajors(session.major ? session.major.split(',').map(m => m.trim()) : []);
        setCustomQuestions(session.questions.map(q => ({
            title: q.topicName || '',
            body: q.text || (typeof q === 'string' ? q : '')
        })));
        setShowCreate(true);
    };

    const handleDeleteWorkshop = async (id) => {
        const isConfirmed = await confirm("Are you sure? This will delete the session and all student submissions for this session.");
        if (!isConfirmed) return;

        try {
            await deleteSession(id);
            toast.success("Workshop deleted successfully.");
            fetchData();
        } catch (err) {
            console.error('Delete workshop failed:', err);
            toast.error("Failed to delete workshop.");
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

    const handleQuestionChange = (idx, field, value) => {
        const updated = [...customQuestions];
        updated[idx][field] = value;
        setCustomQuestions(updated);
    };

    const addQuestion = () => setCustomQuestions([...customQuestions, { title: '', body: '' }]);
    
    const removeQuestion = (idx) => {
        if (customQuestions.length > 1) {
            setCustomQuestions(customQuestions.filter((_, i) => i !== idx));
        }
    };

    const toggleMajor = (majorName) => {
        if (sessionMajors.includes(majorName)) {
            setSessionMajors(sessionMajors.filter(m => m !== majorName));
        } else {
            setSessionMajors([...sessionMajors, majorName]);
        }
    };

    const handleCreateWorkshop = async (e) => {
        e.preventDefault();
        const hasInvalidQs = customQuestions.some(q => !q.title.trim() || !q.body.trim());

        if (!groupName || sessionMajors.length === 0 || hasInvalidQs) {
            return toast.error("Select Group Name, at least one Major, and fill all questions.");
        }

        try {
            const workshopName = `[WORKSHOP] ${groupName.trim()}`;
            const majorString = sessionMajors.join(', ');
            const mappedQuestions = customQuestions.map(q => ({
                topicName: q.title,
                text: q.body
            }));

            if (editingSession) {
                await updateSession(editingSession.id, {
                    groupName: workshopName,
                    major: majorString,
                    questions: mappedQuestions,
                    topicNames: sessionMajors
                });
                toast.success("Workshop updated successfully!");
            } else {
                const newSession = await createSession({
                    groupName: workshopName,
                    major: majorString,
                    students: [], // No adding students explicitly for Workshops
                    topicIds: [], // We use custom questions instead
                    customQuestions: customQuestions,
                    createdAt: new Date().toISOString(),
                    scheduledTime: '00:00' // Immediate
                });
                toast.success("Workshop created successfully!");
                navigate(`/workshop/${newSession.id}`);
            }
            
            setShowCreate(false);
            setEditingSession(null);
            setGroupName('');
            setSessionMajors([]);
            setCustomQuestions([{ title: '', body: '' }]);
            fetchData();
        } catch (err) {
            console.error('Save workshop failed:', err);
            toast.error(err.message || "Failed to save workshop");
        }
    };

    if (loading) {
        return (
            <div className="flex-center" style={{ height: '80vh', flexDirection: 'column' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading interactive workshops...</p>
            </div>
        );
    }

    const activeWorkshops = sessions
        .filter(s => {
            const isMentor = user.role === 'mentor';
            if (s.status === 'completed') return false;
            
            // Workshops ONLY
            if (!s.groupName?.startsWith('[WORKSHOP]')) return false;

            // If mentor, they should see their sessions. If student, only if they are in the list.
            if (!isMentor && !getMyData(s)) return false;
            
            return true;
        })
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return (
        <div className="workshops-container">
            <div className="workshops-header">
                <h1 className="workshops-title">
                    <Code size={30} color="var(--color-primary)" />
                    Interactive Workshops
                </h1>
                
                <div className="workshops-actions">
                    <button 
                        onClick={fetchData} 
                        className="refresh-btn" 
                        disabled={loading}
                        title="Refresh Workshops"
                    >
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        <span>Refresh</span>
                    </button>
                    
                    {user?.role === 'mentor' && !showCreate && (
                        <button onClick={() => { setEditingSession(null); setGroupName(''); setSessionMajors([]); setCustomQuestions([{ title: '', body: '' }]); setShowCreate(true); }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Plus size={16} /> Create
                        </button>
                    )}
                    {user?.role === 'mentor' && showCreate && (
                        <button onClick={() => setShowCreate(false)} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                            <X size={16} /> Cancel
                        </button>
                    )}
                </div>
            </div>

            {showCreate ? (
                <div className="create-workshop-card">
                    <h2 className="create-workshop-title">{editingSession ? 'Edit Workshop' : 'Create New Workshop'}</h2>
                    <form onSubmit={handleCreateWorkshop}>
                        {/* Workshop Name */}
                        <div className="form-group">
                            <label className="form-label">Workshop Name</label>
                            <input
                                type="text"
                                className="input-control"
                                placeholder="e.g. Intro to Arrays"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                            />
                        </div>

                        {/* Multi-Select Majors (from mentor profile) */}
                        <div className="form-group">
                            <label className="form-label">Your Majors <span className="form-hint">(students notified)</span></label>
                            <div className="majors-list">
                                {mentorMajorsList.map(name => (
                                    <label
                                        key={name}
                                        className={`major-tag ${sessionMajors.includes(name) ? 'active' : ''}`}
                                    >
                                        <input type="checkbox" checked={sessionMajors.includes(name)} onChange={() => toggleMajor(name)} style={{ display: 'none' }} />
                                        {sessionMajors.includes(name) ? '✓ ' : ''}{name}
                                    </label>
                                ))}
                            </div>
                            {mentorMajorsList.length === 0 && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>Update your profile first.</p>}
                        </div>

                        {/* Custom Questions */}
                        <div className="form-group">
                            <label className="form-label">Questions</label>
                            <div className="questions-container">
                                {customQuestions.map((q, idx) => (
                                    <div key={idx} className="question-item">
                                        <div className="question-header">
                                            <span className="question-number">Question {idx + 1}</span>
                                            {customQuestions.length > 1 && (
                                                <button type="button" onClick={() => removeQuestion(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}>
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            className="input-control"
                                            placeholder="Question Title"
                                            value={q.title}
                                            onChange={(e) => handleQuestionChange(idx, 'title', e.target.value)}
                                            style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}
                                        />
                                        <textarea
                                            className="input-control"
                                            placeholder="Question body..."
                                            value={q.body}
                                            onChange={(e) => handleQuestionChange(idx, 'body', e.target.value)}
                                            rows={3}
                                            style={{ resize: 'vertical', fontFamily: 'inherit' }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addQuestion} style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'transparent', border: 'none', color: 'var(--color-primary)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <Plus size={14} /> Add Another Question
                            </button>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontWeight: 'bold', fontSize: '1rem', borderRadius: '8px' }}>
                            {editingSession ? 'Update Workshop' : 'Start Workshop'}
                        </button>
                    </form>
                </div>
            ) : (
                <>
                    <p className="workshops-description">
                        Welcome to the Workshops hub! Enter interactive collaborative sessions natively in your browser.
                    </p>

                    {activeWorkshops.length > 0 ? (
                        <div className="workshops-grid">
                            {activeWorkshops.map(session => (
                                <div key={session.id} className="workshop-card">
                                    {user?.role === 'mentor' && (
                                        <div className="workshop-card-actions">
                                            <button onClick={() => handleEditWorkshop(session)} className="btn-icon" style={{ color: 'var(--text-secondary)', padding: '0.25rem' }} title="Edit Workshop">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteWorkshop(session.id)} className="btn-icon" style={{ color: '#ef4444', padding: '0.25rem' }} title="Delete Workshop">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="workshop-card-title">{session.groupName.replace('[WORKSHOP] ', '')}</h3>
                                        <p className="workshop-card-topic">
                                            Topic: {session.topicNames?.join(', ') || 'General'}
                                        </p>
                                        <div className="workshop-card-meta">
                                            <Calendar size={14} />
                                            <span>
                                                Created:{' '}
                                                {session.createdAt 
                                                    ? new Date(session.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) 
                                                    : 'Just now'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <hr className="workshop-card-divider" />
                                    
                                    <Link 
                                        to={`/workshop/${session.id}`} 
                                        className="btn btn-primary"
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            alignItems: 'center',
                                            textDecoration: 'none',
                                            padding: '0.75rem',
                                            fontWeight: 'bold',
                                            borderRadius: '8px'
                                        }}
                                    >
                                        <Code size={18} />
                                        Enter Workspace
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <Code size={48} style={{ opacity: 0.3, marginBottom: '1rem', margin: '0 auto', display: 'block' }} />
                            <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>No active Workshops</h3>
                            <p>There are no active interactive programming sessions available right now. {user?.role === 'mentor' ? "Create one above!" : "Check back later!"}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}


