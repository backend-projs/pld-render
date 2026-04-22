// client/src/pages/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminUsers, deleteUserAccount, getMajors, addMajor, deleteMajor } from '../api';
import { Shield, Trash2, User, Key, LogOut, ArrowLeft, Plus, Folder } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const AdminPanel = () => {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('adminAuth') === 'true';
    });
    const [loginData, setLoginData] = useState({ username: '', password: '' });
    const [users, setUsers] = useState([]);
    const [majors, setMajors] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingMajors, setLoadingMajors] = useState(false);
    const [newMajorName, setNewMajorName] = useState('');
    const [error, setError] = useState('');
    const toast = useToast();
    const { confirm } = useConfirm();

    const handleLogin = (e) => {
        e.preventDefault();
        const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD;
        if (correctPassword && loginData.username === 'admin' && loginData.password === correctPassword) {
            setIsAuthenticated(true);
            sessionStorage.setItem('adminAuth', 'true');
            setError('');
            fetchData();
        } else {
            setError('Invalid Admin Credentials');
        }
    };
    const fetchData = () => {
        fetchUsers();
        fetchMajors();
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const data = await getAdminUsers();
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setError('Failed to load users from server.');
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchMajors = async () => {
        setLoadingMajors(true);
        try {
            const data = await getMajors();
            setMajors(data);
        } catch (err) {
            console.error('Failed to fetch majors:', err);
            toast.error('Failed to load majors.');
        } finally {
            setLoadingMajors(false);
        }
    };
    const handleDeleteUser = async (id) => {
        const isConfirmed = await confirm('Are you sure you want to delete this account? This action cannot be undone.');
        if (!isConfirmed) return;

        try {
            await deleteUserAccount(id);
            setUsers(users.filter(u => u.id !== id));
            toast.success('User deleted successfully.');
        } catch (err) {
            console.error('Delete error:', err);
            toast.error('Error deleting user: ' + err.message);
        }
    };

    const handleAddMajor = async (e) => {
        e.preventDefault();
        if (!newMajorName.trim()) return;

        try {
            const major = await addMajor(newMajorName);
            setMajors([...majors, major]);
            setNewMajorName('');
            toast.success('Major added successfully.');
        } catch (err) {
            console.error('Add major error:', err);
            toast.error('Error adding major: ' + err.message);
        }
    };

    const handleDeleteMajor = async (id) => {
        const isConfirmed = await confirm('Are you sure you want to delete this major?');
        if (!isConfirmed) return;

        try {
            await deleteMajor(id);
            setMajors(majors.filter(m => m.id !== id));
            toast.success('Major deleted successfully.');
        } catch (err) {
            console.error('Delete major error:', err);
            toast.error('Error deleting major: ' + err.message);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="container flex-center" style={{ minHeight: '80vh' }}>
                <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        background: 'var(--color-primary-light)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto'
                    }}>
                        <Shield size={32} color="var(--color-primary)" />
                    </div>
                    <h2>Admin Access</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Secure area for system management.</p>

                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <label>Username</label>
                            <input
                                className="input-control"
                                value={loginData.username}
                                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Password</label>
                            <input
                                type="password"
                                className="input-control"
                                value={loginData.password}
                                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                required
                            />
                        </div>
                        {error && <div style={{ color: 'var(--color-primary)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
                        <button className="btn btn-primary" style={{ width: '100%' }}>Login as Admin</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ padding: '2rem 0' }}>
            <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'var(--color-primary)', padding: '0.5rem', borderRadius: '8px' }}>
                        <Shield size={24} color="white" />
                    </div>
                    <h1>Admin Panel</h1>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-outline" onClick={() => { setIsAuthenticated(false); sessionStorage.removeItem('adminAuth'); }}>
                        <LogOut size={18} style={{ marginRight: '0.5rem' }} /> Logout
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>
                        Dashboard
                    </button>
                </div>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>User Accounts ({users.length})</h2>
                    <button className="btn-icon" onClick={fetchUsers} title="Refresh Users List">
                        <Key size={18} />
                    </button>
                </div>

                {loadingUsers ? (
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <div className="spinner"></div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', background: 'var(--bg-card)' }}>
                                    <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>User</th>
                                    <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Discord</th>
                                    <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Role</th>
                                    <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)' }}>Major</th>
                                    <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No users found.</td>
                                    </tr>
                                ) : (
                                    users.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: '600' }}>{u.username}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {u.id}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>{u.discordId}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span className={`badge ${u.role === 'mentor' ? 'badge-success' : 'badge-warning'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>{u.major || '-'}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handleDeleteUser(u.id)}
                                                    style={{ color: 'var(--color-primary)' }}
                                                    title="Delete Account"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '2rem' }}>
                <div style={{ padding: '1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Folder size={20} color="var(--color-primary)" />
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Manage Majors ({majors.length})</h2>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <form onSubmit={handleAddMajor} style={{ display: 'flex', gap: '1rem' }}>
                        <input
                            type="text"
                            className="input-control"
                            placeholder="Add new major (e.g., Data Science)"
                            value={newMajorName}
                            onChange={(e) => setNewMajorName(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} disabled={!newMajorName.trim()}>
                            <Plus size={16} /> Add Major
                        </button>
                    </form>
                </div>

                {loadingMajors ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}>
                        <div className="spinner"></div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                {majors.length === 0 ? (
                                    <tr>
                                        <td style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No majors defined.</td>
                                    </tr>
                                ) : (
                                    majors.map(m => (
                                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem', fontWeight: '500' }}>{m.name}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', width: '100px' }}>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handleDeleteMajor(m.id)}
                                                    style={{ color: 'var(--color-danger)' }}
                                                    title="Delete Major"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <button
                onClick={() => navigate(-1)}
                className="btn-back-premium"
            >
                <ArrowLeft size={18} /> Back to Dashboard
            </button>
        </div >
    );
};

export default AdminPanel;
