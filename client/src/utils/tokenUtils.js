// client/src/utils/tokenUtils.js
import { jwtDecode } from 'jwt-decode';

export const isTokenExpired = (token) => {
    if (!token) return true;
    try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        return decoded.exp < currentTime;
    } catch (error) {
        return true;
    }
};

export const getTokenRemainingTime = (token) => {
    if (!token) return 0;
    try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        return Math.max(0, decoded.exp - currentTime);
    } catch (error) {
        return 0;
    }
};

export const isTokenExpiringSoon = (token, bufferSeconds = 60) => {
    if (!token) return true;
    try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        return (decoded.exp - currentTime) < bufferSeconds;
    } catch (error) {
        return true;
    }
};
