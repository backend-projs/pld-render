import React, { useState, useEffect } from 'react';
import { getLeaderboard, getMajors } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Trophy, Award, Users, TrendingUp, GraduationCap, ArrowLeft } from 'lucide-react';
import './Leaderboard.css';

const Leaderboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [majors, setMajors] = useState([]);
    const [selectedMajor, setSelectedMajor] = useState('');

    useEffect(() => {
        const init = async () => {
            try {
                const majorsData = await getMajors();
                const majorsList = (majorsData || []).map(m => m.name || m);
                setMajors(majorsList);

                // Determine initial major
                let initialMajor = '';
                if (user?.role === 'student') {
                    // Students auto-filter by their own major
                    initialMajor = user?.major || majorsList[0] || '';
                } else if (user?.role === 'mentor') {
                    // Mentors: use first major from their assigned majors
                    const mentorMajors = (user?.major || '').split(',').map(m => m.trim()).filter(Boolean);
                    initialMajor = mentorMajors[0] || majorsList[0] || '';
                } else {
                    initialMajor = majorsList[0] || '';
                }
                setSelectedMajor(initialMajor);
            } catch (err) {
                console.error("Failed to load majors", err);
            }
        };
        init();
    }, [user]);

    useEffect(() => {
        if (!selectedMajor) return;
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                const data = await getLeaderboard(selectedMajor);
                setLeaderboard(data);
            } catch (err) {
                console.error("Failed to fetch leaderboard", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, [selectedMajor]);

    // For mentors: get the majors they teach
    const mentorMajors = user?.role === 'mentor'
        ? (user?.major || '').split(',').map(m => m.trim()).filter(Boolean)
        : [];

    // Determine which majors to show in dropdown
    const availableMajors = user?.role === 'mentor'
        ? (mentorMajors.length > 0 ? mentorMajors : majors)
        : user?.role === 'admin'
            ? majors
            : []; // students don't get a dropdown

    const getRankStyle = (rank) => {
        if (rank === 1) return { background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#000' };
        if (rank === 2) return { background: 'linear-gradient(135deg, #C0C0C0, #A8A8A8)', color: '#000' };
        if (rank === 3) return { background: 'linear-gradient(135deg, #CD7F32, #B87333)', color: '#fff' };
        return { background: 'var(--bg-app)', color: 'var(--text-main)' };
    };

    const getRankIcon = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    if (loading) {
        return (
            <div className="flex-center" style={{ height: '50vh', flexDirection: 'column' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading leaderboard...</p>
            </div>
        );
    }

    return (
        <div className="leaderboard-container">
            <button className="btn-back-premium" onClick={() => navigate(-1)}>
                <ArrowLeft size={18} /> Back to Dashboard
            </button>
            {/* Header */}
            <div className="leaderboard-header-card">
                <div className="leaderboard-header-title">
                    <Trophy size={40} color="#FFD700" className="trophy-icon" />
                    <h1>{selectedMajor} Leaderboard</h1>
                    <Trophy size={40} color="#FFD700" className="trophy-icon" />
                </div>
                <p>Ranking students by their average PLD performance</p>

                {/* Major Selector for mentors and admins */}
                {availableMajors.length > 0 && (
                    <div className="major-selector">
                        <GraduationCap size={18} />
                        <select
                            value={selectedMajor}
                            onChange={(e) => setSelectedMajor(e.target.value)}
                            className="major-select"
                        >
                            {availableMajors.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Student info */}
                {user?.role === 'student' && selectedMajor && (
                    <div className="major-badge-display">
                        <GraduationCap size={16} />
                        <span>{selectedMajor}</span>
                    </div>
                )}
            </div>

            {/* Stats Summary */}
            <div className="leaderboard-stats-grid">
                <div className="card stat-card border-gold">
                    <Users size={32} color="var(--color-primary)" className="stat-icon" />
                    <div className="stat-value color-primary">{leaderboard.length}</div>
                    <div className="stat-label">Total Students</div>
                </div>
                <div className="card stat-card border-green">
                    <TrendingUp size={32} color="#4CAF50" className="stat-icon" />
                    <div className="stat-value color-green">
                        {leaderboard.length > 0 ? leaderboard[0].averageGrade : '-'}
                    </div>
                    <div className="stat-label">Top Average</div>
                </div>
                <div className="card stat-card border-blue">
                    <Award size={32} color="#2196F3" className="stat-icon" />
                    <div className="stat-value color-blue">
                        {leaderboard.reduce((sum, s) => sum + s.sessionsCount, 0)}
                    </div>
                    <div className="stat-label">Total PLDs Graded</div>
                </div>
            </div>

            {/* Leaderboard Table */}
            {leaderboard.length === 0 ? (
                <div className="card empty-state">
                    <Trophy size={64} className="empty-icon" />
                    <h3>No Data Yet</h3>
                    <p>Complete some PLD sessions with grades to see the {selectedMajor} leaderboard!</p>
                </div>
            ) : (
                <div className="card table-card">
                    {/* Table Header */}
                    <div className="table-header">
                        <div className="col-rank">Rank</div>
                        <div className="col-student">Student</div>
                        <div className="col-plds">PLDs Done</div>
                        <div className="col-grade">Average Grade</div>
                    </div>

                    {/* Table Rows */}
                    {leaderboard.map((student, idx) => {
                        const rank = idx + 1;
                        const rankStyle = getRankStyle(rank);

                        return (
                            <div
                                key={student.discord}
                                className="leaderboard-row"
                                style={{
                                    background: rank <= 3 ? `${rankStyle.background}10` : 'transparent'
                                }}
                            >
                                {/* Rank Badge */}
                                <div className="col-rank">
                                    <span
                                        className="rank-badge"
                                        style={{
                                            fontSize: rank <= 3 ? '1.5rem' : '1rem',
                                            ...rankStyle
                                        }}
                                    >
                                        {getRankIcon(rank)}
                                    </span>
                                </div>

                                {/* Student Name */}
                                <div className="col-student">
                                    <div className="student-name">
                                        {student.name}
                                    </div>
                                    <div className="student-discord">
                                        @{student.discord}
                                    </div>
                                </div>

                                {/* PLDs Done */}
                                <div className="col-plds">
                                    <span className="plds-badge">
                                        {student.sessionsCount} PLDs
                                    </span>
                                </div>

                                {/* Average Grade */}
                                <div className="col-grade">
                                    <span
                                        className="grade-badge"
                                        style={{
                                            background: parseFloat(student.averageGrade) >= 4 ? 'rgba(76, 175, 80, 0.15)' :
                                                parseFloat(student.averageGrade) >= 3 ? 'rgba(255, 193, 7, 0.15)' :
                                                    'rgba(211, 47, 47, 0.15)',
                                            color: parseFloat(student.averageGrade) >= 4 ? '#4CAF50' :
                                                parseFloat(student.averageGrade) >= 3 ? '#FFC107' :
                                                    '#d32f2f',
                                            border: `1px solid ${parseFloat(student.averageGrade) >= 4 ? 'rgba(76, 175, 80, 0.3)' :
                                                parseFloat(student.averageGrade) >= 3 ? 'rgba(255, 193, 7, 0.3)' :
                                                    'rgba(211, 47, 47, 0.3)'}`
                                        }}>
                                        {student.averageGrade}/5
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Leaderboard;

