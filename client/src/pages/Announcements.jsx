// client/src/pages/Announcements.jsx
import { useState, useEffect } from 'react';
import { Megaphone, Send, Trash2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { getAnnouncements, createAnnouncement, deleteAnnouncement, getMasterStudents } from '../api';
import { useNavigate } from 'react-router-dom';
import './Announcements.css';

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Announcements() {
    const { user } = useAuth();
    const toast = useToast();
    const { confirm } = useConfirm();
    const navigate = useNavigate();
    const isMentor = user?.role === 'mentor' || user?.role === 'admin';

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState([]);

    // Composer state
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [target, setTarget] = useState('all');
    const [selectedDiscords, setSelectedDiscords] = useState([]);
    const [sending, setSending] = useState(false);
    const [openRecipients, setOpenRecipients] = useState(null); // announcement id

    useEffect(() => {
        fetchAnnouncements();
        if (isMentor) fetchStudents();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            const data = await getAnnouncements();
            setAnnouncements(data);
        } catch {
            toast.error('Failed to load announcements.');
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const data = await getMasterStudents();
            setStudents(data.filter(s => s.discord));
        } catch { /* silent */ }
    };

    const toggleStudent = (discord) => {
        setSelectedDiscords(prev =>
            prev.includes(discord) ? prev.filter(d => d !== discord) : [...prev, discord]
        );
    };

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            toast.error('Please fill in the title and message.');
            return;
        }
        if (target === 'selected' && selectedDiscords.length === 0) {
            toast.error('Please select at least one student.');
            return;
        }
        setSending(true);
        try {
            const ann = await createAnnouncement({
                title: title.trim(),
                message: message.trim(),
                target,
                recipientDiscords: target === 'selected' ? selectedDiscords : []
            });
            setAnnouncements(prev => [ann, ...prev]);
            setTitle('');
            setMessage('');
            setSelectedDiscords([]);
            setTarget('all');
            toast.success('Announcement sent!');
        } catch (err) {
            toast.error('Failed to send announcement.');
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm('Delete this announcement?');
        if (!ok) return;
        try {
            await deleteAnnouncement(id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
            toast.success('Announcement deleted.');
        } catch {
            toast.error('Failed to delete announcement.');
        }
    };

    return (
        <div className="announcements-container">
            <div className="announcements-header">
                <button onClick={() => navigate(isMentor ? '/' : '/student-dashboard')} className="btn-back-premium">
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
                <Megaphone size={24} style={{ color: '#ef4444' }} />
                <h1>Announcements</h1>
            </div>

            {/* Mentor composer */}
            {isMentor && (
                <div className="ann-composer">
                    <h3><Send size={16} /> New Announcement</h3>
                    <div className="ann-form">
                        <div className="input-group no-margin">
                            <label>Title</label>
                            <input
                                className="input-control"
                                placeholder="e.g. Important: Session rescheduled"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>
                        <div className="input-group no-margin">
                            <label>Message</label>
                            <textarea
                                className="input-control"
                                rows={4}
                                placeholder="Write your announcement..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Send To</label>
                            <div className="ann-target-row">
                                <button
                                    className={`ann-target-btn ${target === 'all' ? 'active' : ''}`}
                                    onClick={() => setTarget('all')}
                                >
                                    All Students
                                </button>
                                <button
                                    className={`ann-target-btn ${target === 'selected' ? 'active' : ''}`}
                                    onClick={() => setTarget('selected')}
                                >
                                    Select Students
                                </button>
                            </div>
                        </div>

                        {target === 'selected' && (
                            <div className="student-picker">
                                {students.length === 0 && (
                                    <span style={{ padding: 12, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No students available</span>
                                )}
                                {students.map(s => (
                                    <label key={s.discord} className={`student-chip ${selectedDiscords.includes(s.discord) ? 'selected' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedDiscords.includes(s.discord)}
                                            onChange={() => toggleStudent(s.discord)}
                                        />
                                        {s.name}
                                    </label>
                                ))}
                            </div>
                        )}

                        <button className="ann-send-btn" onClick={handleSend} disabled={sending}>
                            <Send size={16} /> {sending ? 'Sending...' : 'Send Announcement'}
                        </button>
                    </div>
                </div>
            )}

            {/* Announcements list */}
            {loading ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            ) : announcements.length === 0 ? (
                <div className="ann-empty">No announcements yet.</div>
            ) : (
                <div className="ann-list">
                    {announcements.map(ann => (
                        <div key={ann.id} className="ann-card">
                            <div className="ann-card-header">
                                <h3 className="ann-title">{ann.title}</h3>
                                {isMentor && ann.target === 'selected' && ann.announcement_recipients?.length > 0 && (
                                    <button
                                        className={`ann-badge selected`}
                                        style={{ cursor: 'pointer', border: 'none' }}
                                        onClick={() => setOpenRecipients(openRecipients === ann.id ? null : ann.id)}
                                    >
                                        👥 {ann.announcement_recipients.length} Selected
                                    </button>
                                )}
                            </div>
                            {isMentor && openRecipients === ann.id && ann.announcement_recipients?.length > 0 && (
                                <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {ann.announcement_recipients.map((r, i) => (
                                        <span key={i} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '2px 10px', fontSize: '0.78rem', color: 'var(--text-main)' }}>
                                            {r.student_name || r.student_discord}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <p className="ann-message">{ann.message}</p>
                            <div className="ann-footer">
                                <span className="ann-mentor">— {ann.mentor_name}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span>{formatDate(ann.created_at)}</span>
                                    {isMentor && (
                                        <button className="ann-delete-btn" onClick={() => handleDelete(ann.id)}>
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

