// client/src/hooks/useAuth.js
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContextObj';

/**
 * useAuth Hook
 * Extracted to a separate file to resolve Vite "Fast Refresh" incompatibility
 * and ensure better HMR (Hot Module Replacement) performance.
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
