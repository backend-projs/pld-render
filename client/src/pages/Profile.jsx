// client/src/pages/Profile.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, updateUserProfile, updateAvatar, changePassword, getMajors } from '../api';
import { User, Mail, Lock, Shield, Camera, Trash2, Save, X, Key, AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import './Profile.css';

export default function Profile() {
    const { user, accessToken, login } = useAuth();
    const { confirm } = useConfirm();
    const navigate = useNavigate();
    const [profileData, setProfileData] = useState({
        username: '',
        firstName: '',
        lastName: '',
        discordId: '',
        major: '',
        avatar: ''
    });
    const [majorsList, setMajorsList] = useState([]);
    const [selectedMajors, setSelectedMajors] = useState([]);
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
    const [passMsg, setPassMsg] = useState({ type: '', text: '' });
    const [avatarMsg, setAvatarMsg] = useState({ type: '', text: '' });
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchProfile();
        fetchMajorsList();
    }, []);

    const fetchMajorsList = async () => {
        try {
            const data = await getMajors();
            if (Array.isArray(data)) setMajorsList(data);
        } catch (err) {
            console.error('Failed to fetch majors:', err);
        }
    };

    const fetchProfile = async () => {
        try {
            const data = await getUserProfile();
            setProfileData({
                ...data,
                avatar: data.avatar_url || data.avatar || ''
            });
            if (data.major) {
                setSelectedMajors(data.major.split(',').map(m => m.trim()).filter(Boolean));
            }
        } catch (err) {
            showAvatarMsg('error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const showProfileMsg = (type, text) => {
        setProfileMsg({ type, text });
        setTimeout(() => setProfileMsg({ type: '', text: '' }), 5000);
    };

    const showPassMsg = (type, text) => {
        setPassMsg({ type, text });
        setTimeout(() => setPassMsg({ type: '', text: '' }), 5000);
    };

    const showAvatarMsg = (type, text) => {
        setAvatarMsg({ type, text });
        setTimeout(() => setAvatarMsg({ type: '', text: '' }), 5000);
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const dataToSave = { ...profileData };
            if (user?.role === 'mentor') {
                dataToSave.major = selectedMajors.join(', ');
            }

            const res = await updateUserProfile(dataToSave);
            const updatedUser = {
                ...res.user,
                avatar: res.user.avatar_url || res.user.avatar || ''
            };
            login(accessToken, updatedUser);
            showProfileMsg('success', 'Profile updated successfully!');
        } catch (err) {
            showProfileMsg('error', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) {
            return showPassMsg('error', 'New passwords do not match');
        }
        setSaving(true);
        try {
            await changePassword({
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword
            });
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
            showPassMsg('success', 'Password changed successfully!');
        } catch (err) {
            showPassMsg('error', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            return showAvatarMsg('error', 'Image size should be less than 2MB');
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result;
            try {
                await updateAvatar(base64);
                setProfileData(prev => ({ ...prev, avatar: base64, avatar_url: base64 }));
                const updatedUser = { ...user, avatar: base64, avatar_url: base64 };
                login(accessToken, updatedUser);
                showAvatarMsg('success', 'Profile photo updated!');
            } catch (err) {
                showAvatarMsg('error', err.message);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDeleteAvatar = async () => {
        const isConfirmed = await confirm('Are you sure you want to delete your profile photo?');
        if (!isConfirmed) return;
        try {
            await updateAvatar(null);
            setProfileData(prev => ({ ...prev, avatar: '', avatar_url: '' }));
            const updatedUser = { ...user, avatar: '', avatar_url: '' };
            login(accessToken, updatedUser);
            showAvatarMsg('success', 'Profile photo removed');
        } catch (err) {
            showAvatarMsg('error', err.message);
        }
    };

    const handleMajorSelect = (e) => {
        const majorStr = e.target.value;
        if (majorStr && !selectedMajors.includes(majorStr)) {
            setSelectedMajors([...selectedMajors, majorStr]);
        }
        e.target.value = '';
    };

    const removeMajor = (majorStr) => {
        setSelectedMajors(selectedMajors.filter(m => m !== majorStr));
    };

    if (loading) return (
        <div className="flex-center" style={{ height: '60vh' }}>
            <div className="spinner"></div>
        </div>
    );

    return (
        <div className="profile-container">
            <button className="btn-back-premium" onClick={() => navigate(-1)}>
                <ArrowLeft size={20} />
                <span>Back to Dashboard</span>
            </button>

            <div className="profile-header">
                <h1>Account Settings</h1>
                <p>Manage your profile and account preferences</p>
            </div>

            {avatarMsg.text && (
                <div className={`profile-alert ${avatarMsg.type}`}>
                    {avatarMsg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    <span>{avatarMsg.text}</span>
                </div>
            )}

            <div className="profile-grid">
                <div className="profile-card sidebar-card">
                    <div className="avatar-section">
                        <div className="avatar-wrapper" onClick={() => fileInputRef.current.click()} style={{ cursor: 'pointer' }}>
                            {profileData.avatar ? (
                                <img src={profileData.avatar} alt="Profile" className="profile-avatar" />
                            ) : (
                                <div className="avatar-placeholder">
                                    <User size={64} />
                                </div>
                            )}
                            <button className="btn-upload">
                                <Camera size={18} />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarChange}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                        </div>
                        {profileData.avatar && (
                            <button className="btn-delete-avatar" onClick={handleDeleteAvatar}>
                                <Trash2 size={14} /> Remove Photo
                            </button>
                        )}
                        <h2>{profileData.firstName && profileData.lastName ? `${profileData.firstName} ${profileData.lastName}` : profileData.username}</h2>
                        <span className="role-badge">{user?.role}</span>
                    </div>

                    <div className="profile-quick-stats">
                        <div className="quick-stat">
                            <Shield size={16} />
                            <span>Verified via Discord</span>
                        </div>
                        <div className="quick-stat">
                            <Mail size={16} />
                            <span>@{profileData.discordId}</span>
                        </div>
                    </div>
                </div>

                <div className="profile-forms">
                    <div className="profile-card">
                        <div className="card-header">
                            <User size={20} />
                            <h3>Personal Information</h3>
                        </div>

                        {profileMsg.text && (
                            <div className={`profile-alert ${profileMsg.type}`} style={{ marginBottom: '1.5rem', padding: '0.8rem 1.2rem' }}>
                                {profileMsg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                                <span style={{ fontSize: '0.9rem' }}>{profileMsg.text}</span>
                            </div>
                        )}
                        <form onSubmit={handleProfileUpdate}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>First Name</label>
                                    <input
                                        type="text"
                                        value={profileData.firstName || ''}
                                        onChange={e => setProfileData({ ...profileData, firstName: e.target.value })}
                                        placeholder="Add first name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Last Name</label>
                                    <input
                                        type="text"
                                        value={profileData.lastName || ''}
                                        onChange={e => setProfileData({ ...profileData, lastName: e.target.value })}
                                        placeholder="Add last name"
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Username</label>
                                    <input
                                        type="text"
                                        value={profileData.username}
                                        onChange={e => setProfileData({ ...profileData, username: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Discord ID</label>
                                    <input
                                        type="text"
                                        value={profileData.discordId}
                                        onChange={e => setProfileData({ ...profileData, discordId: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Major / Study Path</label>
                                {user?.role === 'mentor' ? (
                                    <>
                                        <select
                                            className="form-input form-select"
                                            onChange={handleMajorSelect}
                                            defaultValue=""
                                            style={{ marginBottom: '10px' }}
                                        >
                                            <option value="" disabled>Select a major to add...</option>
                                            {majorsList.map(major => (
                                                <option key={major.id} value={major.name} disabled={selectedMajors.includes(major.name)}>
                                                    {major.name}
                                                </option>
                                            ))}
                                        </select>
                                        {selectedMajors.length > 0 && (
                                            <div className="selected-topics" style={{ marginTop: '10px' }}>
                                                {selectedMajors.map(major => (
                                                    <span key={major} className="topic-tag">
                                                        {major}
                                                        <button type="button" onClick={() => removeMajor(major)}>
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="form-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-app)', cursor: 'not-allowed', opacity: 0.8 }}>
                                        {profileData.major || 'Not set'}
                                    </div>
                                )}
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    <Save size={18} />
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="profile-card">
                        <div className="card-header">
                            <Key size={20} />
                            <h3>Change Password</h3>
                        </div>

                        {passMsg.text && (
                            <div className={`profile-alert ${passMsg.type}`} style={{ marginBottom: '1.5rem', padding: '0.8rem 1.2rem' }}>
                                {passMsg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                                <span style={{ fontSize: '0.9rem' }}>{passMsg.text}</span>
                            </div>
                        )}
                        <form onSubmit={handlePasswordChange}>
                            <div className="form-group">
                                <label>Current Password</label>
                                <div className="input-with-icon">
                                    <Lock size={16} />
                                    <input
                                        type={showCurrentPassword ? "text" : "password"}
                                        value={passwords.currentPassword}
                                        onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })}
                                        className="input-control"
                                        placeholder="••••••••"
                                        required
                                    />
                                    {passwords.currentPassword && (
                                        <button
                                            type="button"
                                            className="btn-toggle-pass"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        >
                                            {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>New Password</label>
                                    <div className="input-with-icon">
                                        <Lock size={16} />
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            value={passwords.newPassword}
                                            onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
                                            className="input-control"
                                            placeholder="••••••••"
                                            required
                                        />
                                        {passwords.newPassword && (
                                            <button
                                                type="button"
                                                className="btn-toggle-pass"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                            >
                                                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Confirm Password</label>
                                    <div className="input-with-icon">
                                        <Lock size={16} />
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={passwords.confirmPassword}
                                            onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                            className="input-control"
                                            placeholder="••••••••"
                                            required
                                        />
                                        {passwords.confirmPassword && (
                                            <button
                                                type="button"
                                                className="btn-toggle-pass"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            >
                                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    <Lock size={18} />
                                    {saving ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

