// server/controllers/adminController.js
const { getAllUsers, deleteUser } = require('../models/userModel');

exports.getUsers = async (req, res) => {
    try {
        const users = await getAllUsers();
        // Remove passwords from response
        const safeUsers = users.map(({ password, ...user }) => user);
        res.json(safeUsers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.removeUser = async (req, res) => {
    try {
        const { id } = req.params;
        await deleteUser(id);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
