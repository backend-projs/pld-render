// server/controllers/profileController.js
const bcrypt = require('bcryptjs');
const { findUserById, updateUserProfile, updateUserPassword } = require('../models/userModel');

exports.getProfile = async (req, res) => {
    try {
        const user = await findUserById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Don't send password
        const { password, ...safeUser } = user;
        res.json(safeUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { username, firstName, lastName, discordId, major, pldDay, pldTime } = req.body;

        // Simple validation, allow partial updates but prevent empty required fields
        if (username !== undefined && !username.trim()) {
            return res.status(400).json({ error: 'Username cannot be empty if provided' });
        }
        if (discordId !== undefined && !discordId.trim()) {
            return res.status(400).json({ error: 'Discord ID cannot be empty if provided' });
        }

        const updates = {};
        if (username !== undefined) updates.username = username;
        if (firstName !== undefined) updates.firstName = firstName;
        if (lastName !== undefined) updates.lastName = lastName;
        if (discordId !== undefined) updates.discordId = discordId;
        if (major !== undefined) updates.major = major;
        if (pldDay !== undefined) updates.pld_day = pldDay;
        if (pldTime !== undefined) updates.pld_time = pldTime;

        await updateUserProfile(req.user.id, updates);

        const updatedUser = await findUserById(req.user.id);

        // Sync info to the students roster so mentors see the updated data
        if (updatedUser && updatedUser.role === 'student' && updatedUser.discordId) {
            try {
                const { supabase } = require('../models/db');

                const studentUpdates = {};
                if (major !== undefined) studentUpdates.major = major;
                if (pldDay !== undefined) studentUpdates.pld_day = pldDay;
                if (pldTime !== undefined) studentUpdates.pld_time = pldTime;

                if (Object.keys(studentUpdates).length > 0) {
                    await supabase
                        .from('students')
                        .update(studentUpdates)
                        .ilike('discord', updatedUser.discordId);
                }
            } catch (e) {
                console.warn('[ProfileController] Could not sync data to students roster:', e.message);
            }
        }

        const { password, ...safeUser } = updatedUser;
        res.json({ message: 'Profile updated successfully', user: safeUser });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateAvatar = async (req, res) => {
    try {
        const { avatar } = req.body;
        const avatarValue = avatar || null;
        console.log(`[ProfileController] Update avatar request for user: ${req.user.id}. Data length: ${avatarValue ? avatarValue.length : 0}`);

        if (!req.user || !req.user.id) {
            console.error('[ProfileController] No user ID in request');
            return res.status(401).json({ error: 'User ID missing' });
        }

        await updateUserProfile(req.user.id, { avatar_url: avatarValue });
        console.log('[ProfileController] updateUserProfile completed');

        res.json({ message: avatarValue ? 'Avatar updated successfully' : 'Avatar removed successfully' });
    } catch (err) {
        console.error('[ProfileController] Update avatar error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }

        const user = await findUserById(req.user.id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await updateUserPassword(user.id, hashedPassword);

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
