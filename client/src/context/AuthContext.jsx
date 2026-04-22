// client/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { refreshToken as refreshTokenApi, logoutUser as logoutApi, setAccessToken as setApiToken } from '../api';

import { AuthContext } from './AuthContextObj';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user');
        try {
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(() => {
        // Optimistic: If we have a user, don't show the full page loader.
        // The app will mount and background refresh will handle the rest.
        return !localStorage.getItem('user');
    });
    
    const hasInitialized = useRef(false);

    // Activity tracking refs
    const lastActivityRef = useRef(Date.now());
    const throttleRef = useRef(false);

    // Expose setAccessToken and logout to window for Axios interceptor
    window.setAccessToken = (token) => {
        setAccessToken(token);
        setApiToken(token); // Sync with api module
    };

    const logout = useCallback(async () => {
        try {
            await logoutApi();
        } catch (error) {
            console.error("Logout API failed:", error);
        } finally {
            localStorage.removeItem('user');
            localStorage.removeItem('wasLoggedIn');
            localStorage.removeItem('lastActivityTimestamp');
            localStorage.removeItem('isIdle');
            setUser(null);
            setAccessToken(null);
            setApiToken(null);
        }
    }, []);

    const silentLogout = useCallback(async () => {
        // Silently clear cookies and redirect to login
        await logout();
        window.location.href = '/login';
    }, [logout]);

    window.logoutUser = logout;

    // --- ACTIVITY TRACKING LOGIC ---
    const updateActivity = useCallback(() => {
        if (throttleRef.current || !user) return; // Only track if logged in and not throttled

        // Before updating, verify we haven't ALREADY exceeded the 30-minute limit
        // Otherwise, a mouse move after 30+ minutes will wrongly reset the timer and keep them logged in.
        const storedActivity = localStorage.getItem('lastActivityTimestamp');
        if (storedActivity) {
             const difference = Date.now() - parseInt(storedActivity, 10);
             if (difference >= 30 * 60 * 1000) {
                 // The session expired while they were inactive, immediately trigger silent logout.
                 silentLogout();
                 return;
             }
        }

        throttleRef.current = true;
        const now = Date.now();
        lastActivityRef.current = now;
        localStorage.setItem('lastActivityTimestamp', now.toString());
        localStorage.removeItem('isIdle'); // Clear idle state on activity

        setTimeout(() => {
            throttleRef.current = false;
        }, 30000); // Throttle to once every 30 seconds
    }, [user, silentLogout]);

    useEffect(() => {
        if (!user) return; // Only track if logged in

        // Ensure lastActivityTimestamp exists for a newly logged in user
        if (!localStorage.getItem('lastActivityTimestamp')) {
            localStorage.setItem('lastActivityTimestamp', Date.now().toString());
        }

        const activityEvents = [
            'mousemove', 'mousedown', 'keydown',
            'scroll', 'touchstart', 'click'
        ];

        activityEvents.forEach(event => window.addEventListener(event, updateActivity));

        const handleBeforeUnload = () => {
            localStorage.setItem('lastActivityTimestamp', Date.now().toString());
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            activityEvents.forEach(event => window.removeEventListener(event, updateActivity));
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [user, updateActivity]);

    const performSilentRefresh = useCallback(async (isInitial = true) => {
        if (isInitial) {
            if (hasInitialized.current) return;
            hasInitialized.current = true;
        }

        // Optimization: Only attempt silent refresh if we were previously logged in
        if (!localStorage.getItem('wasLoggedIn')) {
            console.log("[Auth] Skipping silent refresh - no prior session recorded.");
            if (isInitial) setLoading(false);
            return false;
        }

        try {
            const response = await refreshTokenApi();
            const token = response.accessToken || response.data?.accessToken;
            
            setAccessToken(token);
            setApiToken(token);
            localStorage.setItem('wasLoggedIn', 'true');

            // Restore user from localStorage if exists
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
            return true;
        } catch (error) {
            // Only log if it's NOT a 401
            if (error.response?.status !== 401) {
                console.error("Initial silent refresh failed:", error);
            }
            localStorage.removeItem('user');
            localStorage.removeItem('wasLoggedIn');
            setUser(null);
            setAccessToken(null);
            setApiToken(null);
            return false;
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    // --- SESSION CHECKING & INTERVAL LOGIC ---
    const checkSession = useCallback(async (isReturningUser = false) => {
        if (!user) return;

        const storedActivity = localStorage.getItem('lastActivityTimestamp');
        if (!storedActivity) return;

        const lastActivityTimestamp = parseInt(storedActivity, 10);
        const currentTime = Date.now();
        const difference = currentTime - lastActivityTimestamp;

        const THIRTY_MINUTES = 30 * 60 * 1000;
        const FIFTEEN_MINUTES = 15 * 60 * 1000;

        if (difference >= THIRTY_MINUTES) {
            // User inactive for 30+ minutes, logout silently
            silentLogout();
        } else if (difference >= FIFTEEN_MINUTES) {
            // Grace period 15-30 mins, mark idle
            localStorage.setItem('isIdle', 'true');
            if (isReturningUser) {
                // Silently refresh the session when user returns within 30 mins
                await performSilentRefresh(false);
            }
        } else {
            // Less than 15 minutes, clear idle
            localStorage.removeItem('isIdle');
            if (isReturningUser) {
                // Silently refresh the session when user returns within 30 mins
                await performSilentRefresh(false);
            }
        }
    }, [user, silentLogout, performSilentRefresh]);

    useEffect(() => {
        if (!user) return;

        let intervalId = null;

        const startInterval = () => {
            if (!intervalId) {
                intervalId = setInterval(() => checkSession(false), 60 * 1000); // Check every 1 minute
            }
        };

        const stopInterval = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkSession(true); // Check immediately on return
                startInterval();
            } else {
                stopInterval();
            }
        };

        const handleFocus = () => {
            if (document.visibilityState === 'visible') { // Fallback, only if visible
                checkSession(true);
            }
        };

        // Tab synchronization
        const handleStorageChange = (e) => {
            if (e.key === 'lastActivityTimestamp') {
               // another tab updated activity, our checkSession will pick it up on interval
               lastActivityRef.current = parseInt(e.newValue, 10);
            }
            if (e.key === 'wasLoggedIn' && !e.newValue) {
               // another tab logged out
               logout();
               window.location.href = '/login';
            }
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('storage', handleStorageChange);

        // Initial setup
        if (document.visibilityState === 'visible') {
            startInterval();
        }

        return () => {
            stopInterval();
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [user, checkSession, logout]);

    useEffect(() => {
        const checkInitialSession = async () => {
            // Initial silent refresh check
            const storedActivity = localStorage.getItem('lastActivityTimestamp');
            if (storedActivity) {
                 const difference = Date.now() - parseInt(storedActivity, 10);
                 if (difference >= 30 * 60 * 1000) {
                     // Initial load detected 30+ min idle, clear and redirect immediately
                     console.log("[Auth] Initial load found expired session, logging out silently.");
                     // Do not set loading to false yet so we don't render protected routes
                     await silentLogout();
                     return;
                 }
            }

            console.log('[AUTH] App Load: Starting initial session restoration...');
            const success = await performSilentRefresh(true);
            console.log(`[AUTH] App Load: Session restoration finished. Success: ${success}`);
            // If the refresh failed (was logged in but now expired), performSilentRefresh
            // will set user to null, so it's safe to set loading false.
            setLoading(false);
        };

        checkInitialSession();
    }, [performSilentRefresh, silentLogout]);

    const login = (token, userData) => {
        setAccessToken(token);
        setApiToken(token);
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('wasLoggedIn', 'true');
        localStorage.setItem('lastActivityTimestamp', Date.now().toString());
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            accessToken,
            isAuthenticated: !!user,
            login, 
            logout, 
            loading
        }}>
            {loading ? (
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>Authenticating...</p>
                </div>
            ) : (
                <>
                    {children}
                </>
            )}
        </AuthContext.Provider>
    );
};

