// client/src/pages/DeclareMajor.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getMajors, updateUserProfile } from '../api';
import { BookOpen } from 'lucide-react';

export default function DeclareMajor() {
    const { user, accessToken, login } = useAuth();
    const navigate = useNavigate();
    const [majors, setMajors] = useState([]);

    // State for students
    const [selectedMajor, setSelectedMajor] = useState('');

    // State for mentors
    const [selectedMajors, setSelectedMajors] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const isMentor = user?.role === 'mentor';

    useEffect(() => {
        const fetchMajorsList = async () => {
            try {
                const data = await getMajors();
                setMajors(data);
            } catch (err) {
                console.error("Failed to load majors", err);
                setError('Failed to load available majors. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        fetchMajorsList();
    }, []);

    const handleCheckboxChange = (majorName) => {
        setSelectedMajors(prev =>
            prev.includes(majorName)
                ? prev.filter(m => m !== majorName)
                : [...prev, majorName]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        let majorToSave = '';
        if (isMentor) {
            if (selectedMajors.length === 0) {
                setError('Please select at least one major.');
                return;
            }
            majorToSave = selectedMajors.join(', ');
        } else {
            if (!selectedMajor) {
                setError('Please select a major.');
                return;
            }
            majorToSave = selectedMajor;
        }

        setSaving(true);
        setError('');

        try {
            const res = await updateUserProfile({ major: majorToSave });

            // Update auth context
            const updatedUser = {
                ...res.user,
                avatar: res.user?.avatar_url || res.user?.avatar || user?.avatar || ''
            };
            login(accessToken, updatedUser);

            navigate(isMentor ? '/' : '/student-dashboard');
        } catch (err) {
            setError(err.message || 'Failed to update major.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-center" style={{ height: '60vh', flexDirection: 'column' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading majors...</p>
            </div>
        );
    }

    return (
        <div className="flex-center" style={{ minHeight: '60vh' }}>
            <form onSubmit={handleSubmit} className="card" style={{ width: '450px', padding: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--color-primary)' }}>
                    <BookOpen size={48} />
                </div>
                <h2 style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-primary)' }}>Welcome to PLD{user?.username ? `, ${user.username}` : ''}!</h2>
                <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {isMentor
                        ? "Before you can proceed to your dashboard, please tell us which majors you are teaching so we can show you the right sessions."
                        : "Before you can proceed to your dashboard, please tell us what you're studying so we can personalize your experience."
                    }
                </p>

                {error && <div style={{ color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}

                <div className="input-group">
                    <label>{isMentor ? "Select your Majors" : "Select your Major"}</label>

                    {isMentor ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-card)' }}>
                            {majors.map(m => (
                                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedMajors.includes(m.name)}
                                        onChange={() => handleCheckboxChange(m.name)}
                                        disabled={saving}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    {m.name}
                                </label>
                            ))}
                        </div>
                    ) : (
                        <select
                            className="input-control"
                            value={selectedMajor}
                            onChange={(e) => setSelectedMajor(e.target.value)}
                            required
                            style={{ cursor: 'pointer', padding: '0.75rem' }}
                            disabled={saving}
                        >
                            <option value="">Select your major…</option>
                            {majors.map(m => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '1.5rem', padding: '0.75rem', fontSize: '1rem' }}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Continue to Dashboard'}
                </button>
            </form>
        </div>
    );
}

