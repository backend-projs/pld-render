import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Play, CheckCircle, HelpCircle, Shield, X, Users, Code, Lock, Layout, LayoutPanelLeft } from 'lucide-react';
import { 
    getSession, 
    toggleWorkshopPermission, 
    updateWorkshopCode, 
    getMasterStudents, 
    addSessionStudent,
    evaluateCode,
    tutorReview,
    submitWorkshopCode
} from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import CodeEditor from '../components/CodeEditor';
import './SessionRun.css';
import { Panel, Group, Separator } from 'react-resizable-panels';

const ResizeHandle = ({ direction = 'horizontal' }) => (
    <Separator
        style={{
            width: direction === 'horizontal' ? '8px' : '100%',
            height: direction === 'vertical' ? '8px' : '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
            zIndex: 10
        }}
    >
        <div style={{
            width: direction === 'horizontal' ? '2px' : '30px',
            height: direction === 'vertical' ? '2px' : '30px',
            background: 'var(--border-color)',
            borderRadius: '1px',
            transition: 'background 0.2s',
        }} className="resize-handle-inner" />
    </Separator>
);

const LANGUAGE_CONFIG = {
    python: { icon: '🐍', name: 'Python 3.10', command: 'python main.py', filename: 'main.py', defaultCode: '# Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    javascript: { icon: '🟨', name: 'Node.js 18', command: 'node main.js', filename: 'main.js', defaultCode: '// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    java: { icon: '☕', name: 'Java 17', command: 'javac Main.java && java Main', filename: 'Main.java', defaultCode: '// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    csharp: { icon: '#️⃣', name: 'C# .NET 6', command: 'dotnet run', filename: 'Program.cs', defaultCode: '// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    c: { icon: '⚙️', name: 'GCC 11', command: 'gcc main.c -o main && ./main', filename: 'main.c', defaultCode: '// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    cpp: { icon: '⚙️', name: 'G++ 11', command: 'g++ main.cpp -o main && ./main', filename: 'main.cpp', defaultCode: '// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    typescript: { icon: '🔷', name: 'TypeScript 5', command: 'tsc main.ts && node main.js', filename: 'main.ts', defaultCode: '// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    go: { icon: '🐹', name: 'Go 1.21', command: 'go run main.go', filename: 'main.go', defaultCode: '// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    ruby: { icon: '💎', name: 'Ruby 3.2', command: 'ruby main.rb', filename: 'main.rb', defaultCode: '# Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    php: { icon: '🐘', name: 'PHP 8.2', command: 'php main.php', filename: 'main.php', defaultCode: '<?php\n// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    swift: { icon: '🍎', name: 'Swift 5.8', command: 'swift main.swift', filename: 'main.swift', defaultCode: '// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    kotlin: { icon: '🎯', name: 'Kotlin 1.9', command: 'kotlinc Main.kt -include-runtime -d main.jar && java -jar main.jar', filename: 'Main.kt', defaultCode: '// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    rust: { icon: '🦀', name: 'Rust 1.72', command: 'rustc main.rs && ./main', filename: 'main.rs', defaultCode: '// Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    sql: { icon: '🗄️', name: 'PostgreSQL 15', command: 'psql -f main.sql', filename: 'main.sql', defaultCode: '-- Write your solution here\n\n\n\n\n\n\n\n\n\n' },
    lua: { icon: '🌙', name: 'Lua 5.4', command: 'lua main.lua', filename: 'main.lua', defaultCode: '-- Write your solution here\n\n\n\n\n\n\n\n\n\n' }
};

const getNormalizedCode = (codeStr, lang) => {
    if (!codeStr) return LANGUAGE_CONFIG[lang]?.defaultCode || '';
    const trimmed = codeStr.trim();
    if (trimmed === '# Write your solution here' || trimmed === '// Write your solution here' || trimmed === '-- Write your solution here' || trimmed === '<?php\n// Write your solution here') {
        return LANGUAGE_CONFIG[lang]?.defaultCode || '';
    }
    return codeStr;
};

export default function WorkshopWorkspace() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { user } = useAuth();

    const [session, setSession] = useState(null);
    const [myStatus, setMyStatus] = useState(null);
    const [allSubmissions, setAllSubmissions] = useState({});
    const [codeStacks, setCodeStacks] = useState({});
    const [code, setCode] = useState(LANGUAGE_CONFIG.python.defaultCode);
    const [language, setLanguage] = useState('python');
    const [submitting, setSubmitting] = useState(false);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [showPermissions, setShowPermissions] = useState(false);
    const [terminalOutput, setTerminalOutput] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [aiTutorEnabled, setAiTutorEnabled] = useState(() => {
        const saved = localStorage.getItem('aiTutorEnabled');
        return saved === 'true';
    });
    const [showQuestions, setShowQuestions] = useState(() => {
        const saved = localStorage.getItem('showQuestions');
        return saved !== 'false'; // Default to true
    });

    useEffect(() => {
        localStorage.setItem('aiTutorEnabled', String(aiTutorEnabled));
    }, [aiTutorEnabled]);

    useEffect(() => {
        localStorage.setItem('showQuestions', String(showQuestions));
    }, [showQuestions]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [studentIdentifier, setStudentIdentifier] = useState('');
    const [addingStudent, setAddingStudent] = useState(false);
    const [masterStudents, setMasterStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [lastLocalChange, setLastLocalChange] = useState(0);
    const [lastLocalEditPos, setLastLocalEditPos] = useState(null);
    const [remoteEdit, setRemoteEdit] = useState(null);

    const isMentor = user.role === 'mentor';
    const canEdit = isMentor || (myStatus && myStatus.hasWorkshopPermission === true);

    useEffect(() => {
        fetchSession();
        fetchMasterStudentsList();

        const interval = setInterval(fetchSession, 1000);
        return () => clearInterval(interval);
    }, [id]);

    const fetchMasterStudentsList = async () => {
        try {
            const data = await getMasterStudents();
            if (Array.isArray(data)) setMasterStudents(data);
        } catch (err) {
            console.error('Error fetching master students:', err);
        }
    };

    useEffect(() => {
        if (studentIdentifier.trim().length > 1) {
            const filtered = masterStudents.filter(s =>
                s.name.toLowerCase().includes(studentIdentifier.toLowerCase()) ||
                (s.discord && s.discord.toLowerCase().includes(studentIdentifier.toLowerCase()))
            );
            setFilteredStudents(filtered.slice(0, 5));
        } else {
            setFilteredStudents([]);
        }
    }, [studentIdentifier, masterStudents]);

    useEffect(() => {
        if (session?.workshop_data?.submissions) {
            setAllSubmissions(prev => ({ ...prev, ...session.workshop_data.submissions }));
            const initialSub = session.workshop_data.submissions[currentQuestionIdx];
            if (initialSub) {
                const lang = initialSub.language || 'javascript';
                const initialCode = getNormalizedCode(initialSub.code || '', lang);
                setCode(initialCode);
                setLanguage(lang);
            }
        } else if (myStatus?.submissions) {
            setAllSubmissions(myStatus.submissions);
            const initialSub = myStatus.submissions[currentQuestionIdx];
            if (initialSub) {
                const lang = initialSub.language || 'javascript';
                const initialCode = getNormalizedCode(initialSub.code || '', lang);
                setCode(initialCode);
                setLanguage(lang);
                setTerminalOutput(initialSub.output || '');
            }
        }
    }, [session?.id, myStatus?.id]);

    useEffect(() => {
        const sharedSub = session?.workshop_data?.submissions?.[currentQuestionIdx];
        const localSub = allSubmissions[currentQuestionIdx];
        const sub = sharedSub || localSub;

        if (sub) {
            const lang = sub.language || 'python';
            const stackCode = codeStacks[currentQuestionIdx]?.[lang];
            setCode(getNormalizedCode(stackCode !== undefined ? stackCode : (sub.code || ''), lang));
            setLanguage(lang);
            setTerminalOutput(localSub?.output || '');
        } else {
            const stackCode = codeStacks[currentQuestionIdx]?.[language];
            if (stackCode !== undefined) {
                setCode(getNormalizedCode(stackCode, language));
            } else {
                const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.python;
                setCode(config.defaultCode || '');
            }
            setTerminalOutput('');
        }
    }, [currentQuestionIdx]);

    useEffect(() => {
        if (!session?.workshop_data) return;
        const { 
            code: serverCode, 
            language: serverLang, 
            questionIndex: serverIdx, 
            updatedBy, 
            updatedByName,
            updatedAt,
            lastEditPos 
        } = session.workshop_data;
        
        if (updatedBy === user.id) return;
        if (serverIdx !== currentQuestionIdx) return;

        if (updatedAt) {
            const editTime = new Date(updatedAt).getTime();
            if (Date.now() - editTime < 4000 && (!remoteEdit || remoteEdit.timestamp !== updatedAt)) {
                setRemoteEdit({
                    userId: updatedBy,
                    userName: updatedByName,
                    pos: lastEditPos,
                    timestamp: updatedAt
                });
            }
        }

        const timeSinceLastType = Date.now() - lastLocalChange;
        if (timeSinceLastType < 2500) return;

        if (serverCode !== undefined) {
            const normalizedServer = getNormalizedCode(serverCode, serverLang || language);
            if (normalizedServer !== code) {
                setCode(normalizedServer);
                setCodeStacks(prev => ({
                    ...prev,
                    [currentQuestionIdx]: {
                        ...(prev[currentQuestionIdx] || {}),
                        [serverLang || language]: normalizedServer
                    }
                }));
            }
        }
        if (serverLang !== undefined && serverLang !== language) {
            setLanguage(serverLang);
        }
    }, [session?.workshop_data, currentQuestionIdx]);

    useEffect(() => {
        if (!canEdit) return;
        if (Date.now() - lastLocalChange > 5000) return;
        
        const timer = setTimeout(async () => {
            try {
                await updateWorkshopCode(id, { 
                    code, 
                    language, 
                    questionIndex: currentQuestionIdx,
                    lastEditPos: lastLocalEditPos
                });
            } catch (err) {
                console.error("Failed to sync code:", err);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [code, language, currentQuestionIdx, id, canEdit, lastLocalEditPos]);

    const handleQuestionSwitch = (newIdx) => {
        setAllSubmissions(prev => ({
            ...prev,
            [currentQuestionIdx]: {
                code,
                language,
                output: terminalOutput
            }
        }));
        
        setCodeStacks(prev => ({
            ...prev,
            [currentQuestionIdx]: {
                ...(prev[currentQuestionIdx] || {}),
                [language]: code
            }
        }));

        setCurrentQuestionIdx(newIdx);
    };

    const handleLanguageChange = (newLang) => {
        setCodeStacks(prev => ({
            ...prev,
            [currentQuestionIdx]: {
                ...(prev[currentQuestionIdx] || {}),
                [language]: code
            }
        }));

        setLanguage(newLang);
        setLastLocalChange(Date.now());

        setCodeStacks(prev => {
            const existingCode = prev[currentQuestionIdx]?.[newLang];
            if (existingCode !== undefined) {
                setCode(existingCode);
            } else {
                const newConfig = LANGUAGE_CONFIG[newLang] || LANGUAGE_CONFIG.python;
                setCode(newConfig.defaultCode || '');
            }
            return prev;
        });

        setAllSubmissions(prev => ({
            ...prev,
            [currentQuestionIdx]: {
                ...(allSubmissions[currentQuestionIdx] || {}),
                language: newLang
            }
        }));
    };

    const fetchSession = async () => {
        try {
            const data = await getSession(id);
            if (!data) throw new Error("Session not found");
            setSession(data);

            const me = data.students?.find(s => s.discord === user.discordId || s.discord === user.username);
            if (me) {
                setMyStatus(me);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load session");
        }
    };

    const handleTogglePermission = async (studentId, currentPerm) => {
        try {
            const newPerm = !currentPerm;
            await toggleWorkshopPermission(session.id, studentId, newPerm);
            setSession(prev => ({
                ...prev,
                students: prev.students.map(s => s.id === studentId ? { ...s, hasWorkshopPermission: newPerm } : s)
            }));
            toast.success(`Permission ${newPerm ? 'granted' : 'revoked'}`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to update permission");
        }
    };

    const handleBulkPermission = async (grant) => {
        try {
            const studentIds = session.students?.map(s => s.id) || [];
            if (studentIds.length === 0) return;
            await Promise.all(studentIds.map(id => toggleWorkshopPermission(session.id, id, grant)));

            setSession(prev => ({
                ...prev,
                students: prev.students.map(s => ({ ...s, hasWorkshopPermission: grant }))
            }));
            toast.success(`Permissions ${grant ? 'granted' : 'revoked'} for all students`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to update bulk permissions");
        }
    };

    const handleAddStudent = async (identifierOverride) => {
        const idToUse = identifierOverride || studentIdentifier;
        if (!idToUse.trim()) return;

        setAddingStudent(true);
        try {
            const data = await addSessionStudent(session.id, idToUse);
            setSession(data);
            setStudentIdentifier('');
            setFilteredStudents([]);
            toast.success("Student added to session!");
        } catch (err) {
            console.error(err);
            toast.error(err.message || 'Failed to add student');
        } finally {
            setAddingStudent(false);
        }
    };

    const handleSubmitCode = async () => {
        if (!code.trim()) { toast.error("Please write some code."); return; }
        setSubmitting(true);
        setTerminalOutput({ type: 'loading', message: 'Executing...' });

        try {
            const data = await evaluateCode({
                language,
                code,
                tutorMode: false,
                expectedOutput: currentQuestion?.text || null
            });

            if (aiTutorEnabled) {
                data.tutorLoading = true;
            }

            setTerminalOutput(data);

            setAllSubmissions(prev => ({
                ...prev,
                [currentQuestionIdx]: {
                    code,
                    language,
                    output: data,
                    feedback: null
                }
            }));

            if (user.role === 'student' && myStatus) {
                await submitWorkshopCode(session.id, myStatus.id, {
                    code,
                    language,
                    feedback: null,
                    sessionId: session.id,
                    questionIndex: currentQuestionIdx,
                    output: data.output
                });
            }

            if (aiTutorEnabled) {
                try {
                    const tutorData = await tutorReview({
                        language,
                        code,
                        expectedOutput: currentQuestion?.text || null,
                        realOutput: data.output
                    });

                    const updatedData = {
                        ...data,
                        tutorLoading: false,
                        explanation: tutorData.explanation,
                        suggestions: tutorData.suggestions,
                        hints: tutorData.hints,
                        codeQuality: tutorData.codeQuality
                    };

                    setTerminalOutput(updatedData);

                    setAllSubmissions(prev => ({
                        ...prev,
                        [currentQuestionIdx]: {
                            ...prev[currentQuestionIdx],
                            output: updatedData,
                            feedback: tutorData.explanation
                        }
                    }));

                    if (user.role === 'student' && myStatus) {
                        await submitWorkshopCode(session.id, myStatus.id, {
                            code,
                            language,
                            feedback: tutorData.explanation,
                            sessionId: session.id,
                            questionIndex: currentQuestionIdx,
                            output: data.output
                        });
                    }
                    toast.success("AI Review Complete!");
                } catch (tutorErr) {
                    console.error("Tutor Error:", tutorErr);
                    setTerminalOutput(prev => ({ ...prev, tutorLoading: false, explanation: "AI Tutor failed to analyze the code." }));
                }
            } else {
                toast.success("Code executed!");
            }

        } catch (err) {
            setTerminalOutput({ type: 'error', message: err.message });
            toast.error(err.message || 'Failed to submit code.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderTerminalOutput = () => {
        if (!terminalOutput) return <span style={{ color: '#555' }}>Output will appear here after running your code...</span>;
        if (typeof terminalOutput === 'string') return terminalOutput;
        if (terminalOutput.type === 'loading') return <span style={{ color: '#888' }}>{terminalOutput.message}</span>;
        if (terminalOutput.type === 'error') return <span style={{ color: '#ef4444' }}>{terminalOutput.message}</span>;

        const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.python;
        const isSuccess = terminalOutput.exitCode === 0;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ color: 'var(--terminal-prompt)', opacity: 0.8 }}>$ {config.command}</div>
                    {terminalOutput.executionMode && (
                        <div style={{
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            background: terminalOutput.executionMode === 'real' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                            color: terminalOutput.executionMode === 'real' ? '#4ade80' : '#c084fc',
                            border: `1px solid ${terminalOutput.executionMode === 'real' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`
                        }}>
                            {terminalOutput.executionMode === 'real' ? '⚡ Real Execution' : '🤖 AI Predicted'}
                        </div>
                    )}
                </div>

                {terminalOutput.securityWarning && (
                    <div style={{ padding: '0.5rem', marginBottom: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '4px', fontSize: '0.85rem', borderLeft: '3px solid #ef4444' }}>
                        ⚠️ {terminalOutput.securityWarning}
                    </div>
                )}

                <div style={{ color: isSuccess ? 'var(--terminal-text)' : 'var(--terminal-error)', padding: '0.5rem 0' }}>
                    {terminalOutput.output}
                </div>
                <div style={{
                    color: isSuccess ? 'var(--terminal-success)' : 'var(--terminal-error)',
                    marginTop: '1rem',
                    borderTop: '1px dashed var(--terminal-border)',
                    paddingTop: '0.5rem',
                    display: 'flex',
                    justifyContent: 'space-between'
                }}>
                    <span>
                        {isSuccess ? '✓ Process exited with code 0' : `✗ Process exited with code ${terminalOutput.exitCode || 1}`}
                    </span>
                    <span style={{ color: 'var(--terminal-prompt)' }}>[{terminalOutput.executionTime || 45}ms]</span>
                </div>
                {aiTutorEnabled && terminalOutput.explanation && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--terminal-bg-accent)', borderRadius: '8px', borderLeft: '4px solid var(--color-primary)', fontFamily: 'sans-serif' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🤖 AI Tutor Feedback
                        </div>
                        <div style={{ color: 'var(--terminal-text)', marginBottom: '1rem', lineHeight: '1.5' }}>{terminalOutput.explanation}</div>

                        {terminalOutput.suggestions && terminalOutput.suggestions.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong style={{ color: 'var(--terminal-suggestion)' }}>Suggestions:</strong>
                                <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', color: 'var(--terminal-text)' }}>
                                    {terminalOutput.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        )}

                        {terminalOutput.hints && terminalOutput.hints.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong style={{ color: 'var(--terminal-hint)' }}>Hints:</strong>
                                <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', color: 'var(--terminal-text)' }}>
                                    {terminalOutput.hints.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        )}

                        {terminalOutput.codeQuality && (
                            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                <strong style={{ color: 'var(--terminal-quality-label)' }}>Code Quality:</strong>
                                <span style={{ background: 'var(--terminal-score-bg)', padding: '2px 6px', borderRadius: '4px', color: 'var(--terminal-score-text)' }}>
                                    {terminalOutput.codeQuality.score}/10
                                </span>
                                <span style={{ color: 'var(--terminal-text)', opacity: 0.8 }}>- {terminalOutput.codeQuality.feedback}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (!session || (!myStatus && user.role !== 'mentor')) return null;

    const currentQuestion = session.questions?.[currentQuestionIdx];

    return (
        <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', padding: '1rem', background: 'var(--bg-app)' }}>
            <style>{`
                .resize-handle-inner:hover { background: var(--color-primary) !important; filter: drop-shadow(0 0 4px var(--color-primary-rgb, 67, 97, 238)); }
                
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                @keyframes highlightPulse {
                    0% { background-color: rgba(34, 197, 94, 0.5); transform: scale(1.02); opacity: 1; }
                    20% { transform: scale(1); opacity: 1; }
                    80% { opacity: 1; }
                    100% { background-color: rgba(255, 255, 255, 0.05); opacity: 0.6; }
                }

                @keyframes popupFade {
                    0% { opacity: 0; transform: translateY(10px); }
                    10% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
                
                .premium-modal-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(10, 11, 14, 0.7);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                
                .premium-modal-container {
                    background: rgba(26, 27, 30, 0.8) !important;
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    width: 440px;
                    max-width: 100%;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    animation: modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .premium-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.5rem 1rem;
                    font-size: 0.85rem;
                    font-weight: 600;
                    border-radius: 10px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-card);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }

                .premium-action-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                }

                .premium-action-btn:active {
                    transform: translateY(0);
                }

                .premium-action-btn svg {
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .premium-action-btn:hover svg {
                    transform: scale(1.1);
                }

                .premium-btn-perms {
                    border-color: rgba(var(--color-primary-rgb), 0.3);
                    background: rgba(var(--color-primary-rgb), 0.03);
                    color: var(--color-primary);
                }

                .premium-btn-perms:hover {
                    background: rgba(var(--color-primary-rgb), 0.08);
                    box-shadow: 0 4px 15px rgba(var(--color-primary-rgb), 0.15);
                }

                .premium-btn-tasks {
                    min-width: 120px;
                    justify-content: center;
                }

                .premium-btn-tasks.collapsed {
                    border-color: var(--color-primary);
                    background: rgba(var(--color-primary-rgb), 0.05);
                    color: var(--color-primary);
                }

                .premium-btn-tasks .icon-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .premium-btn-tasks.collapsed .icon-wrapper {
                    transform: rotate(180deg);
                }
            `}</style>

            {/* Workspace Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'var(--bg-card)', padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => navigate('/workshops')} className="btn-outline" style={{ display: 'flex', alignItems: 'center', border: 'none', padding: '0.5rem', background: 'var(--bg-app)', borderRadius: '8px' }}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Code size={20} color="var(--color-primary)" />
                            {session.groupName?.replace('[WORKSHOP] ', '')}
                        </h1>
                        {!isMobile && (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Topic: {session.topicNames?.join(', ') || 'General'}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {!canEdit && !isMentor && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            <Lock size={12} /> {isMobile ? 'Locked' : 'Editor Locked'}
                        </span>
                    )}
                    {isMentor && (
                        <button 
                            onClick={() => setShowPermissions(true)} 
                            className="premium-action-btn premium-btn-perms"
                        >
                            <Shield size={16} /> 
                            <span>{isMobile ? 'Perms' : 'Manage Permissions'}</span>
                        </button>
                    )}
                    <button 
                        onClick={() => setShowQuestions(!showQuestions)} 
                        className={`premium-action-btn premium-btn-tasks ${!showQuestions ? 'collapsed' : ''}`}
                        title={showQuestions ? "Hide Questions" : "Show Questions"}
                    >
                        <div className="icon-wrapper">
                            {showQuestions ? <X size={16} /> : <LayoutPanelLeft size={16} />} 
                        </div>
                        <span>{!isMobile && (showQuestions ? 'Hide Tasks' : 'Show Tasks')}</span>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {!isMobile && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user?.username}</span>}
                        <img src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username}&background=random`} alt="User" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border-color)' }} />
                    </div>
                </div>
            </div>

            <Group orientation={isMobile ? "vertical" : "horizontal"} style={{ flex: 1, height: '100%', gap: '0' }}>
                {/* Tasks & Instructions */}
                {showQuestions && (
                    <>
                        <Panel defaultSize={isMobile ? 30 : 25} minSize={20}>
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(var(--color-primary-rgb, 67, 97, 238), 0.05)' }}>
                                    <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <HelpCircle size={18} />
                                        {isMobile ? `Task ${currentQuestionIdx + 1}` : `Task ${currentQuestionIdx + 1} of ${session.questions?.length || 0}`}
                                    </h2>
                                </div>

                                <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                                    {currentQuestion ? (
                                        <div>
                                            {currentQuestion.topicName && (
                                                <div style={{ display: 'inline-block', padding: '0.2rem 0.4rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                                    {currentQuestion.topicName}
                                                </div>
                                            )}
                                            <div style={{ fontSize: isMobile ? '0.9rem' : '0.95rem' }}>{currentQuestion.text || currentQuestion}</div>
                                        </div>
                                    ) : (
                                        <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
                                            No specific tasks loaded.
                                        </div>
                                    )}
                                </div>

                                {session.questions && session.questions.length > 1 && (
                                    <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-app)', gap: '0.5rem' }}>
                                        <button onClick={() => handleQuestionSwitch(Math.max(0, currentQuestionIdx - 1))} disabled={currentQuestionIdx === 0} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                                            <ArrowLeft size={14} /> Prev
                                        </button>
                                        <button onClick={() => handleQuestionSwitch(Math.min(session.questions.length - 1, currentQuestionIdx + 1))} disabled={currentQuestionIdx === session.questions.length - 1} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                                            Next <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Panel>

                        <ResizeHandle direction={isMobile ? "vertical" : "horizontal"} />
                    </>
                )}

                <Panel defaultSize={showQuestions ? (isMobile ? 70 : 75) : 100}>
                    <Group orientation="vertical" style={{ height: '100%' }}>
                        {/* Editor Panel */}
                        <Panel defaultSize={70} minSize={30}>
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-app)', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        <Code size={14} /> {isMobile ? 'Editor' : 'Code Editor'} {(!canEdit) && "(Read-Only)"}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.25rem', padding: '2px 6px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: aiTutorEnabled ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                                                {isMobile ? 'AI' : 'AI Review'}: {aiTutorEnabled ? 'ON' : 'OFF'}
                                            </span>
                                            <div
                                                style={{
                                                    position: 'relative',
                                                    width: '28px',
                                                    height: '16px',
                                                    background: aiTutorEnabled ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.3s ease'
                                                }}
                                                onClick={() => setAiTutorEnabled(!aiTutorEnabled)}
                                            >
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '2px',
                                                    left: aiTutorEnabled ? '14px' : '2px',
                                                    width: '12px',
                                                    height: '12px',
                                                    background: 'white',
                                                    borderRadius: '50%',
                                                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                }} />
                                            </div>
                                        </div>
                                        <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} className="input-control" style={{ padding: '0.2rem 0.4rem', width: 'auto', height: '28px', fontSize: '0.8rem' }} disabled={!canEdit}>
                                            {Object.entries(LANGUAGE_CONFIG).map(([key, config]) => (
                                                <option key={key} value={key}>
                                                    {config.icon} {config.name.includes('GCC') ? 'C' : config.name.includes('G++') ? 'C++' : config.name.split(' ')[0]}
                                                </option>
                                            ))}
                                        </select>
                                        <button onClick={handleSubmitCode} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.75rem', height: '28px', fontSize: '0.8rem' }} disabled={submitting || !canEdit}>
                                            {submitting ? '...' : <><Play size={12} /> {isMobile ? 'Run' : 'Run Code'}</>}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                                    <CodeEditor
                                        code={code}
                                        onChange={(value, viewUpdate) => {
                                            setCode(value);
                                            setLastLocalChange(Date.now());
                                            setCodeStacks(prev => ({
                                                ...prev,
                                                [currentQuestionIdx]: {
                                                    ...(prev[currentQuestionIdx] || {}),
                                                    [language]: value
                                                }
                                            }));
                                            if (viewUpdate) {
                                                const head = viewUpdate.state.selection.main.head;
                                                setLastLocalEditPos(head);
                                            }
                                        }}
                                        language={language}
                                        readOnly={!canEdit}
                                        remoteEdit={remoteEdit}
                                    />
                                </div>
                            </div>
                        </Panel>

                        <ResizeHandle direction="vertical" />

                        {/* Terminal Panel */}
                        <Panel defaultSize={30} minSize={10}>
                            <div style={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                background: 'var(--bg-card)',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                overflow: 'hidden',
                                boxShadow: 'var(--shadow-inner)'
                            }}>
                                <div style={{
                                    padding: '0.4rem 0.75rem',
                                    borderBottom: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    background: 'var(--bg-app)'
                                }}>
                                    <CheckCircle size={12} color="#22c55e" /> Terminal Output
                                </div>
                                <div style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    color: 'var(--text-main)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.85rem',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: '1.5'
                                }}>
                                    {renderTerminalOutput()}
                                </div>
                            </div>
                        </Panel>
                    </Group>
                </Panel>
            </Group>

            {showPermissions && isMentor && (
                <div className="premium-modal-backdrop" onClick={() => setShowPermissions(false)}>
                    <div className="premium-modal-container" onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'rgba(var(--color-primary-rgb, 67, 97, 238), 0.15)', padding: '0.55rem', borderRadius: '10px' }}>
                                    <Shield size={20} color="var(--color-primary)" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>Permissions</h3>
                            </div>
                            <button onClick={() => setShowPermissions(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', display: 'flex', transition: 'all 0.2s' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ padding: '1.25rem' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                                Grant specific students permission to type code on their own device.
                            </p>

                            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.5rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <input
                                        type="text"
                                        placeholder="Search student..."
                                        value={studentIdentifier}
                                        onChange={(e) => setStudentIdentifier(e.target.value)}
                                        className="input-control"
                                        style={{ flex: 1, height: '34px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.1)' }}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddStudent()}
                                    />
                                    <button
                                        onClick={() => handleAddStudent()}
                                        disabled={addingStudent || !studentIdentifier.trim()}
                                        className="btn btn-primary"
                                        style={{ height: '34px', padding: '0 0.75rem', fontSize: '0.8rem' }}
                                    >
                                        Add
                                    </button>
                                </div>

                                {filteredStudents.length > 0 && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '4px', zIndex: 100, maxHeight: '180px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                                        {filteredStudents.map(s => (
                                            <div
                                                key={s.id}
                                                onClick={() => handleAddStudent(s.discord || s.username)}
                                                style={{ padding: '0.6rem 0.8rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-main)', transition: 'all 0.2s' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-main)'; }}
                                            >
                                                <span style={{ fontWeight: '500' }}>{s.name}</span>
                                                <code style={{ fontSize: '0.75rem', opacity: 0.7, color: 'inherit' }}>{s.discord}</code>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {session.students && session.students.length > 0 && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                    <button onClick={() => handleBulkPermission(true)} className="btn-outline" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', borderColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>
                                        Grant All
                                    </button>
                                    <button onClick={() => handleBulkPermission(false)} className="btn-outline" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
                                        Revoke All
                                    </button>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                                {session.students && session.students.length > 0 ? (
                                    session.students.map(s => (
                                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', color: 'white' }}>
                                                    {s.name?.charAt(0) || 'S'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{s.name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{s.discord}</div>
                                                </div>
                                            </div>

                                            <div style={{ position: 'relative', width: '38px', height: '20px', background: s.hasWorkshopPermission ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.3s ease' }} onClick={() => handleTogglePermission(s.id, !!s.hasWorkshopPermission)}>
                                                <div style={{ position: 'absolute', top: '2px', left: s.hasWorkshopPermission ? '20px' : '2px', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                        <Users size={28} opacity={0.2} />
                                        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>No students joined yet.</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '1rem 1.25rem', background: 'rgba(255, 255, 255, 0.01)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowPermissions(false)} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
