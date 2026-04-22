// client/src/pages/SessionRun.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Send, Download, Lightbulb, HelpCircle, BookOpen, PhoneOff, CheckCircle, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { generateFeedback } from '../services/aiService';
import { getSession, saveStudentNotes, saveStudentResult, saveStudentGrade, saveStudentQuestions, endSession, sendToDiscord, sendAllToDiscord, toggleStudentStatus, removeSessionStudent } from '../api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import './SessionRun.css';

export default function SessionRun() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { confirm } = useConfirm();
    const [session, setSession] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [grade, setGrade] = useState(0); // Current grade state
    const [savedGrade, setSavedGrade] = useState(0); // Confirmed/Saved grade
    const [results, setResults] = useState({}); // studentId -> feedback
    const [sentStatus, setSentStatus] = useState({}); // studentId -> boolean
    const [showQuestions, setShowQuestions] = useState(true);
    const [navigationMode, setNavigationMode] = useState(false); // ESC toggle for navigation

    // Debounce save ref
    const saveTimeout = useRef(null);
    const notesTextareaRef = useRef(null);
    const cursorPositionRef = useRef(0); // Track cursor position

    useEffect(() => {
        fetchSession();
    }, [id]);

    useEffect(() => {
        if (session && session.students && session.students[currentIndex]) {
            setNote(session.students[currentIndex].notes || '');
            const currentGrade = session.students[currentIndex].grade || 0;
            setGrade(currentGrade);
            setSavedGrade(currentGrade);
        }
    }, [currentIndex, session]);

    // Keyboard navigation with ESC toggle
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Grading shortcut: Enter to confirm grade
            // Only if we are not in the textarea (unless Ctrl+Enter?) or if we explicitly focus the grade area
            // Ideally, the user wants "enter confirms it". 
            // If they are in the note box, Enter usually means new line.
            // Let's implement: If specific grade squares are focused or global hotkeys?
            // "when we press enter it confirms it" implies after selecting?
            // Let's assume global Enter saves grade if it changed? Or strictly when focusing grade controls.
            // Simplified: If not in textarea, Enter saves. The user probably clicks, then hits Enter?

            // ESC key toggles navigation mode
            if (e.key === 'Escape') {
                e.preventDefault();

                if (navigationMode) {
                    // Exiting navigation mode - restore focus
                    setNavigationMode(false);
                    if (notesTextareaRef.current) {
                        notesTextareaRef.current.focus();
                        // Restore cursor position
                        setTimeout(() => {
                            if (notesTextareaRef.current) {
                                notesTextareaRef.current.setSelectionRange(
                                    cursorPositionRef.current,
                                    cursorPositionRef.current
                                );
                            }
                        }, 0);
                    }
                } else {
                    // Entering navigation mode - save cursor position and blur
                    if (notesTextareaRef.current) {
                        cursorPositionRef.current = notesTextareaRef.current.selectionStart;
                        notesTextareaRef.current.blur();
                    }
                    setNavigationMode(true);
                }
                return;
            }

            // Arrow key navigation
            // Works in navigation mode OR when not focused on input/textarea
            const isInputFocused = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

            if (e.key === 'Enter' && !isInputFocused) {
                // Confirm grade if not editing text
                handleSaveGrade();
                return;
            }

            // Shift key to cycle grades in Navigation Mode
            if (navigationMode && e.key === 'Shift') {
                setGrade(prev => (prev >= 5 ? 1 : prev + 1));
                return;
            }

            if (!navigationMode && isInputFocused) {
                return; // Don't navigate if in editing mode and typing
            }

            if (e.key === 'ArrowRight' && session?.students && currentIndex < session.students.length - 1) {
                e.preventDefault();
                setCurrentIndex(prev => prev + 1);
            } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                e.preventDefault();
                setCurrentIndex(prev => prev - 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, session, navigationMode]);

    const fetchSession = async () => {
        try {
            const data = await getSession(id);
            if (!data) throw new Error("Session not found");
            setSession(data);

            // Pre-load results
            const initialResults = {};
            if (data.students && Array.isArray(data.students)) {
                data.students.forEach(s => {
                    if (s.result) initialResults[s.id] = s.result;
                });
            }
            setResults(initialResults);
        } catch (err) {
            console.error('Error fetching session:', err);
            toast.error("Error loading session. Please try again.");
            navigate('/');
        }
    };

    const saveNote = async (content) => {
        if (!session?.students?.[currentIndex]) return;

        setSaving(true);
        try {
            const studentId = session.students[currentIndex].id;
            await saveStudentNotes(session.id, studentId, content);

            setSession(prev => {
                if (!prev) return prev;
                const newStudents = [...prev.students];
                newStudents[currentIndex].notes = content;
                return { ...prev, students: newStudents };
            });
        } catch (err) {
            console.error('Failed to save note', err);
        } finally {
            setSaving(false);
        }
    };

    const handleNoteChange = (e) => {
        const content = e.target.value;
        setNote(content);
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
            saveNote(content);
        }, 1000);
    };

    const handleSaveGrade = async () => {
        if (!session?.students?.[currentIndex]) return;
        const studentId = session.students[currentIndex].id;

        try {
            await saveStudentGrade(session.id, studentId, grade);
            setSavedGrade(grade);

            // Update local state
            setSession(prev => {
                const newStudents = [...prev.students];
                newStudents[currentIndex].grade = grade;
                return { ...prev, students: newStudents };
            });

            // Visual feedback could be added here (toast)
        } catch (err) {
            console.error('Failed to save grade', err);
            toast.error("Failed to save grade");
        }
    };

    const handleNext = () => {
        if (session?.students && currentIndex < session.students.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const [generatingStudent, setGeneratingStudent] = useState(null);

    const handleGenerateReports = async () => {
        if (!session?.students) return;
        const isConfirmed = await confirm("Generate AI reports for all students?");
        if (!isConfirmed) return;

        setGenerating(true);
        const newResults = { ...results };

        try {
            for (const student of session.students) {
                if (student.status === 'absent') {
                    console.log(`Skipping AI report for absent student: ${student.name}`);
                    continue;
                }
                if (newResults[student.id]) continue;

                setGeneratingStudent(student.id);

                const feedback = await generateFeedback(student.name, session.topicName || session.groupName, student.notes || "Participated in session.");
                newResults[student.id] = feedback;
                setResults({ ...newResults }); // Update UI progressively

                await saveStudentResult(session.id, student.id, feedback);
            }

            fetchSession(); // Refresh status
            toast.success("Reports generated!");
        } catch (err) {
            console.error('Error generating feedback:', err);
            toast.error("Failed to generate some reports. Please try again.");
        } finally {
            setGeneratingStudent(null);
            setGenerating(false);
        }
    };

    const handleFinishSession = async () => {
        const isConfirmed = await confirm("Are you sure you want to finish this session? This will mark it as completed.");
        if (!isConfirmed) return;
        try {
            await endSession(session.id);
            navigate('/');
        } catch (err) {
            console.error('Error finishing session:', err);
            toast.error("Failed to finish session");
        }
    };

    const handleToggleAbsence = async (studentId, currentStatus) => {
        const newStatus = currentStatus === 'absent' ? 'present' : 'absent';
        if (newStatus === 'absent') {
            const isConfirmed = await confirm("Mark this student as absent? A PTO notification will be queued to send when you click 'Send All to Discord'.");
            if (!isConfirmed) return;
        }

        try {
            await toggleStudentStatus(session.id, studentId, newStatus);
            // Update local state immediately
            setSession(prev => {
                const newStudents = prev.students.map(s =>
                    s.id === studentId ? { ...s, status: newStatus } : s
                );
                return { ...prev, students: newStudents };
            });
        } catch (err) {
            console.error('Error toggling status:', err);
            toast.error("Failed to update status");
        }
    };

    const handleRemoveStudent = async (studentId, studentName) => {
        const isConfirmed = await confirm(`Are you completely sure you want to permanently remove ${studentName} from this session? This action cannot be undone.`);
        if (!isConfirmed) return;

        try {
            await removeSessionStudent(session.id, studentId);
            setSession(prev => {
                const newStudents = prev.students.filter(s => s.id !== studentId);
                // If this was the last student, maybe redirect to dashboard
                if (newStudents.length === 0) {
                    toast.success("Last student removed. Session empty.");
                    navigate('/');
                }
                return { ...prev, students: newStudents };
            });
            // Adjust currentIndex if necessary
            if (currentIndex >= session.students.length - 1 && currentIndex > 0) {
                setCurrentIndex(prev => prev - 1);
            }
            toast.success(`${studentName} removed from session.`);
        } catch (err) {
            console.error('Error removing student:', err);
            toast.error(err.message || "Failed to remove student");
        }
    };

    // 3-state cycle: not asked → correct (green) → incorrect (red) → not asked
    const handleQuestionClick = async (questionId) => {
        if (!session?.students?.[currentIndex]) return;
        const student = session.students[currentIndex];

        let newAnswered = [...(student.answeredQuestions || [])];
        let newIncorrect = [...(student.incorrectQuestions || [])];

        const isAnswered = newAnswered.includes(questionId);
        const isIncorrect = newIncorrect.includes(questionId);

        if (!isAnswered && !isIncorrect) {
            // State: Not asked → Correct (green)
            newAnswered.push(questionId);
        } else if (isAnswered && !isIncorrect) {
            // State: Correct → Incorrect (red)
            newAnswered = newAnswered.filter(id => id !== questionId);
            newIncorrect.push(questionId);
        } else if (isIncorrect) {
            // State: Incorrect → Not asked (default)
            newIncorrect = newIncorrect.filter(id => id !== questionId);
        }

        // Optimistic UI update
        setSession(prev => {
            const newStudents = [...prev.students];
            newStudents[currentIndex] = {
                ...student,
                answeredQuestions: newAnswered,
                incorrectQuestions: newIncorrect
            };
            return { ...prev, students: newStudents };
        });

        try {
            await saveStudentQuestions(session.id, student.id, { answered: newAnswered, incorrect: newIncorrect });
        } catch (err) {
            console.error('Error saving question state:', err);
        }
    };

    // For backwards compatibility if double-click is still used somewhere
    const handleQuestionDoubleClick = (questionId) => {
        // Double-click now does nothing since single-click cycles through states
        // This prevents the default text selection behavior
    };

    const handleSendToDiscord = async (studentId) => {
        setSentStatus(prev => ({ ...prev, [studentId]: 'sending' }));
        try {
            await sendToDiscord(session.id, studentId);
            setSentStatus(prev => ({ ...prev, [studentId]: true }));
        } catch (err) {
            console.error(err);
            setSentStatus(prev => ({ ...prev, [studentId]: false }));
            toast.error("Failed to send message: " + (err.message || "Unknown error"));
        }
    };

    const handleSendAllToDiscord = async () => {
        const isConfirmed = await confirm("Are you sure you want to send feedback to ALL students via Discord?");
        if (!isConfirmed) return;

        setGenerating(true);
        try {
            const data = await sendAllToDiscord(session.id);
            if (data.summary) {
                const newStatuses = { ...sentStatus };
                let sentCount = 0;
                let absentCount = 0;
                let errorCount = 0;

                data.summary.forEach(item => {
                    const s = session.students.find(st => st.name === item.student);
                    if (s) {
                        newStatuses[s.id] = item.success;
                    }
                    if (item.success) {
                        if (item.type === 'absent_notification') absentCount++;
                        else sentCount++;
                    } else {
                        errorCount++;
                    }
                });
                setSentStatus(newStatuses);
                toast.success(`Batch processing complete.\n\n✅ Reports Sent: ${sentCount}\nzzz Absent Notifications: ${absentCount}\n❌ Errors: ${errorCount}`);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to execute batch send.");
        } finally {
            setGenerating(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!session) return;
        const doc = new jsPDF();
        let y = 10;
        doc.setFontSize(16);
        doc.text(`PLD Report: ${session.groupName}`, 10, y);
        y += 10;
        doc.setFontSize(12);
        doc.text(`Date: ${new Date(session.createdAt).toLocaleDateString()}`, 10, y);
        y += 15;

        session.students.forEach(student => {
            if (y > 250) { doc.addPage(); y = 10; }
            doc.setFontSize(14);
            doc.setTextColor(211, 47, 47);
            doc.text(`Student: ${student.name} (${student.discord || 'No Discord'})`, 10, y);
            doc.setTextColor(0);
            y += 7;

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text("Mentor Notes:", 10, y);
            doc.setFont(undefined, 'normal');
            y += 5;
            const splitNotes = doc.splitTextToSize(student.notes || "No notes", 180);
            doc.text(splitNotes, 10, y);
            y += (splitNotes.length * 5) + 5;

            if (results[student.id]) {
                doc.setFont(undefined, 'bold');
                doc.text("AI Feedback:", 10, y);
                doc.setFont(undefined, 'normal');
                y += 5;
                const cleanFeedback = results[student.id].replace(/\*\*/g, '').replace(/###/g, '');
                const splitFeedback = doc.splitTextToSize(cleanFeedback, 180);
                doc.text(splitFeedback, 10, y);
                y += (splitFeedback.length * 5) + 10;
            } else {
                y += 10;
            }

            doc.setDrawColor(200);
            doc.line(10, y, 200, y);
            y += 10;
        });

        doc.save(`${session.groupName.replace(/[^a-z0-9]/gi, '_')}_Report.pdf`);
    };

    if (!session) return (
        <div className="container flex-center" style={{ height: '80vh', flexDirection: 'column' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '1rem' }}>Loading session data...</p>
        </div>
    );

    const currentStudent = session.students?.[currentIndex];
    const progressText = session.students ? `Student ${currentIndex + 1} / ${session.students.length}` : '';

    if (!currentStudent) return <div className="container">No students found in this session.</div>;

    return (
        <div>
            <div className="session-header-row">
                <div>
                    <button onClick={() => navigate('/')} className="btn-outline" style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', border: 'none', padding: 0 }}>
                        <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} /> Back to Dashboard
                    </button>
                    <h1>{session.groupName}</h1>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                        <span>Status: <strong style={{ color: session.status === 'completed' ? '#4CAF50' : 'var(--color-primary)' }}>{session.status.toUpperCase()}</strong></span>
                        {session.topicNames && session.topicNames.length > 0 ? (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {session.topicNames.map((name, i) => (
                                    <span key={i} style={{
                                        background: 'var(--bg-card)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--color-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem'
                                    }}>
                                        <HelpCircle size={12} /> {name}
                                    </span>
                                ))}
                            </div>
                        ) : session.topicName && (
                            <span style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <HelpCircle size={16} /> {session.topicName}
                            </span>
                        )}
                    </div>
                </div>
                <div className="session-header-buttons">
                    {session.questions && session.questions.length > 0 && (
                        <button
                            onClick={() => setShowQuestions(!showQuestions)}
                            className={`btn ${showQuestions ? 'btn-primary' : 'btn-outline'} flex-center`}
                            title={showQuestions ? 'Hide Sidebar' : 'Show Sidebar'}
                        >
                            <HelpCircle size={18} style={{ marginRight: '0.5rem' }} /> {showQuestions ? 'Hide Questions' : 'Show Questions'}
                        </button>
                    )}
                    {Object.keys(results).length > 0 && (
                        <button onClick={handleDownloadPDF} className="btn btn-outline flex-center">
                            <Download size={18} style={{ marginRight: '0.5rem' }} /> Download PDF
                        </button>
                    )}
                    {(session.status === 'active' || Object.keys(results).length < session.students.length) && (
                        <button
                            onClick={handleGenerateReports}
                            className="btn btn-primary flex-center"
                            disabled={generating}
                        >
                            <Lightbulb size={18} style={{ marginRight: '0.5rem' }} />
                            {generating ? 'Generating...' : (Object.keys(results).length > 0 ? 'Regenerate Reports' : 'Generate AI Reports')}
                        </button>
                    )}
                    {session.status === 'active' && (
                        <button
                            onClick={handleFinishSession}
                            className="btn flex-center"
                            style={{ background: '#d32f2f', color: 'white', border: 'none' }}
                        >
                            <XCircle size={18} style={{ marginRight: '0.5rem' }} /> Finish Session
                        </button>
                    )}
                    <button
                        onClick={handleSendAllToDiscord}
                        className="btn flex-center"
                        style={{ background: '#5865F2', color: 'white', border: 'none' }}
                        disabled={generating || (Object.keys(results).length === 0 && !session.students.some(s => s.status === 'absent'))}
                    >
                        <Send size={18} style={{ marginRight: '0.5rem' }} />
                        Send All to Discord
                    </button>
                </div>
            </div>

            <div className={`session-grid ${session.questions && session.questions.length > 0 && showQuestions ? 'has-sidebar' : ''}`}>
                <div className="card" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
                    <div className="flex-between" style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                        <button onClick={handlePrev} disabled={currentIndex === 0} className="btn-icon" style={{ padding: '10px', opacity: currentIndex === 0 ? 0.3 : 1 }}>
                            <ArrowLeft size={32} />
                        </button>

                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>{currentStudent.name}</h2>
                            <div style={{ color: 'var(--text-secondary)' }}>{currentStudent.discord || 'No Discord ID'}</div>
                            <div style={{ marginTop: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{progressText}</div>
                        </div>

                        <button onClick={handleNext} disabled={currentIndex === session.students.length - 1} className="btn-icon" style={{ padding: '10px', opacity: currentIndex === session.students.length - 1 ? 0.3 : 1 }}>
                            <ArrowRight size={32} />
                        </button>
                    </div>

                    <div className="session-inner-grid">
                        <div className="session-col">
                            <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                                <label style={{ fontWeight: '600' }}>Mentor Notes</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {navigationMode && (
                                        <span style={{
                                            fontSize: '0.75rem',
                                            color: 'white',
                                            background: 'var(--color-primary)',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontWeight: '600'
                                        }}>
                                            🎯 Navigation Mode (ESC to exit)
                                        </span>
                                    )}
                                    {saving && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}><Save size={12} style={{ marginRight: 4 }} /> Saving...</span>}
                                    <button
                                        onClick={() => handleRemoveStudent(currentStudent.id, currentStudent.name)}
                                        className="btn btn-outline"
                                        style={{
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            color: '#d32f2f',
                                            borderColor: '#d32f2f',
                                            marginLeft: '1rem'
                                        }}
                                        title="Drop student from session completely"
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> Remove</span>
                                    </button>
                                    <button
                                        onClick={() => handleToggleAbsence(currentStudent.id, currentStudent.status || 'present')}
                                        className="btn btn-outline"
                                        style={{
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            color: currentStudent.status === 'absent' ? '#d32f2f' : 'var(--text-secondary)',
                                            borderColor: currentStudent.status === 'absent' ? '#d32f2f' : 'var(--border-color)'
                                        }}
                                    >
                                        {currentStudent.status === 'absent' ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><PhoneOff size={12} /> Mark Present</span>
                                        ) : (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> Mark Absent</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <textarea
                                ref={notesTextareaRef}
                                className="input-control"
                                style={{
                                    flex: 1,
                                    minHeight: '350px',
                                    resize: 'none',
                                    padding: '1.25rem',
                                    lineHeight: '1.6',
                                    fontSize: '1rem',
                                    background: currentStudent.status === 'absent' ? 'var(--bg-app)' : 'var(--bg-input)',
                                    color: currentStudent.status === 'absent' ? 'var(--text-secondary)' : 'inherit'
                                }}
                                value={currentStudent.status === 'absent' ? "Student marked as absent." : note}
                                onChange={handleNoteChange}
                                disabled={currentStudent.status === 'absent'}
                                placeholder="Type performance observations, evaluation results, and common issues..."
                            />

                            {/* Grading System */}
                            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                                    <label style={{ fontWeight: '600', fontSize: '0.9rem' }}>Grade Performance</label>
                                    {grade !== savedGrade && <span style={{ fontSize: '0.75rem', color: '#ff9800' }}>Unsaved (Press Enter)</span>}
                                    {grade === savedGrade && grade > 0 && <span style={{ fontSize: '0.75rem', color: '#4CAF50' }}>Saved</span>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {[1, 2, 3, 4, 5].map(val => (
                                        <div
                                            key={val}
                                            onClick={() => setGrade(val)}
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '4px',
                                                border: `2px solid ${grade >= val ? 'var(--color-primary)' : 'var(--border-color)'}`,
                                                background: grade >= val ? 'var(--color-primary)' : 'transparent',
                                                color: grade >= val ? 'white' : 'var(--text-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                transition: 'all 0.2s ease'
                                            }}
                                            title={`Rate ${val}/5`}
                                        >
                                            {val}
                                        </div>
                                    ))}
                                    <button
                                        onClick={handleSaveGrade}
                                        disabled={grade === savedGrade}
                                        className="btn-outline"
                                        style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Result View */}
                        <div className="session-col">
                            <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                                <label style={{ fontWeight: '600' }}>AI Evaluation Result</label>
                                {results[currentStudent.id] && (
                                    <button
                                        onClick={() => handleSendToDiscord(currentStudent.id)}
                                        className="btn"
                                        style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', background: sentStatus[currentStudent.id] === true ? '#4CAF50' : '#5865F2', color: 'white', border: 'none' }}
                                        disabled={sentStatus[currentStudent.id] === true || sentStatus[currentStudent.id] === 'sending'}
                                    >
                                        <Send size={12} style={{ marginRight: '4px' }} />
                                        {sentStatus[currentStudent.id] === 'sending' ? 'Sending...' : (sentStatus[currentStudent.id] === true ? 'Sent to Discord' : 'Send Individually')}
                                    </button>
                                )}
                            </div>
                            {results[currentStudent.id] ? (
                                <div style={{ flex: 1, whiteSpace: 'pre-wrap', fontSize: '0.95rem', overflowY: 'auto', maxHeight: '500px', background: 'var(--bg-app)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                    {results[currentStudent.id]}
                                </div>
                            ) : generatingStudent === currentStudent.id ? (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '2px dashed var(--color-primary)', borderRadius: 'var(--radius-sm)', padding: '2rem', background: 'rgba(var(--color-primary-rgb, 67, 97, 238), 0.05)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                                        <p style={{ color: 'var(--color-primary)', fontWeight: '600' }}>Generating AI Report...</p>
                                        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>This usually takes 5-10 seconds per student.</p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '2rem' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <Lightbulb size={32} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                                        <p>Collect notes, then click "Generate AI Reports" to see results here.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {session.questions && session.questions.length > 0 && showQuestions && (
                    <div style={{ 
                        height: 'fit-content', 
                        position: 'sticky', 
                        top: '2rem', 
                        animation: 'fadeIn 0.3s ease', 
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)',
                        padding: '1.25rem',
                        borderTop: '1px solid var(--border-color)',
                        borderRight: '1px solid var(--border-color)',
                        borderBottom: '1px solid var(--border-color)',
                        borderLeft: '4px solid var(--color-primary)'
                    }}>
                        <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem', paddingBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <BookOpen size={20} /> <span>Session Questions</span>
                            </h3>
                            <small style={{ color: 'var(--text-secondary)' }}>{session.questions.length} questions available</small>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {session.questions.map((q, idx) => {
                                const firstIdx = session.questions.findIndex(x => x.id === q.id);
                                const qId = (q.id && firstIdx === idx) ? q.id : (q.id ? `${q.id}_${idx}` : idx);

                                const isAnswered = currentStudent.answeredQuestions && currentStudent.answeredQuestions.includes(qId);
                                const isIncorrect = currentStudent.incorrectQuestions && currentStudent.incorrectQuestions.includes(qId);

                                let bgColor = 'var(--bg-app)';
                                let borderColor = 'var(--color-primary)';
                                let textColor = 'var(--color-primary)';
                                let statusText = `Question ${idx + 1}`;

                                if (isAnswered) {
                                    bgColor = 'rgba(34, 197, 94, 0.1)';
                                    borderColor = '#22c55e';
                                    textColor = '#22c55e';
                                    statusText = '✓ Correct';
                                } else if (isIncorrect) {
                                    bgColor = 'rgba(239, 68, 68, 0.1)';
                                    borderColor = '#ef4444';
                                    textColor = '#ef4444';
                                    statusText = '✗ Incorrect';
                                }

                                return (
                                    <div
                                        key={qId}
                                        onClick={() => handleQuestionClick(qId)}
                                        onDoubleClick={() => handleQuestionDoubleClick(qId)}
                                        style={{
                                            fontSize: '0.9rem',
                                            padding: '1rem',
                                            background: bgColor,
                                            borderRadius: '8px',
                                            borderTopWidth: (isAnswered || isIncorrect) ? '1px' : '0px',
                                            borderTopStyle: 'solid',
                                            borderTopColor: borderColor,
                                            borderRightWidth: (isAnswered || isIncorrect) ? '1px' : '0px',
                                            borderRightStyle: 'solid',
                                            borderRightColor: borderColor,
                                            borderBottomWidth: (isAnswered || isIncorrect) ? '1px' : '0px',
                                            borderBottomStyle: 'solid',
                                            borderBottomColor: borderColor,
                                            borderLeftWidth: '4px',
                                            borderLeftStyle: 'solid',
                                            borderLeftColor: borderColor,
                                            boxShadow: 'var(--shadow-sm)',
                                            position: 'relative',
                                            cursor: 'pointer',
                                            userSelect: 'none', // Prevent text selection on double click
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                                            <div style={{ fontWeight: 'bold', color: textColor, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                {statusText}
                                            </div>
                                            {q.topicName && (
                                                <div style={{
                                                    fontSize: '0.65rem',
                                                    background: borderColor,
                                                    color: 'white',
                                                    padding: '1px 6px',
                                                    borderRadius: '3px',
                                                    fontWeight: '600'
                                                }}>
                                                    {q.topicName}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ color: (isAnswered || isIncorrect) ? textColor : 'var(--text-main)', lineHeight: '1.5' }}>{q.text || q}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
