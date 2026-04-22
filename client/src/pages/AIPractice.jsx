// client/src/pages/AIPractice.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePracticeQuestions, evaluatePracticeAnswer } from '../services/aiService';
import { Brain, Send, ChevronRight, CheckCircle2, XCircle, Info, RefreshCcw, Trophy } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const AIPractice = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState('config'); // config, loading, active, results
    const [config, setConfig] = useState({
        topic: '',
        difficulty: 'Intermediate',
        count: 3
    });

    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answer, setAnswer] = useState('');
    const [results, setResults] = useState([]); // Array of { question, answer, evaluation }
    const [loading, setLoading] = useState(false);
    const [evaluating, setEvaluating] = useState(false);
    const toast = useToast();

    const handleStart = async (e) => {
        e.preventDefault();
        if (!config.topic) return toast.error("Please enter a topic!");

        setStep('loading');
        setLoading(true);
        const qs = await generatePracticeQuestions(config.topic, config.difficulty, config.count);
        if (qs && qs.length > 0) {
            setQuestions(qs);
            setStep('active');
        } else {
            toast.error("Failed to generate questions. Please try again.");
            setStep('config');
        }
        setLoading(false);
    };

    const handleSubmitAnswer = async () => {
        if (!answer.trim()) return;

        setEvaluating(true);
        const evalResult = await evaluatePracticeAnswer(
            questions[currentIndex],
            answer,
            config.topic,
            config.difficulty
        );

        if (evalResult) {
            const newResults = [...results, {
                question: questions[currentIndex],
                answer: answer,
                evaluation: evalResult
            }];
            setResults(newResults);
            setAnswer('');

            if (currentIndex < questions.length - 1) {
                setCurrentIndex(currentIndex + 1);
            } else {
                setStep('results');
            }
        } else {
            toast.error("Error evaluating answer. Please try again.");
        }
        setEvaluating(false);
    };

    const reset = () => {
        setStep('config');
        setQuestions([]);
        setCurrentIndex(0);
        setAnswer('');
        setResults([]);
    };

    const calculateTotalScore = () => {
        if (results.length === 0) return 0;
        const sum = results.reduce((acc, curr) => acc + curr.evaluation.score, 0);
        return Math.round(sum / results.length);
    };

    if (step === 'config') {
        return (
            <div className="container" style={{ maxWidth: '600px', padding: '2rem 0' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'var(--color-primary-light)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto'
                    }}>
                        <Brain size={32} color="var(--color-primary)" />
                    </div>
                    <h1 style={{ marginBottom: '0.5rem' }}>AI Practice Mode</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        Test your knowledge on any topic with AI.
                    </p>

                    <form onSubmit={handleStart} style={{ textAlign: 'left' }}>
                        <div className="input-group">
                            <label>Topic</label>
                            <input
                                className="input-control"
                                placeholder="e.g. React Hooks, Docker, Python Strings..."
                                value={config.topic}
                                onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                                required
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="input-group">
                                <label>Difficulty</label>
                                <select
                                    className="input-control"
                                    value={config.difficulty}
                                    onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
                                >
                                    <option>Beginner</option>
                                    <option>Intermediate</option>
                                    <option>Advanced</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Number of Questions</label>
                                <select
                                    className="input-control"
                                    value={config.count}
                                    onChange={(e) => setConfig({ ...config, count: parseInt(e.target.value) })}
                                >
                                    <option value="3">3 Questions</option>
                                    <option value="5">5 Questions</option>
                                    <option value="10">10 Questions</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            Start Practice Session <ChevronRight size={20} />
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (step === 'loading') {
        return (
            <div className="container flex-center" style={{ height: '60vh', flexDirection: 'column' }}>
                <div className="spinner"></div>
                <h3 style={{ marginTop: '1.5rem' }}>AI is preparing your questions...</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Topic: {config.topic}</p>
            </div>
        );
    }

    if (step === 'active') {
        return (
            <div className="container" style={{ maxWidth: '800px', padding: '2rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <span className="badge badge-success">{config.topic}</span>
                        <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>{config.difficulty}</span>
                    </div>
                    <div style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>
                        Question {currentIndex + 1} of {questions.length}
                    </div>
                </div>

                <div className="card" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '1rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.3rem', lineHeight: '1.4' }}>{questions[currentIndex]}</h2>
                    </div>

                    <textarea
                        className="input-control"
                        style={{ flex: 1, minHeight: '150px', resize: 'none', padding: '1rem' }}
                        placeholder="Type your answer here..."
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        disabled={evaluating}
                    />

                    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            onClick={handleSubmitAnswer}
                            disabled={!answer.trim() || evaluating}
                        >
                            {evaluating ? (
                                <>Evaluating... <RefreshCcw size={18} className="animate-spin" /></>
                            ) : (
                                <>Submit Answer <Send size={18} /></>
                            )}
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', marginTop: '2rem', overflow: 'hidden' }}>
                    <div style={{
                        width: `${((currentIndex) / questions.length) * 100}%`,
                        height: '100%',
                        background: 'var(--color-primary)',
                        transition: 'width 0.3s ease'
                    }}></div>
                </div>
            </div>
        );
    }

    if (step === 'results') {
        const totalScore = calculateTotalScore();
        return (
            <div className="container" style={{ maxWidth: '900px', padding: '2rem 0' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'var(--bg-card)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem auto',
                        boxShadow: 'var(--shadow-lg)',
                        border: '4px solid gold'
                    }}>
                        <Trophy size={40} color="gold" />
                    </div>
                    <h1>Practice Complete!</h1>
                    <div style={{ fontSize: '3rem', fontWeight: '800', color: totalScore >= 70 ? 'var(--color-success)' : totalScore >= 40 ? 'var(--color-warning)' : 'var(--color-primary)' }}>
                        {totalScore}%
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>Average Score on {config.topic}</p>
                </div>

                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {results.map((res, idx) => (
                        <div key={idx} className="card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, paddingRight: '2rem' }}>Q{idx + 1}: {res.question}</h3>
                                <div style={{
                                    padding: '0.25rem 0.75rem',
                                    background: res.evaluation.score >= 70 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(211, 47, 47, 0.1)',
                                    color: res.evaluation.score >= 70 ? '#10b981' : 'var(--color-primary)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontWeight: '700',
                                    fontSize: '1.1rem'
                                }}>
                                    {res.evaluation.score}%
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Your Answer:</div>
                                <div style={{ background: 'var(--bg-app)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>{res.answer}</div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <Info size={18} color="var(--color-primary)" style={{ marginTop: '0.25rem' }} />
                                <div>
                                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Feedback:</div>
                                    <div style={{ fontSize: '0.95rem' }}>{res.evaluation.feedback}</div>
                                </div>
                            </div>

                            {res.evaluation.correctAnswer && (
                                <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '0.5rem' }}>
                                    <CheckCircle2 size={18} color="#10b981" style={{ marginTop: '0.25rem' }} />
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#10b981' }}>Core Concept:</div>
                                        <div style={{ fontSize: '0.95rem' }}>{res.evaluation.correctAnswer}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <button className="btn btn-outline" onClick={reset}>Try Again</button>
                    <button className="btn btn-primary" onClick={() => navigate('/student-dashboard')}>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    return null;
};

export default AIPractice;
