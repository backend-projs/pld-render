// client/src/pages/Register.jsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser, sendVerificationCode, verifyDiscordCode } from '../api';
import { Eye, EyeOff } from 'lucide-react';

export default function Register() {
    const [formData, setFormData] = useState({ firstName: '', lastName: '', username: '', password: '', discordId: '' });
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerified, setIsVerified] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSendCode = async () => {
        if (!formData.discordId) {
            setError('Please enter your Discord username first');
            return;
        }

        setIsLoading(true);
        setError('');
        setVerificationStatus('');

        try {
            const message = await sendVerificationCode(formData.discordId);
            setCodeSent(true);
            setVerificationStatus(message);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode) {
            setError('Please enter the verification code');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const message = await verifyDiscordCode(formData.discordId, verificationCode);
            setIsVerified(true);
            setVerificationStatus(message);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (/\s/.test(formData.username)) {
            setError('Username cannot contain spaces');
            return;
        }

        if (!isVerified && formData.discordId) {
            setError('Please verify your Discord account first');
            return;
        }

        try {
            const data = await registerUser(formData);
            login(data.accessToken, data.user);

            // Redirect based on role
            if (data.user.role === 'student') {
                navigate('/student-dashboard');
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="flex-center" style={{ minHeight: '60vh' }}>
            <form onSubmit={handleSubmit} className="card" style={{ width: '400px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--color-primary)' }}>Register</h2>
                {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

                <div className="input-group">
                    <label>First Name</label>
                    <input
                        className="input-control"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                    />
                </div>

                <div className="input-group">
                    <label>Last Name</label>
                    <input
                        className="input-control"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                    />
                </div>

                <div className="input-group">
                    <label>Username</label>
                    <input
                        className="input-control"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                </div>

                <div className="input-group">
                    <label>Password</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showPassword ? "text" : "password"}
                            className="input-control"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#888'
                            }}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                <div className="input-group">
                    <label>Discord Username (Optional)</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            className="input-control"
                            placeholder="For notifications"
                            value={formData.discordId}
                            onChange={(e) => {
                                setFormData({ ...formData, discordId: e.target.value });
                                setCodeSent(false);
                                setIsVerified(false);
                                setVerificationCode('');
                            }}
                            disabled={isVerified}
                            style={{ flex: 1 }}
                        />
                        {!isVerified && formData.discordId && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleSendCode}
                                disabled={isLoading || codeSent}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                {codeSent ? '✓ Sent' : 'Send Code'}
                            </button>
                        )}
                        {isVerified && (
                            <span style={{ color: 'var(--color-success)', alignSelf: 'center', whiteSpace: 'nowrap', fontWeight: '600', padding: '0 0.5rem' }}>✓ Verified</span>
                        )}
                    </div>
                </div>

                {codeSent && !isVerified && (
                    <div className="input-group">
                        <label>Verification Code</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                className="input-control"
                                placeholder="Enter code from Discord DM"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleVerifyCode}
                                disabled={isLoading}
                            >
                                Verify
                            </button>
                        </div>
                    </div>
                )}

                {verificationStatus && (
                    <div style={{ color: isVerified ? 'var(--color-success)' : 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.5rem' }}>
                        {verificationStatus}
                    </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Register</button>
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <Link to="/login" style={{ color: 'var(--color-primary)' }}>Have an account? Login</Link>
                </div>
            </form>
        </div>
    );
}

