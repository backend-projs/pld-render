// server/utils/authMiddleware.js
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./jwtSecret');

const SECRET = getJwtSecret();

module.exports = (req, res, next) => {
    const adminPass = req.headers['x-admin-password'];
    const validAdminPass = process.env.VITE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

    if (adminPass && validAdminPass && adminPass === validAdminPass) {
        req.user = { id: 'admin', role: 'admin' };
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
