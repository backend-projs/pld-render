import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Users, ArrowRight, Plus, ArrowLeft } from 'lucide-react';
import { getSessions } from '../api';
import './Calendar.css';

export default function Calendar() {
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [sessions, setSessions] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const data = await getSessions();
                if (Array.isArray(data)) {
                    setSessions(data);
                }
            } catch (err) {
                console.error('Error fetching sessions:', err);
            }
        };
        fetchSessions();
    }, []);

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const firstDayOfMonth = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const isToday = (day) => {
        const today = new Date();
        return (
            day === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear()
        );
    };

    const isSelected = (day) => {
        return (
            day === selectedDate.getDate() &&
            currentDate.getMonth() === selectedDate.getMonth() &&
            currentDate.getFullYear() === selectedDate.getFullYear()
        );
    };

    const hasSession = (day) => {
        return sessions.some(session => {
            const sessionDate = new Date(session.createdAt);
            return (
                sessionDate.getDate() === day &&
                sessionDate.getMonth() === currentDate.getMonth() &&
                sessionDate.getFullYear() === currentDate.getFullYear()
            );
        });
    };

    const getSessionsForDate = (date) => {
        return sessions.filter(session => {
            const sessionDate = new Date(session.createdAt);
            return (
                sessionDate.getDate() === date.getDate() &&
                sessionDate.getMonth() === date.getMonth() &&
                sessionDate.getFullYear() === date.getFullYear()
            );
        });
    };

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const days = [];
    // Padding for first day
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        days.push(
            <div
                key={d}
                className={`calendar-day ${isToday(d) ? 'today' : ''} ${isSelected(d) ? 'selected' : ''} ${hasSession(d) ? 'has-session' : ''}`}
                onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), d))}
            >
                <span className="day-number">{d}</span>
                {hasSession(d) && <span className="session-dot"></span>}
            </div>
        );
    }

    const selectedDateSessions = getSessionsForDate(selectedDate);

    return (
        <div className="calendar-page">
            <button className="btn-back-premium" onClick={() => navigate('/')}>
                <ArrowLeft size={18} /> Back to Dashboard
            </button>
            <div className="calendar-header-main">
                <div className="header-left">
                    <CalendarIcon size={28} className="header-icon" />
                    <h1>Session Calendar</h1>
                </div>
                <div className="calendar-nav">
                    <button onClick={prevMonth} className="nav-btn"><ChevronLeft size={20} /></button>
                    <span className="current-month">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                    <button onClick={nextMonth} className="nav-btn"><ChevronRight size={20} /></button>
                </div>
            </div>

            <div className="calendar-grid-container">
                <div className="calendar-main-card">
                    <div className="calendar-weekdays">
                        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                    </div>
                    <div className="calendar-days-grid">
                        {days}
                    </div>
                </div>

                <div className="calendar-sidebar">
                    <div className="selected-date-info">
                        <h2>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                        <p>{selectedDateSessions.length} Sessions scheduled</p>
                    </div>

                    <div className="day-sessions-list">
                        {selectedDateSessions.length > 0 ? (
                            selectedDateSessions.map(session => (
                                <div key={session.id} className="mini-session-card">
                                    <div className="mini-card-time">
                                        <Clock size={14} />
                                        <span>{new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <h3 className="mini-card-title">{session.groupName}</h3>
                                    <div className="mini-card-meta">
                                        <span className="meta-item"><Users size={14} /> {session.students?.length || 0} Students</span>
                                        <span className={`status-badge ${session.status}`}>{session.status}</span>
                                    </div>
                                    <button className="mini-card-btn" onClick={() => window.location.href = `/session/${session.id}`}>
                                        View Details <ArrowRight size={14} />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="no-sessions-empty">
                                <CalendarIcon size={40} className="empty-icon" />
                                <p>No sessions on this day</p>
                                {(() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const compareDate = new Date(selectedDate);
                                    compareDate.setHours(0, 0, 0, 0);
                                    return compareDate >= today && (
                                        <button
                                            className="schedule-btn-empty"
                                            onClick={() => {
                                                const year = selectedDate.getFullYear();
                                                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                                const day = String(selectedDate.getDate()).padStart(2, '0');
                                                const dateStr = `${year}-${month}-${day}`;
                                                navigate('/', { state: { scheduledDate: dateStr } });
                                            }}
                                        >
                                            <Plus size={16} /> Schedule Session
                                        </button>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
