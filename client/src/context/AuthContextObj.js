// client/src/context/AuthContextObj.js
import { createContext } from 'react';

/**
 * AuthContext Object
 * Separated to a dedicated file to ensure Vite Fast Refresh compatibility
 * across Provider and Hook files.
 */
export const AuthContext = createContext();
