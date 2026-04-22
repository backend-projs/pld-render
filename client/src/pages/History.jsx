// client/src/pages/History.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, Calendar, ArrowRight, Trash2, ArrowLeft, Edit, X } from 'lucide-react';
import { getSessions, deleteSession, updateSession, getMajors } from '../api';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import './History.css';

export default function History() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [filter, setFilter] = useState('all'); // all, completed, active
    const [visibleCount, setVisibleCount] = useState(7);
    const [majors, setMajors] = useState([]);
    const navigate = useNavigate();
    const { confirm } = useConfirm();
    const toast = useToast();

    // Edit State
    const [editingSession, setEditingSession] = useState(null);
    const [editName, setEditName] = useState('');
    const [editMajor, setEditMajor] = useState('');

    useEffect(() => {
        fetchSessions();
        fetchMajors();
    }, []);

    const fetchSessions = async () => {
        try {
            const data = await getSessions();
            if (Array.isArray(data)) setSessions(data.reverse());
        } catch (err) { console.error('Fetch sessions:', err); }
    };

    const fetchMajors = async () => {
        try {
            const data = await getMajors();
            if (Array.isArray(data)) setMajors(data);
        } catch (err) { console.error('Fetch majors:', err); }
    };

    const handleDelete = async (id) => {
        const isConfirmed = await confirm('Are you sure you want to delete this session? This will delete all student submissions.');
        if (!isConfirmed) return;
        try {
            await deleteSession(id);
            toast.success("Session deleted");
            fetchSessions();
        } catch (err) { 
            console.error('Delete session:', err);
            toast.error("Failed to delete session");
        }
    };

    const handleEditClick = (session) => {
        setEditingSession(session);
        setEditName(session.groupName);
        setEditMajor(session.major || 'General');
    };

    const handleSaveEdit = async () => {
        if (!editName.trim()) return toast.error("Name cannot be empty");
        try {
            await updateSession(editingSession.id, {
                groupName: editName,
                major: editMajor
            });
            toast.success("Session updated");
            setEditingSession(null);
            fetchSessions();
        } catch (err) {
            console.error('Update session:', err);
            toast.error("Failed to update session");
        }
    };

    const filteredSessions = sessions.filter(s => {
        if (filter === 'completed') return s.status === 'completed';
        if (filter === 'active') return s.status === 'active';
        return true;
    });

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="history-page">
            <button 
                className="btn-back-premium" 
                onClick={() => navigate('/')}
            >
                <ArrowLeft size={18} />
                Back to Dashboard
            </button>
            <div className="history-header">
                <h1>PLD History</h1>
                <p>View all your past and ongoing PLD sessions</p>
            </div>

            <div className="history-filters">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All Sessions
                </button>
                <button
                    className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                    onClick={() => setFilter('completed')}
                >
                    Completed
                </button>
                <button
                    className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                    onClick={() => setFilter('active')}
                >
                    Active
                </button>
            </div>

            <div className="history-list">
                {filteredSessions.length > 0 ? (
                    <>
                        {filteredSessions.slice(0, visibleCount).map(session => (
                            <div key={session.id} className="history-card">
                                <div className="history-card-left">
                                    <div className="history-icon">
                                        <FileText size={24} />
                                    </div>
                                    <div className="history-info">
                                        <h3>{session.groupName}</h3>
                                        <p className="history-topic">{session.topicName || 'No topic'}</p>
                                        <div className="history-meta">
                                            <span><Users size={14} /> {session.students?.length || 0} students</span>
                                            <span><Calendar size={14} /> {formatDate(session.createdAt)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="history-card-right">
                                    <span className={`status-badge ${session.status}`}>
                                        {session.status === 'completed' ? 'Completed' : 'Active'}
                                    </span>
                                    <div className="history-actions">
                                        <button
                                            className="btn-view"
                                            onClick={() => navigate(session.groupName.startsWith('[WORKSHOP]') ? `/workshop/${session.id}` : `/session/${session.id}`)}
                                        >
                                            View <ArrowRight size={16} />
                                        </button>
                                        {user?.role === 'mentor' && (
                                            <>
                                                <button
                                                    className="btn-edit"
                                                    onClick={() => handleEditClick(session)}
                                                    style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => handleDelete(session.id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredSessions.length > visibleCount && (
                            <div className="show-more-wrapper">
                                <button
                                    className="btn-show-more"
                                    onClick={() => setVisibleCount(prev => prev + 7)}
                                >
                                    Show More
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="no-sessions">
                        <FileText size={48} />
                        <h3>No sessions found</h3>
                        <p>Start a new PLD session from the Dashboard</p>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingSession && (
                <div className="premium-modal-backdrop" onClick={() => setEditingSession(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="premium-modal-container" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', width: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Edit Session</h3>
                            <button onClick={() => setEditingSession(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Group Name</label>
                            <input 
                                type="text" 
                                value={editName} 
                                onChange={e => setEditName(e.target.value)} 
                                className="input-control"
                                style={{ width: '100%', padding: '0.5rem' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Major</label>
                            <select 
                                value={editMajor} 
                                onChange={e => setEditMajor(e.target.value)} 
                                className="input-control"
                                style={{ width: '100%', padding: '0.5rem' }}
                            >
                                <option value="General">General</option>
                                {majors.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                            </select>
                        </div>

                        <button onClick={handleSaveEdit} className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>Save Changes</button>
                    </div>
                </div>
            )}
        </div>
    );
}

