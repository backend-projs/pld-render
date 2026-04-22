// client/src/pages/Questions.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getQuestionSets, addQuestionSet, deleteQuestionSet, deleteAllQuestionSets, updateQuestionSet, getMentors, shareQuestionSet, getUserProfile, getMajors } from '../api';
import { HelpCircle, Trash2, Plus, X, BookOpen, AlertCircle, RefreshCw, FileText, Upload, Edit3, ArrowLeft, Share2, Folder, ChevronRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import * as mammoth from 'mammoth';

export default function Questions() {
    const navigate = useNavigate();
    const location = useLocation();
    const [questionSets, setQuestionSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMajorView, setSelectedMajorView] = useState(null);
    const [error, setError] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [mentors, setMentors] = useState([]);
    const [majors, setMajors] = useState([]);

    // Share modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [sharingSet, setSharingSet] = useState(null);
    const [selectedMentors, setSelectedMentors] = useState([]);

    // Form state
    const [topic, setTopic] = useState('');
    const [questions, setQuestions] = useState(['']); // Array of question strings
    const [editingId, setEditingId] = useState(null);
    const toast = useToast();
    const { confirm } = useConfirm();

    // Check if we came from session creation
    const fromSessionCreation = location.state?.from === 'session-creation';

    useEffect(() => {
        fetchQuestionSets();
        fetchCurrentUser();
        fetchMentorsList();
    }, []);

    const fetchCurrentUser = async () => {
        try {
            const profile = await getUserProfile();
            setCurrentUser(profile);
        } catch (err) {
            console.error("Failed to load user profile:", err);
        }
    };

    const fetchMentorsList = async () => {
        try {
            const data = await getMentors();
            setMentors(data);
        } catch (err) {
            console.error("Failed to load mentors:", err);
        }
    };

    const fetchQuestionSets = async () => {
        setLoading(true);
        setError(null);
        try {
            const [data, majorsData] = await Promise.all([
                getQuestionSets(),
                getMajors()
            ]);

            if (Array.isArray(data)) {
                setQuestionSets(data);
            } else {
                console.error('API returned non-array data:', data);
                setQuestionSets([]);
            }
            setMajors(majorsData);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching question sets or majors:', err);
            setError(err.message || 'Failed to fetch question sets. Please check your connection.');
            setLoading(false);
        }
    };

    const handleAddQuestionRow = () => {
        setQuestions([...questions, '']);
    };

    const handleRemoveQuestionRow = (index) => {
        const newQs = questions.filter((_, i) => i !== index);
        setQuestions(newQs.length ? newQs : ['']);
    };

    const handleQuestionChange = (index, value) => {
        const newQs = [...questions];
        newQs[index] = value;
        setQuestions(newQs);
    };

    const handleAddSet = async (e) => {
        e.preventDefault();
        const validQs = questions.filter(q => q && q.trim());
        if (!topic.trim() || validQs.length === 0) {
            toast.error("Please provide a topic and at least one question.");
            return;
        }

        try {
            if (editingId) {
                const updated = await updateQuestionSet(editingId, { topic, questions: validQs, major: selectedMajorView || 'General' });
                setQuestionSets(questionSets.map(s => s.id === editingId ? updated : s));
                toast.success("Question set updated successfully!");
                cancelEdit();
            } else {
                const newSet = await addQuestionSet({ topic, questions: validQs, major: selectedMajorView || 'General' });
                setQuestionSets([newSet, ...questionSets]);
                setTopic('');
                setQuestions(['']);
            }
        } catch (err) {
            console.error('Error saving question set:', err);
            toast.error('Error saving question set: ' + (err.message || 'Unknown error'));
        }
    };

    const startEdit = (set) => {
        setEditingId(set.id);
        setTopic(set.topic);
        setQuestions(set.questions.map(q => q.text || q));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setTopic('');
        setQuestions(['']);
    };

    const handleDeleteSet = async (id) => {
        const isConfirmed = await confirm('Are you sure you want to delete this topic and all its questions?');
        if (!isConfirmed) return;
        try {
            await deleteQuestionSet(id);
            setQuestionSets(questionSets.filter(s => s.id !== id));
        } catch (err) {
            console.error('Error deleting set:', err);
            toast.error('Error deleting question set');
        }
    };

    const handleDeleteAll = async () => {
        const isConfirmed = await confirm("CAUTION: Are you sure you want to delete ALL question topics? This action is permanent and cannot be undone.");
        if (!isConfirmed) return;

        try {
            await deleteAllQuestionSets();
            setQuestionSets([]);
        } catch (err) {
            console.error('Error deleting all topics:', err);
            toast.error("Error deleting topics");
        }
    };

    const startShare = (set) => {
        setSharingSet(set);
        setSelectedMentors(set.sharedWith || []);
        setShowShareModal(true);
    };

    const handleShareToggle = (mentorId) => {
        if (selectedMentors.includes(mentorId)) {
            setSelectedMentors(selectedMentors.filter(id => id !== mentorId));
        } else {
            setSelectedMentors([...selectedMentors, mentorId]);
        }
    };

    const submitShare = async () => {
        try {
            const updated = await shareQuestionSet(sharingSet.id, selectedMentors);
            setQuestionSets(questionSets.map(s => s.id === sharingSet.id ? updated : s));
            setShowShareModal(false);
            toast.success("Sharing preferences saved successfully!");
        } catch (err) {
            toast.error('Error sharing question set: ' + (err.message || 'Unknown error'));
        }
    };

    const handleWordUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Extract topic as filename (without extension)
        const fileName = file.name.replace(/\.[^/.]+$/, "");

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;
                const result = await mammoth.extractRawText({ arrayBuffer });
                const text = result.value;

                // Improved parser: specifically look for matches starting with a number
                const questionRegex = /(?:^|\n)\s*\d+[\.\)\-]\s+([\s\S]*?)(?=\n\s*\d+[\.\)\-]\s+|$)/g;
                const matches = [...text.matchAll(questionRegex)];

                const cleanedQuestions = matches
                    .map(m => m[1].trim())
                    .filter(q => q.length > 0);

                if (cleanedQuestions.length > 0) {
                    // Create directly in database like student importation
                    const newSet = await addQuestionSet({
                        topic: fileName,
                        questions: cleanedQuestions,
                        major: selectedMajorView || 'General'
                    });

                    setQuestionSets([newSet, ...questionSets]);
                    toast.success(`Successfully imported "${fileName}" with ${cleanedQuestions.length} questions!`);
                } else {
                    toast.error('Could not find any numbered questions in the file.\n\nRequired format: 1. Question, 2. Question, etc.');
                }
            } catch (err) {
                console.error('Word parse error:', err);
                toast.error('Error importing Word file: ' + err.message);
            } finally {
                e.target.value = ''; // Reset input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    if (loading) return (
        <div className="container flex-center" style={{ height: '60vh', flexDirection: 'column', gap: '1rem' }}>
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading Question Bank...</p>
        </div>
    );

    if (error) return (
        <div className="container" style={{ padding: '2rem' }}>
            <div className="card" style={{ textAlign: 'center', borderTop: '4px solid #f44336' }}>
                <AlertCircle size={48} color="#f44336" style={{ marginBottom: '1rem' }} />
                <h2>Oops! Something went wrong</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
                <button onClick={fetchQuestionSets} className="btn btn-primary flex-center" style={{ margin: '0 auto' }}>
                    <RefreshCw size={18} style={{ marginRight: '0.5rem' }} /> Retry
                </button>
            </div>
        </div>
    );

    // Calculate sets per major
    const setsByMajor = questionSets.reduce((acc, set) => {
        const m = set.major || 'General';
        if (!acc[m]) acc[m] = [];
        acc[m].push(set);
        return acc;
    }, {});

    // Only add 'General' if there are sets for it
    const displayMajors = majors.map(m => m.name);
    if (setsByMajor['General']?.length > 0 && !displayMajors.includes('General')) {
        displayMajors.push('General');
    }

    const visibleSets = selectedMajorView ? questionSets.filter(s => (s.major || 'General') === selectedMajorView) : [];

    return (
        <div className="questions-container">
            <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <div>
                    <button
                        onClick={() => {
                            if (selectedMajorView) {
                                setSelectedMajorView(null);
                                cancelEdit();
                            } else {
                                navigate('/', fromSessionCreation ? { state: { returnToSessionCreation: true } } : undefined);
                            }
                        }}
                        className="btn-back-premium"
                    >
                        <ArrowLeft size={18} />
                        {selectedMajorView ? 'Back to Majors' : (fromSessionCreation ? 'Back to Session' : 'Back to Dashboard')}
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <HelpCircle size={32} color="var(--color-primary)" />
                        <h1>{selectedMajorView ? `${selectedMajorView} Questions` : 'Question Bank'}</h1>
                    </div>
                </div>
            </div>

            {!selectedMajorView ? (
                // --- VIEW 1: MAJOR FOLDERS ---
                <>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Select a major to view or create question sets.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {displayMajors.map(major => {
                            const count = setsByMajor[major]?.length || 0;
                            return (
                                <div
                                    key={major}
                                    className="card"
                                    onClick={() => setSelectedMajorView(major)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s', padding: '1.5rem' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--color-primary)' }}>
                                            <Folder size={24} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>{major}</h3>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {count} {count === 1 ? 'set' : 'sets'}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} color="var(--text-secondary)" opacity={0.5} />
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                // --- VIEW 2: QUESTION SETS FOR SELECTED MAJOR ---
                <>
                    <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--color-primary)', background: editingId ? 'rgba(var(--color-primary-rgb), 0.05)' : 'var(--bg-card)' }}>
                        <div className="flex-between" style={{ marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>{editingId ? 'Edit Question Set' : 'Create New Question Set'}</h3>
                            {editingId && (
                                <button onClick={cancelEdit} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                                    Cancel Edit
                                </button>
                            )}
                        </div>
                        <form onSubmit={handleAddSet}>
                            <div className="input-group">
                                <label>Topic Name (e.g. Arrays, Recursion, Git)</label>
                                <input
                                    className="input-control"
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    placeholder="Enter topic..."
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label>Questions</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {questions.map((q, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                className="input-control"
                                                value={q}
                                                onChange={e => handleQuestionChange(idx, e.target.value)}
                                                placeholder={`Question ${idx + 1}`}
                                                style={{ marginBottom: 0 }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveQuestionRow(idx)}
                                                className="btn-icon"
                                                style={{ color: '#f44336' }}
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={handleAddQuestionRow}
                                    style={{ marginTop: '0.75rem', width: '100%', fontSize: '0.85rem' }}
                                >
                                    <Plus size={16} style={{ marginRight: '0.5rem' }} /> Add Another Question
                                </button>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', height: '45px' }}>
                                {editingId ? 'Update Question Set' : 'Save Question Set'}
                            </button>

                            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <input
                                    type="file"
                                    id="word-upload"
                                    accept=".docx"
                                    style={{ display: 'none' }}
                                    onChange={handleWordUpload}
                                />
                                <label htmlFor="word-upload" className="btn btn-outline flex-center" style={{ width: '100%', cursor: 'pointer', gap: '0.5rem' }}>
                                    <FileText size={18} /> Import from Word (.docx)
                                </label>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.5rem' }}>
                                    Format: Numbered list (1. Question, 2. Question...)
                                </p>
                            </div>
                        </form>
                    </div>

                    <div className="flex-between" style={{ marginBottom: '1rem' }}>
                        <h2 style={{ margin: 0 }}>Available Topics</h2>
                        {questionSets.length > 0 && (
                            <button
                                onClick={handleDeleteAll}
                                className="btn btn-outline flex-center"
                                style={{ color: '#f44336', borderColor: '#f44336', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            >
                                <Trash2 size={16} style={{ marginRight: '0.4rem' }} /> Delete All Topics
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {visibleSets.map(set => (
                            <div key={set.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="flex-between" style={{ marginBottom: '1rem', alignItems: 'flex-start' }}>
                                    <h3 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', flex: 1 }}>
                                        <BookOpen size={20} /> {set.topic}
                                    </h3>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        {(!currentUser || set.mentorId === currentUser.id) && (
                                            <>
                                                <button
                                                    onClick={() => startShare(set)}
                                                    className="btn-icon"
                                                    style={{ color: '#2196f3', padding: '5px' }}
                                                    title="Share Set"
                                                >
                                                    <Share2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => startEdit(set)}
                                                    className="btn-icon"
                                                    style={{ color: 'var(--text-secondary)', padding: '5px' }}
                                                    title="Edit Set"
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSet(set.id)}
                                                    className="btn-icon"
                                                    style={{ color: '#f44336', padding: '5px' }}
                                                    title="Delete Set"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    {set.questions && Array.isArray(set.questions) ? (
                                        <ul style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                            {set.questions.map((q, idx) => (
                                                <li key={q.id || idx} style={{ marginBottom: '0.5rem' }}>{q.text || q}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>No questions in this set.</p>
                                    )}
                                </div>
                                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{set.questions?.length || 0} questions</span>
                                    <span>{set.createdAt ? new Date(set.createdAt).toLocaleDateString() : ''}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {visibleSets.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-card)', borderRadius: '12px', border: '2px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
                            <HelpCircle size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                            <p>No question sets for {selectedMajorView} yet. Create your first one above!</p>
                        </div>
                    )}
                </>
            )}

            {showShareModal && sharingSet && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, color: 'var(--text-primary)' }}>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ marginTop: 0 }}>Share "{sharingSet.topic}"</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Select the mentors who should have access to this question set.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                            {mentors.filter(m => !currentUser || m.id !== currentUser.id).length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)' }}>No other mentors found.</p>
                            ) : (
                                mentors.filter(m => !currentUser || m.id !== currentUser.id).map(mentor => (
                                    <label key={mentor.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-main)' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedMentors.includes(mentor.id)}
                                            onChange={() => handleShareToggle(mentor.id)}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                        />
                                        <span style={{ fontWeight: '500' }}>{mentor.username}</span>
                                    </label>
                                ))
                            )}
                        </div>

                        <div className="flex-between">
                            <button onClick={() => setShowShareModal(false)} className="btn btn-outline">Cancel</button>
                            <button onClick={submitShare} className="btn btn-primary flex-center">
                                <Share2 size={16} style={{ marginRight: '0.5rem' }} /> Save Shares
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
